import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs/promises';
import { App } from '@slack/bolt';
import { config } from '../config';
import { ReleaseRequest, ReleaseConfig } from '../domain/types';

const execAsync = util.promisify(exec);

export class ReleaseService {
    private readonly app: App;
    private readonly projectRoot: string;
    private isProcessing = false;

    constructor(app: App) {
        this.app = app;
        this.projectRoot = config.project.root;
        console.log('[ReleaseService] Initialized with project root:', this.projectRoot);
    }

    public async handleReleaseRequest(request: ReleaseRequest): Promise<void> {
        if (this.isProcessing) {
            await this.sendSlackMessage(
                request.channelId,
                '⚠️ Another release is currently in progress. Please wait.',
                request.threadTs
            );
            return;
        }

        this.isProcessing = true;
        const { env, version, buildNumber: explicitBuildNumber, channelId, userId, threadTs } = request;

        try {
            await this.sendSlackMessage(
                channelId,
                `🚀 *Starting Release to ${env.toUpperCase()}*...\nUser: <@${userId}>\nTarget Version: ${version || 'Current'}\nTarget Build: ${explicitBuildNumber || 'Auto-increment'}`,
                threadTs
            );

            const releaseConfig = this.getEnvConfig(env);
            if (!releaseConfig) {
                throw new Error(`Unknown environment: ${env}. Supported: kraken, titan.`);
            }

            // 1. Git Operations
            await this.updateStatus(channelId, threadTs, '🌿 Checking out code...');
            await this.gitCheckout(releaseConfig.branch);

            // 2. Version Bump
            let buildNumber = 'latest';
            if (version) {
                await this.updateStatus(channelId, threadTs, `🏷️ Bumping version to ${version} (Build: ${explicitBuildNumber || 'Auto'})...`);
                // Note: Modified logic to handle build number correctly
                buildNumber = await this.bumpVersion(version, explicitBuildNumber, releaseConfig);
            } else {
                buildNumber = await this.runCommand('xcrun agvtool what-version -terse');
                buildNumber = buildNumber.trim();
            }

            // 3. Build & Archive
            await this.updateStatus(channelId, threadTs, `🏗️ Building Archive for ${releaseConfig.scheme} (Build: ${buildNumber})...`);
            const archivePath = await this.buildArchive(releaseConfig.scheme, releaseConfig.configuration);

            // 4. Export & Upload
            if (config.appStore.apiKeyId && config.appStore.issuerId) {
                // Manual Export + Altool
                await this.updateStatus(channelId, threadTs, '📦 Exporting IPA...');
                const ipaPath = await this.exportIPA(archivePath, releaseConfig.exportMethod, false);

                await this.updateStatus(channelId, threadTs, '✈️ Uploading to TestFlight (via API Key)...');
                await this.uploadToTestFlight(ipaPath);

                await this.sendSlackMessage(
                    channelId,
                    `✅ *Release Complete!* 🚀\nEnvironment: ${env}\nVersion: ${version || 'Updated'}\nBuild: ${buildNumber}\nScheme: ${releaseConfig.scheme}\nStatus: Uploaded to TestFlight`,
                    threadTs
                );
            } else {
                // Native Xcode Upload
                await this.updateStatus(channelId, threadTs, '✈️ Exporting & Uploading to TestFlight (via Local Xcode)...');
                await this.exportIPA(archivePath, releaseConfig.exportMethod, true); // true = upload

                await this.sendSlackMessage(
                    channelId,
                    `✅ *Release Complete!* 🚀\nEnvironment: ${env}\nVersion: ${version || 'Updated'}\nBuild: ${buildNumber}\nScheme: ${releaseConfig.scheme}\nStatus: Uploaded via Local Xcode`,
                    threadTs
                );
            }

        } catch (error: any) {
            console.error('[ReleaseService] Error:', error);
            await this.sendSlackMessage(
                channelId,
                `❌ *Release Failed* \nError: ${error.message}`,
                threadTs
            );
        } finally {
            this.isProcessing = false;
        }
    }

    private getEnvConfig(env: string): ReleaseConfig | null {
        switch (env.toLowerCase()) {
            case 'kraken':
                return {
                    scheme: 'Terra Staging JP',
                    branch: config.project.krakenBranch,
                    configuration: 'Release',
                    exportMethod: 'app-store'
                };
            case 'titan':
                return {
                    scheme: 'iosApp',
                    branch: config.project.titanBranch,
                    configuration: 'Release',
                    exportMethod: 'app-store'
                };
            default:
                return null;
        }
    }

