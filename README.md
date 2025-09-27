# Cosmic Raid

Welcome to Cosmic Raid, a Next.js application built with Firebase Studio. This suite of powerful tools is designed to help you manage, engage, and grow your Twitch community through seamless Discord integration.

## Core Features

- **Unified Admin Dashboard**: A central hub to get a real-time overview of your community's activity, upcoming events, and recent actions.
- **Raid Pile**: A dynamic, fair-play queue for community raids. Members join the pile, and the app automatically features the member who has been live the longest.
- **Raid Train**: A robust scheduling system for community raid events. Admins can set rules for participation (based on points or attendance), and members can sign up for specific time slots.
- **Community Pool**: A free-for-all showcase where any community member can opt-in to get visibility on the web app and in a dedicated Discord channel whenever they go live.
- **VIP Live Showcase**: A curated space to feature your most valued community members (VIPs, mods, partners). When a VIP goes live, they are prominently displayed with an embedded stream and custom message.
- **Community Spotlight**: An AI-powered tool that helps you and your members craft polished, engaging posts to showcase content, announcements, or positive messages.
- **Team Chat**: A private, real-time chat interface for your moderation and admin team, synced across the web app and your private Discord channels.
- **Analytics & Calendar**: Track community engagement through a point system and view a comprehensive schedule of all community events, from raid trains to member-submitted activities.
- **Secure Authentication**: Simple, secure authentication flows for both admins and general users, leveraging Discord and Twitch for identity.
- **Firestore Database Backend**: All data—from user profiles and points to event schedules and settings—is stored and managed in a reliable Firestore database.

---

## Administrator's Guide

This section covers everything you need to know to get your community set up and running with Cosmic Raid.

### 1. Initial Setup & Configuration

- **Run the App**:

  ```bash
  npm run dev
  ```

  Open `http://localhost:9002` in your browser.

- **Connect Your Admin Account**: The setup page will guide you. Click "Connect Discord Account" and authorize the app. You must be an administrator in the Discord server you wish to manage.
- **Select Your Community**: After authorizing, select the server you want to manage from the dropdown. This choice is saved to your profile.
- **Link Your Twitch Account**: In the **Settings** page, you'll be prompted to link your Twitch account. This is crucial for identifying you as an admin in bot interactions.

### 2. Setting Up Your Discord Server

The true power of Cosmic Raid comes from its Discord bot integration. Use these slash commands in your server to create interactive channels.

- **`/raid-pile`**: Posts a live-updating embed showing the current Raid Pile holder and the queue.
- **`/raid-train`**: Posts the interactive Raid Train schedule, allowing users to view and sign up for slots.
- **`/community-pool`**: Sets up a channel where the bot will post live cards for any opted-in member who is streaming.
- **`/vip-live`**: Designates a channel for the bot to post special announcements when one of your VIPs goes live.
- **`/calendar`**: Posts the interactive community calendar, showing upcoming events and Captain's Log signups.
- **`/leaderboard`**: Posts an embed showing the top community members ranked by points.
- **`/disable-feature [feature]`**: A cleanup command. This will stop the bot's tracker for a feature (e.g., VIP Live) and attempt to delete its managed messages from the channel.

### 3. Managing Your Community

- **Dashboard**: Your main overview. See recent activity, upcoming events, and configure the point system.
- **Raid Train Page**: This is your command center for raids.
  - Configure all rules: point/attendance requirements, slots per day, and emergency slot rules.
  - View the full weekly schedule and manually override any slot (assign, block, or clear).
  - Look up any member's raid attendance history.
- **VIP Live Page**: Add or remove VIPs. When a VIP is live, you can manually trigger a "go live" notification to all configured webhook channels.
- **Settings Page**: Link your accounts, configure Discord webhooks for bot notifications, and use developer tools to give yourself points for testing.

---

## Community Member's Guide

Welcome to the community! Here’s how you can participate and get involved using the Cosmic Raid tools.

### How to Join and Participate

- **Joining the Raid Pile**: In the `#raid-pile` channel in Discord, click the "Join Raid Pile" button. As long as you are live on Twitch, you'll be added to the queue. The person who has been live the longest becomes the "Pile Holder" and is next to be raided.
- **Joining the Community Pool**: In the `#community-pool` channel, click the "Join Community Pool" button. Once you've joined, you'll be automatically featured on the Community Pool page and in the Discord channel whenever you go live.
- **Signing Up for the Raid Train**:
  - Use the `/raid-train` embed in Discord.
  - Click the "Sign Up" button to see the schedule for the upcoming days.
  - Select a day to view its schedule.
  - Click "Claim Spot" and enter the 24-hour time slot you wish to claim (e.g., `14:00`).
  - *Note*: You must meet the point or attendance requirements set by the admins to claim a spot.
- **Using Quick Links**: Admins may share direct links to join the Raid Pile, Community Pool, or Raid Train. These links will guide you through a quick authentication and sign-up process in your browser.

### Earning Points

You earn points by being an active and supportive community member! Here are some of the ways you can earn points (admins can change the values):

- **Participating in a Community Raid**
- **Signing up for a Raid Train**
- **Claiming a "Captain's Log" spot on the calendar**
- **Following a community member on Twitch**
- **Subscribing to a community member**
- **Cheering with Bits**
- **Contributing to a Hype Train**

