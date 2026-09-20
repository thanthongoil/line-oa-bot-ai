require('dotenv').config();

const express = require('express');
const { middleware, Client } = require('@line/bot-sdk');
const OpenAI = require('openai');
const { google } = require('googleapis');

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

for (const [key, value] of Object.entries({
  LINE_CHANNEL_ACCESS_TOKEN: lineConfig.channelAccessToken,
  LINE_CHANNEL_SECRET: lineConfig.channelSecret,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
})) {
  if (!value) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const lineClient = new Client(lineConfig);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT =
  process.env.SYSTEM_PROMPT ||
  'You are a helpful, friendly assistant replying to users in a LINE chat. Keep replies concise.';

const FAQ_ENABLED = Boolean(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.GOOGLE_SHEET_ID
);
const FAQ_SHEET_RANGE = process.env.GOOGLE_SHEET_RANGE || 'FAQ!A2:B';
const FAQ_CACHE_TTL_MS = 5 * 60 * 1000;
const FAQ_MATCH_COUNT = 5;

let faqCache = { entries: [], fetchedAt: 0 };

function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function getFaqEntries() {
  if (!FAQ_ENABLED) return [];

  const isStale = Date.now() - faqCache.fetchedAt > FAQ_CACHE_TTL_MS;
  if (!isStale) return faqCache.entries;

  try {
    const sheets = getSheetsClient();
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: FAQ_SHEET_RANGE,
    });
    const entries = (data.values || [])
      .filter((row) => row[0] && row[1])
      .map((row) => ({ question: row[0], answer: row[1] }));
    faqCache = { entries, fetchedAt: Date.now() };
    return entries;
  } catch (err) {
    console.error('Failed to fetch FAQ sheet:', err);
    return faqCache.entries; // fall back to last known good cache
  }
}

function charTrigrams(text) {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  const grams = new Set();
  for (let i = 0; i < normalized.length - 2; i++) {
    grams.add(normalized.slice(i, i + 3));
  }
  return grams;
}

function similarity(gramsA, gramsB) {
  let overlap = 0;
  for (const gram of gramsA) {
    if (gramsB.has(gram)) overlap++;
  }
  const union = gramsA.size + gramsB.size - overlap;
  return union === 0 ? 0 : overlap / union;
}

function findRelevantFaqs(userText, entries) {
  const userGrams = charTrigrams(userText);
  return entries
    .map((entry) => ({ entry, score: similarity(userGrams, charTrigrams(entry.question)) }))
    .filter(({ score }) => score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, FAQ_MATCH_COUNT)
    .map(({ entry }) => entry);
}

const app = express();

app.get('/', (_req, res) => {
  res.status(200).send('LINE OpenAI chatbot is running.');
});

// LINE's middleware verifies the X-Line-Signature header using the channel
// secret and must receive the raw body, so it must run before any JSON parser.
app.post('/webhook', middleware(lineConfig), async (req, res) => {
  try {
    await Promise.all((req.body.events || []).map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error('Error handling webhook events:', err);
    res.status(200).end(); // Always ack LINE to avoid retry storms
  }
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  const userText = event.message.text;

  let replyText;
  try {
    const faqEntries = await getFaqEntries();
    const relevantFaqs = findRelevantFaqs(userText, faqEntries);

    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    if (relevantFaqs.length > 0) {
      const faqContext = relevantFaqs
        .map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`)
        .join('\n\n');
      messages.push({
        role: 'system',
        content: `ใช้ข้อมูล FAQ ต่อไปนี้เป็นข้อมูลอ้างอิงหากเกี่ยวข้องกับคำถามของลูกค้า หากไม่เกี่ยวข้องให้ตอบตามความรู้ปกติ:\n\n${faqContext}`,
      });
    }
    messages.push({ role: 'user', content: userText });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
    });
    replyText = completion.choices[0]?.message?.content?.trim() || 'Sorry, I have no reply for that.';
  } catch (err) {
    console.error('OpenAI error:', err);
    replyText = 'Sorry, something went wrong generating a reply.';
  }

  return lineClient.replyMessage(event.replyToken, {
    type: 'text',
    text: replyText,
  });
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