    private async sendSlackMessage(channelId: string, text: string, threadTs?: string): Promise<void> {
        try {
            await this.app.client.chat.postMessage({
                channel: channelId,
                text: text,
                thread_ts: threadTs
            });
        } catch (error) {
            console.error('[ReleaseService] Failed to send Slack message:', error);
        }
    }

    private async updateStatus(channelId: string, threadTs: string | undefined, message: string): Promise<void> {
        await this.sendSlackMessage(channelId, message, threadTs);
    }

    private async runCommand(command: string): Promise<string> {
        console.log(`[ReleaseService] Running: ${command} in ${this.projectRoot}`);
        const { stdout, stderr } = await execAsync(command, { cwd: this.projectRoot, maxBuffer: 1024 * 1024 * 50 });
        return stdout;
    }

    private async gitCheckout(branch: string): Promise<void> {
        await this.runCommand('git stash');
        await this.runCommand(`git fetch origin ${branch}`);
        await this.runCommand(`git checkout ${branch}`);
        await this.runCommand(`git pull origin ${branch}`);
    }

    private async bumpVersion(version: string, explicitBuildNumber: string | undefined, config: ReleaseConfig): Promise<string> {
        await this.runCommand(`xcrun agvtool new-marketing-version ${version}`);

        if (explicitBuildNumber) {
            await this.runCommand(`xcrun agvtool new-version -all ${explicitBuildNumber}`);
        } else {
            await this.runCommand('xcrun agvtool next-version -all');
        }

        let newBuildNumber = await this.runCommand('xcrun agvtool what-version -terse');
        newBuildNumber = newBuildNumber.trim();

        await this.runCommand(`git add .`);

        try {
            const status = await this.runCommand('git status --porcelain');
            if (status.trim()) {
                await this.runCommand(`git commit -m "chore: bump version to ${version} (build ${newBuildNumber})"`);
                await this.runCommand(`git push origin ${config.branch}`);
            } else {
                console.warn('[ReleaseService] No changes to commit.');
            }
        } catch (error) {
            console.warn('[ReleaseService] Git operation warning:', error);
        }

        return newBuildNumber;
    }

    private async buildArchive(scheme: string, configuration: string): Promise<string> {
        const buildDir = path.resolve(this.projectRoot, 'build');
        const archivePath = path.resolve(buildDir, `${scheme}.xcarchive`);

        await fs.mkdir(buildDir, { recursive: true });

        const workspacePath = path.resolve(this.projectRoot, 'iosApp.xcworkspace');
        const projectPath = path.resolve(this.projectRoot, 'iosApp.xcodeproj');

        let sourceFlag = '';
        try {
            await fs.access(workspacePath);
            sourceFlag = `-workspace iosApp.xcworkspace`;
        } catch {
            try {
                await fs.access(projectPath);
                sourceFlag = `-project iosApp.xcodeproj`;
            } catch {
                throw new Error('Neither "iosApp.xcworkspace" nor "iosApp.xcodeproj" found.');
            }
        }

        const command = `xcodebuild ${sourceFlag} -scheme "${scheme}" -configuration ${configuration} -archivePath "${archivePath}" archive -allowProvisioningUpdates`;
        await this.runCommand(command);
        return archivePath;
    }

    private async exportIPA(archivePath: string, method: string, upload: boolean = false): Promise<string> {
        const exportDir = path.resolve(this.projectRoot, 'build', 'output');
        await fs.mkdir(exportDir, { recursive: true });

        const destination = upload ? 'upload' : 'export';

        const exportOptionsPath = path.resolve(exportDir, 'ExportOptions.plist');
        const exportOptionsContent = `
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>${method}</string>
    <key>destination</key>
    <string>${destination}</string>
    <key>signingStyle</key>
    <string>automatic</string>
    <key>stripSwiftSymbols</key>
    <true/>
    <key>compileBitcode</key>
    <false/>
</dict>
</plist>`;
        await fs.writeFile(exportOptionsPath, exportOptionsContent.trim());

        const command = `xcodebuild -exportArchive -archivePath "${archivePath}" -exportOptionsPlist "${exportOptionsPath}" -exportPath "${exportDir}" -allowProvisioningUpdates`;
        await this.runCommand(command);

        const files = await fs.readdir(exportDir);
        const ipaFile = files.find(f => f.endsWith('.ipa'));

        if (!ipaFile && !upload) {
            throw new Error('IPA file not generated');
        }

        return ipaFile ? path.resolve(exportDir, ipaFile) : '';
    }

    private async uploadToTestFlight(ipaPath: string): Promise<void> {
        throw new Error("Manual API Key upload not fully implemented in this lightweight service yet.");
    }
}
