# Terra Mobile CI/CD Service

A lightweight, standalone Node.js service for automating mobile app releases via Slack commands.
Currently supports **iOS** (TestFlight) releases using `agvtool` and `xcodebuild`.

## Features
- 🚀 **Slack Integration**: Trigger releases directly from Slack using `/release`.
- 🔄 **Automated Versioning**: Auto-increments build numbers or accepts explicit manual build numbers.
- 🏗 **Build & Archive**: Automatically builds `Release` configuration and creates `.xcarchive`.
- 📤 **TestFlight Upload**: 
  - Supports API Key upload (if configured).
  - Fallback to native Xcode upload (uses local Mac session).

## Prerequisites
- **macOS** with Xcode installed.
- **Node.js** (v18+).
- **Git** configured with access to the target mobile project.
- **agvtool** enabled in your Xcode project settings.

## Installation

1.  **Clone the repository**:
    ```bash
    git clone <repo-url>
    cd terra-mobile-cicd
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configuration**:
    Copy `.env.example` to `.env` and configure your secrets:
    ```bash
    cp .env.example .env
    ```
    
    *   `SLACK_BOT_TOKEN` & `SLACK_APP_TOKEN`: From your Slack App configuration.
    *   `PROJECT_ROOT`: Absolute path to your iOS project folder (containing `.xcodeproj` or `.xcworkspace`).
    *   `RELEASE_BRANCH_KRAKEN` / `RELEASE_BRANCH_TITAN`: Target branches for deployment.

## Usage

Start the service:
```bash
npm run dev
```

### Slack Command
Use the `/release` command in your configured Slack channel:

```
/release <environment> [version] [build_number]
```

**Arguments:**
*   `environment`: `kraken` (Staging) or `titan` (Production).
*   `version` (Optional): Marketing version (e.g., `2.5.0`). If omitted, keeps current.
*   `build_number` (Optional): Explicit build number (e.g., `6`). If omitted, auto-increments.

**Examples:**
*   `/release kraken 2.5.0` -> Bumps to 2.5.0, auto-increments build number.
*   `/release kraken 2.5.0 6` -> Bumps to 2.5.0, sets build number to 6.
*   `/release titan` -> Keeps current version, auto-increments build number.

## Architecture
This service uses `@slack/bolt` to listen for Socket Mode events.
It executes shell commands (`git`, `xcodebuild`, `xcrun agvtool`) on the host machine to perform the build process.

## License
Private
