const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ORDERS_JSON_PATH = path.join(DATA_DIR, 'orders.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadOrders() {
  ensureDataDir();
  if (!fs.existsSync(ORDERS_JSON_PATH)) return [];
  try {
    const raw = fs.readFileSync(ORDERS_JSON_PATH, 'utf8');
    return raw.trim() ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to read orders.json, starting fresh:', err);
    return [];
  }
}

function nextPoNumber(orders) {
  const today = new Date();
  const datePart = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('');
  const countToday = orders.filter((o) => o.poNumber.includes(`PO-${datePart}-`)).length;
  const seq = String(countToday + 1).padStart(3, '0');
  return `PO-${datePart}-${seq}`;
}

// order: { source, rawText, items, deliveryDate, totalAmount }
function saveOrder(order) {
  ensureDataDir();
  const orders = loadOrders();
  const record = {
    poNumber: nextPoNumber(orders),
    createdAt: new Date().toISOString(),
    ...order,
  };
  orders.push(record);
  fs.writeFileSync(ORDERS_JSON_PATH, JSON.stringify(orders, null, 2), 'utf8');
  return record;
}

function csvEscape(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function ordersToCsv(orders) {
  const header = [
    'PO Number',
    'Created At',
    'Source',
    'Customer Name',
    'Item Description',
    'Packs',
    'Unit Price',
    'Line Total',
    'Delivery Date',
    'Order Total',
  ];
  const rows = [header.map(csvEscape).join(',')];

  for (const order of orders) {
    for (const item of order.items) {
      rows.push(
        [
          order.poNumber,
          order.createdAt,
          order.source || '',
          order.customerName || '',
          item.description,
          item.packs,
          item.unitPrice,
          item.lineTotal,
          order.deliveryDate || '',
          order.totalAmount,
        ]
          .map(csvEscape)
          .join(',')
      );
    }
  }

  return rows.join('\n') + '\n';
}

module.exports = { loadOrders, saveOrder, ordersToCsv, ORDERS_JSON_PATH };
