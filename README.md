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

## Auto-generated purchase orders (ใบสั่งซื้อ)

When an incoming message looks like an admin's order summary — one or more lines shaped like
`<สินค้า> จำนวน <N> ลัง x <ราคา> บาท = <ยอดรวม> บาท`, optionally with `จัดส่ง <วันที่>` — the bot
skips OpenAI entirely, parses the line items, assigns a PO number (`PO-YYYYMMDD-NNN`), and:

- Replies in the chat with a formatted purchase order confirmation.
- Appends the order to `data/orders.json` (git-ignored; local/transactional data).

Example trigger message:

```
สรุปยอดนะครับ แฮปปี้ แบบขวด 900 มล. จำนวน 20 ลัง x 545 บาท = 10,900 บาท จัดส่ง 21/09/69 ครับ ขอบคุณครับ
```

A message can contain multiple item lines; they're all captured under one PO with a combined total.

To download every logged order as one combined CSV file:

```
GET /orders/export.csv
```

Set `ORDERS_EXPORT_TOKEN` in your environment to require `?token=<value>` on that endpoint before
deploying publicly — otherwise anyone with the URL can read your order history.

### Customer name

The bot fetches the sender's LINE display name via the Profile API and uses it as the customer
name (falls back to blank if the lookup fails, e.g. the sender hasn't added the bot as a friend).

### FORM workbook (matches the master ใบคำสั่งซื้อ-2026 sheet)

Every parsed order is also appended as a new row to `data/orders-form.xlsx` (git-ignored), using
the exact same header layout as the master order-tracking workbook — `วันที่สั่ง`, `นัดส่ง`,
`ลูกค้า`, product-code columns (`C13`, `T18`, `H12`, `มรกต`, …), etc. — so rows can be copy/pasted
straight into the master file. Download it anytime at:

```
GET /orders/export.xlsx
```

**Product code mapping** lives in [lib/formColumnMap.js](lib/formColumnMap.js), seeded from
รหัสสินค้า-2026 - Test.xlsx — 15 products (C13, C18, G16, HG18, T13, T18, TG, T200, T12, H12,
K12, H70, K80, HB90, KB12) are mapped to their quantity/price columns. A few codes that appear
in the FORM header but have no known Thai product name yet (TN18, H18, U12, มรกต, หมูล้วน, LM13,
LM18, P05, P14, P45, "PK G", PK200, รินทิพย์, มีสุข, มังกรทอง, Tank) are not mapped — add them the
same way once you have their names. Until a product is mapped, its line item is written into the
`หมายเหตุ` column instead of being lost, prefixed with `[ไม่พบรหัสสินค้า]`.

## Security notes

- `.env` is git-ignored. Never commit real secrets.
- If any keys were ever shared in plaintext (chat, screenshots, etc.), rotate them in the LINE Developers Console and OpenAI dashboard.
