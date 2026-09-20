// Appends parsed orders as new rows into a working copy of the master "FORM" order
// sheet (same header layout as ใบคำสั่งซื้อ-2026 - Test.xlsx), so entries can be
// copy/pasted (or the file swapped in directly) into the real master workbook.

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { matchProductColumns } = require('./formColumnMap');

const FORM_PATH = process.env.ORDERS_FORM_PATH || path.join(__dirname, '..', 'data', 'orders-form.xlsx');

// Product-code header (row 1 of FORM) — only the cells that are actually set.
const HEADER_ROW1 = {
  V: 'C13', Y: 'C18', AB: 'G16', AD: 'TN18', AG: 'H18', AJ: 'HG18', AL: 'T13', AO: 'T18',
  AR: 'TG', AT: 'T200', AV: 'T12', AY: 'H12', BB: 'K12', BE: 'H70', BH: 'K80', BK: 'HB90',
  BN: 'KB12', BQ: 'U12', BT: 'มรกต', BW: 'หมูล้วน', BY: 'LM13', CA: 'LM18', CC: 'P05',
  CF: 'P14', CI: 'P45', CL: 'PK G', CN: 'PK200', CP: 'รินทิพย์', CS: 'มีสุข', CV: 'มังกรทอง',
  CY: 'Tank', DE: 'ราคาเฉลี่ย',
};

// Column titles (row 2 of FORM).
const HEADER_ROW2 = {
  A: 'วันที่สั่ง', B: 'นัดส่ง', C: 'ลูกค้า', D: 'ชื่อเดิมลูกค้า', E: 'Sale', F: 'Cr.',
  G: 'เก็บ (เงื่อนไขเก็บเงิน)', H: 'เวลาส่ง', I: 'ตลาด', J: 'รายละเอียดจัดส่ง/เปิดบิล',
  K: 'แขวง', L: 'เขต', M: 'เขตจัดส่งที่สินค้า', N: 'จังหวัด', O: 'รหัสไปรษณีย์',
  P: 'เบอร์โทรศัพท์', Q: 'AIC(เลขตั๋ว)', R: 'เลข PO.(สั่งซื้อ)', S: 'COA',
  T: 'ประเภทบิล INV/EXV', U: 'หมายเหตุ',
};

async function loadOrCreateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  if (fs.existsSync(FORM_PATH)) {
    await workbook.xlsx.readFile(FORM_PATH);
    return workbook;
  }
  const sheet = workbook.addWorksheet('FORM');
  for (const [col, value] of Object.entries(HEADER_ROW1)) sheet.getCell(`${col}1`).value = value;
  for (const [col, value] of Object.entries(HEADER_ROW2)) sheet.getCell(`${col}2`).value = value;
  return workbook;
}

function nextDataRow(sheet) {
  let row = 3;
  while (sheet.getCell(`A${row}`).value) row++;
  return row;
}

// order: { orderDate, deliveryDate, customerName, poNumber, items, rawText }
async function appendOrderRow(order) {
  const workbook = await loadOrCreateWorkbook();
  const sheet = workbook.getWorksheet('FORM');
  const row = nextDataRow(sheet);

  sheet.getCell(`A${row}`).value = order.orderDate;
  sheet.getCell(`B${row}`).value = order.deliveryDate || '';
  sheet.getCell(`C${row}`).value = order.customerName || '';
  sheet.getCell(`R${row}`).value = order.poNumber;

  const unmapped = [];
  for (const item of order.items) {
    const mapping = matchProductColumns(item.description);
    if (mapping) {
      sheet.getCell(`${mapping.qtyCol}${row}`).value = item.packs;
      if (mapping.priceCol) sheet.getCell(`${mapping.priceCol}${row}`).value = item.unitPrice;
    } else {
      unmapped.push(`${item.description} x${item.packs} ลัง @ ${item.unitPrice} บาท`);
    }
  }

  const noteParts = [];
  if (unmapped.length) noteParts.push(`[ไม่พบรหัสสินค้า] ${unmapped.join('; ')}`);
  if (order.rawText) noteParts.push(order.rawText);
  sheet.getCell(`U${row}`).value = noteParts.join(' | ');

  fs.mkdirSync(path.dirname(FORM_PATH), { recursive: true });
  await workbook.xlsx.writeFile(FORM_PATH);
  return { path: FORM_PATH, row, unmappedCount: unmapped.length };
}

module.exports = { appendOrderRow, FORM_PATH };
