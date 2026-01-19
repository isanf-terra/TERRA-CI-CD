import { ReleaseService } from './services/ReleaseService';
import { App } from '@slack/bolt';

// Mock Slack App
const mockApp = {
    client: {
        chat: {
            postMessage: async (args: any) => {
                console.log('📝 [Mock Slack] Sending Message:', JSON.stringify(args, null, 2));
                return { ts: Date.now().toString() };
            }
        }
    }
} as unknown as App;

async function runTest() {
    console.log('🚀 Starting Test Release...');
    const service = new ReleaseService(mockApp);

    try {
        await service.handleReleaseRequest({
            env: 'kraken',
            version: '2.5.0',
            buildNumber: '10',
            channelId: 'C123456', // Mock Channel
            userId: 'U123456',   // Mock User
            threadTs: undefined
        });
        console.log('✅ Test finished successfully.');
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

runTest();
