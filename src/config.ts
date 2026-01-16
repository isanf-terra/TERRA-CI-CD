import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
    slack: {
        botToken: process.env.SLACK_BOT_TOKEN || '',
        appToken: process.env.SLACK_APP_TOKEN || '',
        signingSecret: process.env.SLACK_SIGNING_SECRET || '',
    },
    project: {
        root: process.env.PROJECT_ROOT ? path.resolve(process.env.PROJECT_ROOT) : path.resolve(process.cwd(), '../Project/Terra-Charge/iosApp'),
        krakenBranch: process.env.RELEASE_BRANCH_KRAKEN || 'develop',
        titanBranch: process.env.RELEASE_BRANCH_TITAN || 'main',
    },
    appStore: {
        apiKeyId: process.env.APP_STORE_CONNECT_API_KEY_ID,
        issuerId: process.env.APP_STORE_CONNECT_ISSUER_ID,
    }
};
