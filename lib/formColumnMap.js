// Maps a parsed order-item description (e.g. "แฮปปี้ แบบขวด 900 มล.") to the
// product's data columns in the master "FORM" order sheet (ใบคำสั่งซื้อ-2026 - Test.xlsx),
// so the bot can write quantity/price into the right columns automatically.
//
// Product names come from รหัสสินค้า-2026 - Test.xlsx. Quantity/price column letters come
// from the FORM sheet's own money formula (DC column), which reads `<qtyCol> * <priceCol>`
// per product — e.g. `(V3*X3)` for C13, `(BK3*BM3)` for HB90.
//
// Codes present in the FORM header (row 1) that have no known Thai product name yet —
// TN18, H18, U12, มรกต, หมูล้วน, LM13, LM18, P05, P14, P45, "PK G", PK200, รินทิพย์, มีสุข,
// มังกรทอง, Tank — are intentionally left out. Add them the same way once you have their names.

const PRODUCT_COLUMN_MAP = [
  {
    code: 'C13',
    match: [/เชอร์รี่/, /ปี๊บ/, /(^|\D)13\.75(\D|$)/],
    qtyCol: 'V',
    priceCol: 'X',
  },
  {
    code: 'C18',
    match: [/เชอร์รี่/, /ปี๊บ/, /(^|\D)18(\D|$)/],
    qtyCol: 'Y',
    priceCol: 'AA',
  },
  {
    code: 'G16',
    match: [/ธารทอง/, /แกลลอน/, /ลิตร/],
    qtyCol: 'AB',
    priceCol: 'AC',
  },
  {
    code: 'HG18',
    match: [/แฮปปี้/, /แกลลอน/, /(^|\D)18(\D|$)/],
    qtyCol: 'AJ',
    priceCol: 'AK',
  },
  {
    code: 'T13',
    match: [/ธารทอง/, /ปี๊บ/, /(^|\D)13\.75(\D|$)/],
    qtyCol: 'AL',
    priceCol: 'AN',
  },
  {
    code: 'T18',
    match: [/ธารทอง/, /ปี๊บ/, /(^|\D)18(\D|$)/],
    qtyCol: 'AO',
    priceCol: 'AQ',
  },
  {
    code: 'TG',
    match: [/ธารทอง/, /แกลลอน/, /กก/],
    qtyCol: 'AR',
    priceCol: 'AS',
  },
  {
    code: 'T200',
    match: [/ธารทอง/, /ถัง/, /(^|\D)200(\D|$)/],
    qtyCol: 'AT',
    priceCol: 'AU',
  },
  {
    code: 'T12',
    match: [/ธารทอง/, /ถุง/, /1\s*ลิตร/],
    qtyCol: 'AV',
    priceCol: 'AX',
  },
  {
    code: 'H12',
    match: [/แฮปปี้/, /ถุง/, /(^|\D)900(\D|$)/],
    qtyCol: 'AY',
    priceCol: 'BA',
  },
  {
    code: 'K12',
    match: [/คู่ครัว/, /ถุง/, /1\s*ลิตร/],
    qtyCol: 'BB',
    priceCol: 'BD',
  },
  {
    code: 'H70',
    match: [/แฮปปี้/, /ถุง/, /(^|\D)700(\D|$)/],
    qtyCol: 'BE',
    priceCol: 'BG',
  },
  {
    code: 'K80',
    match: [/คู่ครัว/, /ถุง/, /(^|\D)800(\D|$)/],
    qtyCol: 'BH',
    priceCol: 'BJ',
  },
  {
    code: 'HB90',
    match: [/แฮปปี้/, /ขวด/, /(^|\D)900(\D|$)/],
    qtyCol: 'BK',
    priceCol: 'BM',
  },
  {
    code: 'KB12',
    match: [/คู่ครัว/, /ขวด/, /1\s*ลิตร/],
    qtyCol: 'BN',
    priceCol: 'BP',
  },
];

function normalize(text) {
  return text.replace(/\s+/g, ' ').trim();
}

// Returns { code, qtyCol, priceCol } for the first entry whose conditions ALL match, or
// null if unmapped (the caller falls back to logging the raw line in หมายเหตุ).
function matchProductColumns(description) {
  const text = normalize(description);
  for (const entry of PRODUCT_COLUMN_MAP) {
    const isMatch = entry.match.every((pattern) =>
      pattern instanceof RegExp ? pattern.test(text) : text.includes(pattern)
    );
    if (isMatch) return entry;
  }
  return null;
}

module.exports = { PRODUCT_COLUMN_MAP, matchProductColumns };
