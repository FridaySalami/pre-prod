import * as XLSX from 'xlsx';

// Types matching the Python script's logic
interface SalesReportRow {
  [key: string]: string | number | undefined;
}

interface ProcessedProduct {
  SKU: string;
  Product_Title: string;
  ASIN: string;

  Old_Sales: number;
  New_Sales: number;
  Sales_Change: number;
  Sales_Change_Percent: number;

  Old_Units: number;
  New_Units: number;
  Units_Change: number;
  Units_Change_Percent: number;

  Old_Sessions: number;
  New_Sessions: number;
  Sessions_Change: number;

  Old_Page_Views: number;
  New_Page_Views: number;
  Page_Views_Change: number;

  Old_Conversion: number;
  New_Conversion: number;
  Conversion_Change: number;

  Old_BuyBox: number;
  New_BuyBox: number;
  BuyBox_Change: number;

  Status: 'NO_PREV_SALES' | 'DISCONTINUED' | 'INCREASE' | 'DECREASE' | 'STABLE';
}

interface AnalysisResult {
  summary: {
    total_old_sales: number;
    total_new_sales: number;
    total_change: number;
    total_change_percent: number;
    product_count: number;
  };
  top_movers: {
    sales_increases: Partial<ProcessedProduct>[];
    sales_decreases: Partial<ProcessedProduct>[];
    buybox_increases: Partial<ProcessedProduct>[];
    buybox_decreases: Partial<ProcessedProduct>[];
    buybox_sales_impact: Partial<ProcessedProduct>[];
    buybox_sales_gain: Partial<ProcessedProduct>[];
  };
  products: ProcessedProduct[];
}

// Helper parsing functions
function parseCurrency(value: any): number {
  if (value === undefined || value === null || value === '') return 0.0;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[£,]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0.0 : parsed;
}

