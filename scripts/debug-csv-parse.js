
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../sql/shipments-2026-01-03 (3).csv');
const text = fs.readFileSync(filePath, 'utf-8');
const lines = text.split('\n');

const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
const refIndex = headers.indexOf('Reference #');
const costIndex = headers.indexOf('Label Cost(GBP)');

console.log(`Ref Index: ${refIndex}, Cost Index: ${costIndex}`);

const orderCosts = new Map();
const orderRows = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const values = [];
  let inQuote = false;
  let currentValue = '';

  for (let char of line) {
    if (char === '"') {
      inQuote = !inQuote;
    } else if (char === ',' && !inQuote) {
      values.push(currentValue);
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  values.push(currentValue);

  const orderId = values[refIndex]?.trim().replace(/^"|"$/g, '');
  const costStr = values[costIndex]?.trim().replace(/^"|"$/g, '');

  if (orderId === '026-6540232-5125960') {
    console.log(`Found row for ${orderId}: Cost=${costStr}`);
    orderRows.push({ orderId, costStr });
  }

  if (orderId && costStr) {
    const cost = parseFloat(costStr);
    if (!isNaN(cost)) {
      const currentTotal = orderCosts.get(orderId) || 0;
      orderCosts.set(orderId, currentTotal + cost);
    }
  }
}

console.log('Total for 026-6540232-5125960:', orderCosts.get('026-6540232-5125960'));
