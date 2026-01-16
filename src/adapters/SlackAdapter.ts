import { App } from '@slack/bolt';
import { config } from '../config';
import { ReleaseService } from '../services/ReleaseService';

export class SlackAdapter {
    private app: App;
    private releaseService: ReleaseService;

    constructor() {
        this.app = new App({
            token: config.slack.botToken,
            appToken: config.slack.appToken,
            socketMode: true,
            signingSecret: config.slack.signingSecret,
        });

        this.releaseService = new ReleaseService(this.app);
        this.setupListeners();
    }

    public async start(): Promise<void> {
        await this.app.start();
        console.log('⚡️ Terra Mobile CI/CD Bot is running!');
    }

    private setupListeners(): void {
        this.app.command('/release', async ({ command, ack }) => {
            // Acknowledge immediately to avoid timeout
            await ack();

            const parts = command.text.trim().split(/\s+/);
            const env = parts[0]?.toLowerCase();
            const version = parts[1];
            const buildNumber = parts[2];

            if (!env || !['kraken', 'titan'].includes(env)) {
                await this.app.client.chat.postEphemeral({
                    channel: command.channel_id,
                    user: command.user_id,
                    text: '❌ Usage: `/release <kraken|titan> [version] [build_number]`\nExample: `/release kraken 2.5.0 6`'
                });
                return;
            }

            // Run asynchronously
            this.releaseService.handleReleaseRequest({
                env,
                version,
                buildNumber,
                channelId: command.channel_id,
                userId: command.user_id,
                threadTs: command.thread_ts
            }).catch(err => console.error('Error handling release:', err));
        });
    }
}
