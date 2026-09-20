# LINE + OpenAI Chatbot

A minimal LINE Messaging API bot that replies to text messages using OpenAI, deployable on Railway.

## How it works

- `POST /webhook` receives events from LINE, verified against `LINE_CHANNEL_SECRET`.
- Each text message is sent to OpenAI (`OPENAI_MODEL`, default `gpt-4o-mini`) with `SYSTEM_PROMPT` as system context.
- The reply is sent back via LINE's reply API using `LINE_CHANNEL_ACCESS_TOKEN`.

## Local setup

```bash
npm install
```

Copy `.env.example` to `.env` and fill in your own values.

```bash
npm start
```

The server listens on `PORT` (default 3000).

## Deploy to Railway

1. Push this repo to GitHub (already done if you're reading this from the repo) and connect it to a Railway project ("Deploy from GitHub repo"), or use the Railway CLI (`railway init`, `railway up`) from this folder.
2. In the Railway project's **Variables** tab, add:
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `LINE_CHANNEL_SECRET`
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` (optional)
   - `SYSTEM_PROMPT` (optional)
3. Generate a public domain (Settings → Networking → Generate Domain). Railway injects `PORT` automatically.
4. Your webhook URL will be: `https://<your-railway-domain>/webhook`

## Configure the LINE webhook

1. Go to the [LINE Developers Console](https://developers.line.biz/console/) → your channel → **Messaging API** tab.
2. Set **Webhook URL** to `https://<your-railway-domain>/webhook` and click **Verify**.
3. Enable **Use webhook**.
4. Under **LINE Official Account features**, turn OFF "Auto-reply messages" and "Greeting messages" if you want only the bot's OpenAI-generated replies.

## FAQ from a Google Sheet (optional)

The bot can look up relevant FAQ entries from a private Google Sheet and pass them to OpenAI as context before replying.

1. In [Google Cloud Console](https://console.cloud.google.com/), create (or reuse) a project and enable the **Google Sheets API**.
2. Create a **Service Account** (IAM & Admin → Service Accounts → Create), then create a JSON key for it and download it.
3. Open your Google Sheet, click **Share**, and add the service account's `client_email` (from the JSON key) as a **Viewer**.
4. Set up the sheet with a tab named `FAQ` (or any name you choose) with questions in column A and answers in column B, starting from row 2 (row 1 is the header).
5. In Railway → Variables, add:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` — the `client_email` from the JSON key
   - `GOOGLE_PRIVATE_KEY` — the `private_key` from the JSON key (keep the `\n` sequences as-is; the app converts them to real newlines)
   - `GOOGLE_SHEET_ID` — the ID from the sheet's URL (`https://docs.google.com/spreadsheets/d/<THIS_PART>/edit`)
   - `GOOGLE_SHEET_RANGE` (optional, default `FAQ!A2:B`) — adjust if your tab/range is named differently
6. Redeploy. The bot fetches and caches the sheet for 5 minutes, then matches the customer's message against FAQ questions and includes the closest matches as context for OpenAI.

Leaving any of the three required variables blank disables the FAQ feature entirely (the bot falls back to plain OpenAI replies).

## Security notes

- `.env` is git-ignored. Never commit real secrets.
- If any keys were ever shared in plaintext (chat, screenshots, etc.), rotate them in the LINE Developers Console and OpenAI dashboard.
