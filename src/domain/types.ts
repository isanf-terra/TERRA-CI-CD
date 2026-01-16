export interface ReleaseConfig {
    scheme: string;
    branch: string;
    configuration: string;
    exportMethod: string;
}

export interface ReleaseRequest {
    env: string;
    version?: string;
    buildNumber?: string;
    channelId: string;
    userId: string;
    threadTs?: string;
}
