# 📊 Profit Calculation Reference for Buy Box Monitoring

> This document serves as a reference for implementing the profitability calculation logic in the Buy Box Monitoring System. It documents the existing logic in the inventory profit calculator that can be leveraged.

## 🧮 Existing Profit Calculation Logic

The existing profit calculation implementation is found in:
- `/src/routes/api/inventory-profit-calculator/calculate/+server.ts` (single SKU calculation)
- `/src/routes/api/inventory-profit-calculator/summary/+server.ts` (bulk calculation)

## 📋 Cost Components

### Product Cost
```typescript
// Get cost from Linnworks composition data or Sage reports
const cost = linnworksData?.total_value || 0;
```

### Box Cost
```typescript
// Box dimensions
const box = `${String(product.width ?? '')}x${String(product.height ?? '')}x${String(product.depth ?? '')}`;

// Box size cost lookup
const boxSizeCosts = new Map<string, number>([
  ['5.25x5.25x5.25', 0.15],
  ['6.25x6.25x6.25', 0.16],
  // ...other box sizes
]);

const boxCost = boxSizeCosts.get(box) || 0;
```

### Material & Fragile Costs
```typescript
// Material cost (tape, paper, bubblewrap) - fixed value
const materialCost = 0.20;

// Fragile charge lookup for specific SKUs
const fragileSKUs = new Set([
  'Bundle - 008', 'Bundle - 008 Prime', 'CRI23',
  // ...other fragile SKUs
]);
const fragileCharge = fragileSKUs.has(sku) ? 0.66 : 0.00;
```

### VAT Calculation
```typescript
// VAT calculation
let vatCode = 0;
try {
  const vatRates = JSON.parse(linnworksData?.child_vats || '[]');
  vatCode = vatRates[0] || 0;
} catch (e) {
  vatCode = 0;
}
const vatAmount = vatCode === 20 ? cost * 0.2 : 0;
```

### Shipping Cost Calculation
```typescript
// Calculate shipping cost using tier-based logic
const productWeight = product.weight ?? 0;
const productDepth = product.depth ?? 0;
const productHeight = product.height ?? 0;
const productWidth = product.width ?? 0;

const serviceOptions = shippingTable.filter(s => s.service === shipping);

for (const option of serviceOptions) {
  if (productWeight >= option.weightMin && productWeight <= option.weightMax &&
    productDepth >= option.depthMin && productDepth <= option.depthMax &&
    productHeight >= option.heightMin && productHeight <= option.heightMax &&
    productWidth >= option.widthMin && productWidth <= option.widthMax) {
    shippingTier = option.tier;
    shippingCost = option.cost;
    break;
  }
}
```

## 🔢 Profit Calculation

### Total Cost Calculation
```typescript
// Material total cost (all costs combined)
const materialTotalCost = vatAmount + boxCost + materialCost + fragileCharge + cost;
```

### Margin Calculation
```typescript
// Calculate profit metrics
const prProfit = (100 - customMargin) / 100; // Default margin is 23%
const costPlusMargin = cost > 0 ? cost / prProfit : 0;
const marginProfit = costPlusMargin - cost;
```

### Amazon Price & Profit
```typescript
// Amazon price calculation
const amazonPrice = (marginProfit + materialTotalCost + shippingCost) / (1 - customAmazonFee); // Default fee is 15%

// Calculate profit after Amazon fees
const amazonFee = amazonPrice * customAmazonFee;
const profitAfterFees = amazonPrice - amazonFee - materialTotalCost - shippingCost;
const isProfitable = profitAfterFees > 0;
```

## 🚀 Implementation Strategy for Buy Box Monitoring

1. **Retrieve Costs**:
   - Get product cost, box cost, shipping cost, and other costs as in the inventory profit calculator

2. **Calculate Minimum Viable Price**:
   - Determine the minimum price needed for a profit margin of at least 10%
   - Ensure this price is >= the SKU's min_price setting

3. **Compare with Buy Box Price**:
   - If we don't have the Buy Box, compare our minimum viable price with the current Buy Box price
   - If our minimum viable price is less than the Buy Box price, flag this as an opportunity

4. **Set Flag**:
   - Set `opportunity_flag = true` when:
     - `margin > 0`
     - `marginPercent >= 0.10`
     - `buyBoxPrice >= min_price`

## 📝 Notes on Adaptation

- We'll need to adapt the logic to work with Buy Box data
- Some values may need to be pulled from different tables
- We may need to add min_price to the SKU data
- Consider implementing this as a reusable service function
