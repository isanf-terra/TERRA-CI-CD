import { SlackAdapter } from './adapters/SlackAdapter';

const adapter = new SlackAdapter();
adapter.start().catch(console.error);