---

## Environment variables & hosting

This project relies on a set of environment variables for bot credentials, API keys, and runtime configuration. The repository keeps a local `.env` file for development (this file is gitignored). When deploying, set the same variables with your hosting provider's environment configuration.

Minimum required environment variables:

- `NEXT_PUBLIC_BASE_URL` - The public URL of your deployed app (example: `https://spacemtn--cosmic-raid-app.us-central1.hosted.app/`). Used for OAuth callbacks and links.
- `BOT_SECRET_KEY` - Secret key used between your tools and the API endpoints (`x-bot-secret` or Authorization header). Keep this secret.
- `DISCORD_BOT_TOKEN` - Your Discord bot token used to post/delete messages.
- `FREE_CONVERT_API_KEY` - (Optional) API key for FreeConvert if you use the online GIF converter.

Optional/advanced variables:

- `DISCORD_USER_AGENT` - Custom User-Agent string for Discord API requests.
- `DISCORD_API_BASE_URL` - Override Discord API base (defaults to `https://discord.com/api/v10`).
- Firebase service account variables if your hosting requires them: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.

How to set env vars on common hosting providers:

- Vercel: Project → Settings → Environment Variables → add variables and redeploy.
- Google Cloud (Cloud Run/Firebase):
  - Cloud Run: Console → Cloud Run → select your service → Edit & Deploy New Revision → Variables & Secrets → add variables → Deploy.
  - Firebase Functions (legacy): use `firebase functions:config:set key=value` and then `firebase deploy --only functions` (modern deployments often use Cloud Run).
- Netlify/Other: Look for Project Settings → Environment variables and add the keys.

Local development:

1. Copy `.env.example` to `.env` and fill in your values.

2. From PowerShell (repo root) run:

```powershell
.\scripts\dev-with-tunnel.ps1
```

1. To test against your hosted site instead of starting a tunnel, run:

```powershell
.\scripts\dev-with-tunnel.ps1 -NoTunnel
```

Security reminder: never commit your `.env` file. Use your host's environment configuration for production secrets.

If you'd like, I can produce a checklist of exact variable names and example values you can copy/paste into your hosting provider's environment settings. I can't upload them for you, but I can make it copy/paste-friendly.

### Uploading your local `.env` to the app config (Firestore)

If you'd like to store your environment variables in the database so the app can read them at runtime, you can use the provided upload script or call the admin endpoint directly. The admin endpoint is protected by `BOT_SECRET_KEY`.

PowerShell (upload `.env` to app_settings/runtime):

```powershell
# From repo root, provide the app URL and bot secret (or set BOT_SECRET_KEY in your shell)
.\scripts\upload-env.ps1 -EnvPath .\.env -Url https://spacemtn--cosmic-raid-app.us-central1.hosted.app -Secret <BOT_SECRET_KEY>
```

Curl (example):

```bash
# Build a JSON payload manually or programmatically. Example payload structure:
cat <<EOF > payload.json
{
  "root": {
    "NEXT_PUBLIC_BASE_URL": "https://spacemtn--cosmic-raid-app.us-central1.hosted.app/",
    "DISCORD_BOT_TOKEN": "<your-bot-token>",
    "FREE_CONVERT_API_KEY": "<optional>"
  }
}
EOF

curl -X POST "https://spacemtn--cosmic-raid-app.us-central1.hosted.app/api/admin/env" \
  -H "Content-Type: application/json" \
  -H "x-bot-secret: <BOT_SECRET_KEY>" \
  --data @payload.json
```

After uploading, the app can read values with the runtime helper `getRuntimeValue` in `src/lib/runtime-config.ts`. Example usage in code:

```ts
import { getRuntimeValue } from "@/lib/runtime-config";

const baseUrl = await getRuntimeValue<string>("NEXT_PUBLIC_BASE_URL", process.env.NEXT_PUBLIC_BASE_URL);
```

### Developing without Firebase runtime config

If you do not have access to the hosted Firestore runtime document you can supply the same values locally. Create a JSON file named `runtime-config.local.json` (or set `RUNTIME_CONFIG_PATH` to point to a custom file) in the project root with the keys you need:

```json
{
  "NEXT_PUBLIC_BASE_URL": "http://localhost:3000",
  "DISCORD_CLIENT_ID": "123",
  "DISCORD_CLIENT_SECRET": "abc",
  "BOT_SECRET_KEY": "super-secret-key"
}
```

At runtime the helper in `src/lib/runtime-config.ts` merges values from this file with any environment variables so your local development environment behaves like production even without Firebase credentials. The loader also looks for `runtime-config.json`, `config/runtime-config.json`, or `.runtime-config.json` if you prefer a different filename.

When a local runtime config file is present, development builds automatically prefer those values and skip Firestore calls. To force Firestore usage set `FIREBASE_RUNTIME_PREFER_LOCAL=0`; to always prefer local values (even in production-like environments) set `FIREBASE_RUNTIME_PREFER_LOCAL=1`. You can also completely disable Firestore runtime reads by setting `FIREBASE_RUNTIME_DISABLED=1`.

Security reminder: keep `BOT_SECRET_KEY` secret; do not commit it to source control.

---
Built with passion by Mtman1987 & your AI Partner.
