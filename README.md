# tuwon

Turn any topic into a gamified, voiced lesson. A teacher describes what they want
to teach, the AI builds an interactive session (slides + questions with narration
and images), and students play it on their phone — online or fully offline.

Built for the Mindanao Innovation Cup.

## Prerequisites

- **Node.js 22+** and **npm**
- For the mobile app: **Expo CLI** (via `npx`) and an Android device/emulator (or Expo Go)
- For generating sessions: a **`GEMINI_API_KEY`**
- For (re)deploying the backend: **AWS CLI v2**, `jq`, and `zip`

## Quick start

You can run each part independently. The mobile and teacher apps both work against
the already-deployed backend, so you don't need AWS access to try them.

### 1. Teacher web app

```bash
cd teacher
npm install
npm run dev          # http://localhost:3000
```

Open the app, click **Continue with Google** (no real auth — it's the demo teacher
"Mr. Mic"), then use the chat to generate a session and view the gallery.

Optional — point at a different read API:

```bash
# teacher/.env.local
NEXT_PUBLIC_API_URL=https://<your-lambda-url>/
```

(Defaults to the live Singapore Lambda URL if unset.)

### 2. Mobile student app

```bash
cd mobile
npm install
npm start            # Expo dev server — scan the QR with Expo Go
# or, on a connected Android device/emulator:
npm run android
```

Enter or scan a **session code** (created by the teacher app / pipeline), download
it, and play it offline.

By default the app needs no config: with no `EXPO_PUBLIC_API_URL` set it runs on the
bundled **mock sessions**. To use the live API:

```bash
cp .env.example .env   # already points at the live Lambda URL
# edit EXPO_PUBLIC_API_URL if you deployed your own backend
```

> Note: env vars must be `EXPO_PUBLIC_`-prefixed, and you must fully reload the app
> after changing `.env`.

### 3. Generate a session (pipeline)

The pipeline turns a topic into a live, playable session in one command.

```bash
# Set your key (used by the author + TTS + image stages)
echo 'GEMINI_API_KEY=your-key-here' > infra/.env

# slides-then-questions
node infra/pipeline/pipeline.mjs make "the water cycle" --slides 1 --questions 3

# or pin the exact block order (s=slide, q=question, mc/tf/fb=question formats)
node infra/pipeline/pipeline.mjs make "the water cycle" --sequence q,s,q,s,s
```

On success it publishes to S3 + DynamoDB and prints a **session code** — enter/scan
that code in the mobile app to play it.

Useful flags:

- `--slides N` — number of slides (default 1)
- `--questions M` — number of questions (default 3)
- `--sequence s,q,mc,tf,fb` — exact block order (overrides `--slides`/`--questions`)
- `--session <id>` — reuse a fixed session id (otherwise derived from the topic)

### 4. (Optional) Provision the AWS backend

Only needed if you're standing up your own backend. Requires AWS credentials for the
`tuwon-dev` user and the tools listed above.

```bash
cd infra/aws
./provision.sh       # idempotent — safe to re-run
```

This creates an S3 bucket (public-read assets), the `tuwon-sessions` DynamoDB table,
the `tuwon-api` Lambda + public Function URL, and seeds the table. Everything is
pinned to `ap-southeast-1` and named `tuwon-*`. Point the teacher/mobile apps at the
new Function URL via the env vars above.

## Configuration & secrets

| Variable               | Used by          | Notes                                                            |
| ---------------------- | ---------------- | ---------------------------------------------------------------- |
| `GEMINI_API_KEY`       | `infra/pipeline` | Required to generate sessions. Put in `infra/.env`.              |
| `EXPO_PUBLIC_API_URL`  | `mobile`         | Optional. Unset → bundled mock sessions. `EXPO_PUBLIC_`-prefixed.|
| `NEXT_PUBLIC_API_URL`  | `teacher`        | Optional. Defaults to the live Lambda URL.                       |

`.env` files are git-ignored (only `.env.example` is tracked). **Never commit real
API keys** — keep `GEMINI_API_KEY` and any AWS credentials out of version control.

## Tech stack

- **Teacher:** Next.js 15, React 19, TypeScript
- **Mobile:** Expo SDK 56, React Native 0.85, React Navigation, expo-camera/audio
- **Pipeline:** Node.js (ESM), Google Gemini (text + TTS + image)
- **Backend:** AWS S3, DynamoDB, Lambda (Function URL)
