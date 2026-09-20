// Parses admin order-summary messages like:
// "สรุปยอดนะครับ แฮปปี้ แบบขวด 900 มล. จำนวน 20 ลัง x 545 บาท = 10,900 บาท จัดส่ง 21/09/69 ครับ ขอบคุณครับ"
// into structured line items + a delivery date. Supports multiple item lines in one message.

const ITEM_PATTERN =
  /([^\n=]+?)\s*จำนวน\s*([\d,]+(?:\.\d+)?)\s*ลัง\s*[xX×]\s*([\d,]+(?:\.\d+)?)\s*บาท\s*=\s*([\d,]+(?:\.\d+)?)\s*บาท/g;

const DELIVERY_PATTERN = /จัดส่ง\s*([\d]{1,2}[/.\-][\d]{1,2}[/.\-][\d]{2,4})/;

const GREETING_PREFIXES = [
  'สรุปยอดนะครับ',
  'สรุปยอดนะคะ',
  'สรุปยอดครับ',
  'สรุปยอดค่ะ',
  'สรุปยอด',
];

function toNumber(str) {
  return Number(String(str).replace(/,/g, ''));
}

function cleanDescription(raw) {
  let text = raw.trim();
  for (const prefix of GREETING_PREFIXES) {
    if (text.startsWith(prefix)) {
      text = text.slice(prefix.length).trim();
      break;
    }
  }
  return text;
}

// Returns null when the text doesn't look like an order summary (no line items found).
function parseOrderSummary(text) {
  if (!text) return null;

  const items = [];
  let match;
  ITEM_PATTERN.lastIndex = 0;
  while ((match = ITEM_PATTERN.exec(text)) !== null) {
    const [, rawDescription, packs, unitPrice, lineTotal] = match;
    const description = cleanDescription(rawDescription);
    if (!description) continue;
    items.push({
      description,
      packs: toNumber(packs),
      unitPrice: toNumber(unitPrice),
      lineTotal: toNumber(lineTotal),
    });
  }

  if (items.length === 0) return null;

  const deliveryMatch = text.match(DELIVERY_PATTERN);
  const deliveryDate = deliveryMatch ? deliveryMatch[1] : null;
  const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);

  return { items, deliveryDate, totalAmount };
}

module.exports = { parseOrderSummary };
