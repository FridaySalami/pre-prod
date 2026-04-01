import { readFile } from 'fs/promises';
import { join } from 'path';
import { db } from '$lib/supabase/supabaseServer';
import { CostCalculator } from '$lib/server/cost-calculator';

const parseCSV = (text: string) => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // Skip next quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
      if (char === '\r' && nextChar === '\n') i++;
    } else {
      currentCell += char;
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  return rows;
};

const csvRowsToRecords = (rows: string[][]) => {
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] ?? '';
    });
    return obj;
  });
};

const buildListPriceMap = (records: Record<string, string>[]) => {
  const priceMap = new Map<string, number>();
  records.forEach(record => {
    const sku = record['seller-sku'];
    const rawPrice = record['price'];
    if (!sku || !rawPrice) return;
    const price = parseFloat(rawPrice.replace(/[%,£$]/g, '').replace(/,/g, ''));
    if (!Number.isNaN(price)) {
      priceMap.set(sku.trim(), price);
    }
  });
  return priceMap;
};

export const load = async () => {
  const oneDayPath = join(process.cwd(), 'data', 'One Day SKUs-Table 1.csv');
  const activePath = join(process.cwd(), 'data', 'Active+Listings+Report_02-26-2026.csv');

  const [fileContent, activeContent] = await Promise.all([
    readFile(oneDayPath, 'utf-8'),
    readFile(activePath, 'utf-8')
  ]);

  const data = parseCSV(fileContent);
  const rows = csvRowsToRecords(data);

  const activeRows = csvRowsToRecords(parseCSV(activeContent));
  const listPriceMap = buildListPriceMap(activeRows);

  const rowsWithListPrice = rows.map(row => {
    const listPrice = listPriceMap.get(row.SKU);
    return {
      ...row,
      'List Price': listPrice !== undefined ? listPrice.toFixed(2) : ''
    };
  });

  // Enriched rows with calculated costs
  const enrichedRows = await enrichWithCosts(rowsWithListPrice);

  return {
    skuData: enrichedRows
  };
}; // End of load function

async function enrichWithCosts(rows: Record<string, string>[]) {
  // 1. Extract SKUs
  const skus = new Set(rows.map(r => r.SKU).filter(s => s));
  if (skus.size === 0) return rows;

  const skuList = Array.from(skus);

  // 2. Fetch all necessary data
  const [inventoryRes, mappingRes, linnworksRes] = await Promise.all([
    db.from('inventory')
      .select('id, sku, depth, height, width, weight, is_fragile')
      .in('sku', skuList),
    db.from('sku_asin_mapping')
      .select('seller_sku, merchant_shipping_group, item_name')
      .in('seller_sku', skuList),
    db.from('linnworks_composition_summary')
      .select('parent_sku, total_qty, total_value, child_vats')
      .in('parent_sku', skuList)
  ]);

  // 3. Create lookup maps
  const inventoryMap = new Map();
  if (inventoryRes.data) {
    inventoryRes.data.forEach(i => inventoryMap.set(i.sku, i));
  }

  const mappingMap = new Map();
  if (mappingRes.data) {
    mappingRes.data.forEach(m => mappingMap.set(m.seller_sku, m));
  }

  const linnworksMap = new Map();
  if (linnworksRes.data) {
    linnworksRes.data.forEach(l => linnworksMap.set(l.parent_sku, l));
  }

  // 4. Calculate costs
  const calculator = new CostCalculator();

  return rows.map(row => {
    const sku = row.SKU;
    if (!sku) return row;

    const priceStr = row['Buy Box'];
    const price = priceStr ? parseFloat(priceStr.replace(/[%,£$]/g, '').replace(/,/g, '')) : 0;
    const listPriceStr = row['List Price'];
    const parsedListPrice = listPriceStr ? parseFloat(listPriceStr.replace(/,/g, '')) : NaN;
    const referencePrice = Number.isNaN(parsedListPrice) ? price : parsedListPrice;
    const feeBasePrice = referencePrice;

    const product = inventoryMap.get(sku) || {}; // If not found, will rely on defaults or fail gracefully in calculator? 
    // Calculator expects product object. If empty, calculateShippingCost might default to 0.
    // Let's pass what we have.

    const skuMapping = mappingMap.get(sku);
    const linnworksData = linnworksMap.get(sku);
    const productCostValue = typeof linnworksData?.total_value === 'number' ? linnworksData.total_value : null;
    const productCostDisplay = productCostValue !== null ? productCostValue.toFixed(2) : '';

    // Determine if Prime based on 'Shipping Template' column if available, 
    // or just use defaults. 
    // CSV has "Shipping Template". Values: "One Day".  
    // If "Shipping Template" indicates Prime, we could set isPrime: true. 
    // But let's assume standard unless specified otherwise.
    // Actually, if merchant_shipping_group in skuMapping says Prime, calculator uses it.
    // We can pass options if we want to override.

    let calculatedFields = {
      'Calculated Cost': '',
      'Calculated Profit': '',
      'Fulfillment Cost': '',
      'Amazon Fees': '',
      'Margin %': ''
    };

    let costs = null;
    if (inventoryMap.has(sku)) {
      try {
        costs = calculator.calculate(sku, price, product, skuMapping, linnworksData, {
          isPrime: false
        });
      } catch (e) {
        console.error(`Error calculating cost for ${sku}:`, e);
      }
    }

    if (costs) {
      // Calculate Total Cost and Profit
      // Total Cost = materialTotalCost (includes baseCost) + shippingCost + amazonFee
      const amazonFeeFromList = feeBasePrice * 0.15;
      costs.amazonFee = amazonFeeFromList;

      const totalCost = (costs.materialTotalCost || 0) + (costs.shippingCost || 0) + (costs.amazonFee || 0);

      // Profit = Price - Sales VAT - Total Cost
      const profit = referencePrice - (costs.salesVat || 0) - totalCost;
      const margin = referencePrice ? (profit / referencePrice) * 100 : NaN;

      calculatedFields = {
        'Calculated Cost': totalCost.toFixed(2),
        'Calculated Profit': profit.toFixed(2),
        'Fulfillment Cost': (costs.shippingCost || 0).toFixed(2),
        'Amazon Fees': (costs.amazonFee || 0).toFixed(2),
        'Margin %': Number.isNaN(margin) ? '' : margin.toFixed(2)
      };
    }

    return {
      ...row,
      'Product Cost': productCostDisplay,
      ...calculatedFields
    };
  });
}