function parsePercentage(value: any): number {
  if (value === undefined || value === null || value === '') return 0.0;
  if (typeof value === 'number') return value * 100; // XLSX might read 50% as 0.5
  const cleaned = String(value).replace(/[%]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0.0 : parsed;
}

function parseNumber(value: any): number {
  if (value === undefined || value === null || value === '') return 0.0;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[,]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0.0 : parsed;
}

// Main logic
export async function analyzeSales(oldBuffer: Buffer, newBuffer: Buffer): Promise<{ analysis: AnalysisResult, excelBuffer: Buffer }> {
  const oldData = readCsv(oldBuffer);
  const newData = readCsv(newBuffer);
  return analyzeSalesData(oldData, newData);
}

export async function analyzeSalesData(oldData: any[], newData: any[]): Promise<{ analysis: AnalysisResult, excelBuffer: Buffer }> {
  // Group by SKU
  const oldBySku = aggregateBySku(oldData);
  const newBySku = aggregateBySku(newData);

  // Collect all SKUs
  const allSkus = new Set([...oldBySku.keys(), ...newBySku.keys()]);

  const products: ProcessedProduct[] = [];

  for (const sku of allSkus) {
    if (!sku) continue;

    const oldItem = oldBySku.get(sku);
    const newItem = newBySku.get(sku);

    // Metadata
    const Product_Title = String((newItem?.['Title'] || oldItem?.['Title']) || 'Unknown');
    const ASIN = String((newItem?.['(Child) ASIN'] || oldItem?.['(Child) ASIN']) || 'Unknown');

    // Extract Metrics
    const Old_Sales = oldItem ? oldItem['Ordered Product Sales'] : 0;
    const New_Sales = newItem ? newItem['Ordered Product Sales'] : 0;
    const Sales_Change = New_Sales - Old_Sales;

    let Sales_Change_Percent = 0;
    if (Old_Sales > 0) Sales_Change_Percent = (Sales_Change / Old_Sales) * 100;
    else if (New_Sales > 0) Sales_Change_Percent = 100.0;

    const Old_Units = oldItem ? oldItem['Units ordered'] : 0;
    const New_Units = newItem ? newItem['Units ordered'] : 0;
    const Units_Change = New_Units - Old_Units;

    let Units_Change_Percent = 0;
    if (Old_Units > 0) Units_Change_Percent = (Units_Change / Old_Units) * 100;
    else if (New_Units > 0) Units_Change_Percent = 100.0;

    const Old_Sessions = oldItem ? oldItem['Sessions – Total'] : 0;
    const New_Sessions = newItem ? newItem['Sessions – Total'] : 0;
    const Sessions_Change = New_Sessions - Old_Sessions;

    const Old_Page_Views = oldItem ? oldItem['Page views – Total'] : 0;
    const New_Page_Views = newItem ? newItem['Page views – Total'] : 0;
    const Page_Views_Change = New_Page_Views - Old_Page_Views;

    const Old_Conversion = oldItem ? oldItem['Unit Session Percentage'] : 0;
    const New_Conversion = newItem ? newItem['Unit Session Percentage'] : 0;
    const Conversion_Change = New_Conversion - Old_Conversion;

    const Old_BuyBox = oldItem ? oldItem['Featured Offer (Buy Box) percentage'] : 0;
    const New_BuyBox = newItem ? newItem['Featured Offer (Buy Box) percentage'] : 0;
    const BuyBox_Change = New_BuyBox - Old_BuyBox;

    // Status
    let Status: ProcessedProduct['Status'] = 'STABLE';
    if (Old_Sales === 0 && New_Sales > 0) Status = 'NO_PREV_SALES';
    else if (Old_Sales > 0 && New_Sales === 0) Status = 'DISCONTINUED';
    else if (Sales_Change_Percent > 20) Status = 'INCREASE';
    else if (Sales_Change_Percent < -20) Status = 'DECREASE';

    products.push({
      SKU: sku,
      Product_Title,
      ASIN,
      Old_Sales, New_Sales, Sales_Change: parseFloat(Sales_Change.toFixed(2)), Sales_Change_Percent: parseFloat(Sales_Change_Percent.toFixed(2)),
      Old_Units, New_Units, Units_Change, Units_Change_Percent: parseFloat(Units_Change_Percent.toFixed(2)),
      Old_Sessions, New_Sessions, Sessions_Change,
      Old_Page_Views, New_Page_Views, Page_Views_Change,
      Old_Conversion, New_Conversion, Conversion_Change: parseFloat(Conversion_Change.toFixed(2)),
      Old_BuyBox, New_BuyBox, BuyBox_Change: parseFloat(BuyBox_Change.toFixed(2)),
      Status
    });
  }

  // Sort by New Sales Descending
  products.sort((a, b) => b.New_Sales - a.New_Sales);

  // Helper for generating top lists
  const getTop = (sorter: (a: ProcessedProduct, b: ProcessedProduct) => number, limit = 5, fields: (keyof ProcessedProduct)[]) => {
    return [...products].sort(sorter).slice(0, limit).map(p => {
      const result: any = { SKU: p.SKU, Product_Title: p.Product_Title };
      fields.forEach(f => result[f] = p[f]);
      return result;
    });
  };

  const top_sales_increases = getTop((a, b) => b.Sales_Change - a.Sales_Change, 5, ['Sales_Change', 'Sales_Change_Percent']);
  const top_sales_decreases = getTop((a, b) => a.Sales_Change - b.Sales_Change, 5, ['Sales_Change', 'Sales_Change_Percent']);

  const top_buybox_increases = getTop((a, b) => b.BuyBox_Change - a.BuyBox_Change, 5, ['BuyBox_Change', 'New_BuyBox']);
  const top_buybox_decreases = getTop((a, b) => a.BuyBox_Change - b.BuyBox_Change, 5, ['BuyBox_Change', 'New_BuyBox']);

  // Buy Box Impact Logic
  const salesLoss = products
    .filter(p => p.BuyBox_Change < -3 && p.Sales_Change < 0)
    .sort((a, b) => a.Sales_Change - b.Sales_Change) // Most negative first
    .slice(0, 5)
    .map(p => ({ SKU: p.SKU, Product_Title: p.Product_Title, Sales_Change: p.Sales_Change, BuyBox_Change: p.BuyBox_Change }));

  const salesGain = products
    .filter(p => p.BuyBox_Change > 3 && p.Sales_Change > 0)
    .sort((a, b) => b.Sales_Change - a.Sales_Change) // Most positive first
    .slice(0, 5)
    .map(p => ({ SKU: p.SKU, Product_Title: p.Product_Title, Sales_Change: p.Sales_Change, BuyBox_Change: p.BuyBox_Change }));

  // Summary Stats
  const total_old_sales = products.reduce((acc, p) => acc + p.Old_Sales, 0);
  const total_new_sales = products.reduce((acc, p) => acc + p.New_Sales, 0);
  const total_change = total_new_sales - total_old_sales;
  const total_change_percent = total_old_sales > 0 ? (total_change / total_old_sales) * 100 : 0;

  const analysis: AnalysisResult = {
    summary: {
      total_old_sales: parseFloat(total_old_sales.toFixed(2)),
      total_new_sales: parseFloat(total_new_sales.toFixed(2)),
      total_change: parseFloat(total_change.toFixed(2)),
      total_change_percent: parseFloat(total_change_percent.toFixed(2)),
      product_count: products.length
    },
    top_movers: {
      sales_increases: top_sales_increases,
      sales_decreases: top_sales_decreases,
      buybox_increases: top_buybox_increases,
      buybox_decreases: top_buybox_decreases,
      buybox_sales_impact: salesLoss,
      buybox_sales_gain: salesGain
    },
    products
  };

  // Excel Generation using SheetJS
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Top Line Analysis
  // We have to build this sheet cell by cell because it's multiple tables stacked
  const ws1Data: any[][] = [];

  // Summary
  ws1Data.push(['Metric', 'Value']);
  ws1Data.push(['Previous Total Sales', total_old_sales]);
  ws1Data.push(['Current Total Sales', total_new_sales]);
  ws1Data.push(['Net Change', total_change]);
  ws1Data.push(['% Change', total_change_percent / 100]); // Percentage format
  ws1Data.push([]);

  const addSection = (title: string, data: any[]) => {
    ws1Data.push([title]);
    if (data.length > 0) {
      // Get headers from first item
      const headers = Object.keys(data[0]);
      ws1Data.push(headers);
      data.forEach(item => {
        ws1Data.push(headers.map(h => item[h]));
      });
    } else {
      ws1Data.push(['No significant data']);
    }
    ws1Data.push([]);
  };

  addSection('Top Sales Movers - Biggest Increases', top_sales_increases);
  addSection('Top Sales Movers - Biggest Drops', top_sales_decreases);
  addSection('Buy Box Stability - Biggest Gains', top_buybox_increases);
  addSection('Buy Box Stability - Biggest Drops', top_buybox_decreases);
  addSection('Buy Box Sales Impact - Sales Gained (BB Increase)', salesGain);
  addSection('Buy Box Sales Impact - Sales Lost (BB Decrease)', salesLoss);

  const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
  XLSX.utils.book_append_sheet(workbook, ws1, "Top Line Analysis");

  // Sheet 2: Product Performance Review
  const ws2 = XLSX.utils.json_to_sheet(products);
  XLSX.utils.book_append_sheet(workbook, ws2, "Product Performance Review");

  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return { analysis, excelBuffer };
}

function readCsv(buffer: Buffer): any[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  // Use raw: false to let XLSX handle some format detection, but we often parse manually
  // Actually, csv often comes in as raw strings.
  const rawData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
  return rawData;
}

function aggregateBySku(data: any[]): Map<string, any> {
  const map = new Map<string, any>();

  // Numeric columns to sum
  const numericCols = [
    'Sessions – Total', 'Sessions – Total – B2B',
    'Page views – Total', 'Page views – Total – B2B',
    'Units ordered', 'Units ordered – B2B',
    'Total order items', 'Total order items – B2B',
    'Ordered Product Sales', 'Ordered product sales – B2B'
  ];

  // Percentage columns - we take the FIRST occurrence (based on Python script using .first() for non-numeric)
  // Actually Python .update() logic implies it sums numeric columns and keeps metadata from first.
  // Percentages are NOT summed, they are metadata in this logic, which is slightly imperfect but matches Python script.

  for (const row of data) {
    // Clean keys - remove spaces
    const cleanRow: any = {};
    for (const k of Object.keys(row)) {
      const cleanKey = k.trim();
      cleanRow[cleanKey] = row[k];
    }

    const sku = cleanRow['SKU'];
    if (!sku) continue;

    // Parse numerics right away
    for (const col of numericCols) {
      if (col.includes('Ordered Product Sales') || col.includes('Ordered product sales')) {
        cleanRow[col] = parseCurrency(cleanRow[col]);
      } else {
        cleanRow[col] = parseNumber(cleanRow[col]);
      }
    }

    // Parse percentages
    const percentCols = [
      'Session percentage – Total', 'Session percentage – Total – B2B',
      'Page views percentage – Total', 'Page views percentage – Total – B2B',
      'Featured Offer (Buy Box) percentage', 'Featured Offer (Buy Box) percentage – B2B',
      'Unit Session Percentage', 'Unit session percentage – B2B'
    ];

    for (const col of percentCols) {
      cleanRow[col] = parsePercentage(cleanRow[col]);
    }

    if (map.has(sku)) {
      const existing = map.get(sku);
      // Sum numeric cols
      for (const col of numericCols) {
        existing[col] = (existing[col] || 0) + (cleanRow[col] || 0);
      }
      // Keep existing metadata/percentages
    } else {
      map.set(sku, cleanRow);
    }
  }
  return map;
}

export function transformReportToRows(reportData: any, titleMap?: Map<string, string>): any[] {
    const rows: any[] = [];
    
    // The report has salesAndTrafficByAsin which is aggregated by SKU (as requested)
    const asinData = reportData.salesAndTrafficByAsin || [];

    for (const item of asinData) {
        const sales = item.salesByAsin || {};
        const traffic = item.trafficByAsin || {};
        const childAsin = item.childAsin;
        const sku = item.sku?.trim(); // Trim for lookup consistency
        
        let title = 'Unknown Product';
        
        if (sku) {
            if (titleMap?.has(sku)) {
                title = titleMap.get(sku)!;
            } else {
                title = sku;
            }
        } else if (childAsin) {
            title = childAsin;
        }

        rows.push({
            'SKU': sku || 'N/A',
            'Title': title, 
            '(Child) ASIN': childAsin,
            
            // Metrics
            'Ordered Product Sales': sales.orderedProductSales?.amount || 0,
            'Units ordered': sales.unitsOrdered || 0,
            'Sessions – Total': traffic.sessions || 0,
            'Page views – Total': traffic.pageViews || 0,
            // API returns percentages as 0-100 (e.g. 12.5), but analyzer expects 0-1 (e.g. 0.125) for numbers
            'Unit Session Percentage': (traffic.unitSessionPercentage || 0) / 100,
            'Featured Offer (Buy Box) percentage': (traffic.buyBoxPercentage || 0) / 100
        });
    }

    return rows;
}
