import { config } from './config';
import { ReleaseService } from './services/ReleaseService';
import { App } from '@slack/bolt';
import fs from 'fs';
import { execSync } from 'child_process';

console.log('🔍 Starting Verification...');

// 1. Check Config
if (!config.slack.botToken) {
    console.error('❌ Missing Slack Bot Token');
    process.exit(1);
}
console.log('✅ Config Loaded');

// 2. Check Project Root
if (!fs.existsSync(config.project.root)) {
    console.error(`❌ Project root not found: ${config.project.root}`);
    process.exit(1);
}
console.log(`✅ Project Root found: ${config.project.root}`);

// 3. Check Tools (agvtool)
try {
    const agvVersion = execSync('xcrun agvtool what-version -terse', { cwd: config.project.root }).toString().trim();
    console.log(`✅ agvtool working (Current Version: ${agvVersion})`);
} catch (e) {
    console.error('❌ agvtool check failed:', e);
    process.exit(1);
}

// 4. Instantiate Service
try {
    const mockApp = new App({ token: 'mock', signingSecret: 'mock' });
    new ReleaseService(mockApp);
    console.log('✅ ReleaseService instantiated successfully');
} catch (e) {
    console.error('❌ Service instantiation failed:', e);
    process.exit(1);
}

console.log('🎉 Verification COMPLETE! Service is ready.');
