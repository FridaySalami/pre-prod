const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

const skus = [
  "OIL02H - 001", "Chef William - 001 Uk shipping", "ACC01 - 001", "OSPRIO019 - 001",
  "HON27C - 002", "ACC01 - 001 uk shipping", "CAL02 - 011 Prime", "MONINS27 - 003",
  "BAK01B - 001", "CHO31B - 016", "CRI35 - 002  One Day", "CAL03A - 012",
  "CAL03 - 010 Prime", "CHO31B - 014", "OIL02H - 001 Prime", "ELSIN001 - 005 Prime",
  "GRA05 - 004 Prime", "ESS13 - 010 Prime", "VIN22B", "VIN16B - 002 Prime",
  "UHT31B - 003 Prime", "ELSIN001 - 006 Prime", "FAT00C - 001 Prime", "BAR29 - 002",
  "FRU60B - 003 Prime", "CRI50 - 001", "ORI09C - 001", "WRA02 - 001",
  "OIL02I - 001 One day", "UHT03B - 001 Prime", "CRI10 uk shipping", "TAYLOR001 - 001",
  "BUNDLE001 - 002", "TAYLOR010 - 004 Prime", "MED07E - 001 Prime", "CRI10  - 003",
  "ELSIN001 - 001", "TAYLOR012 - 001 Prime", "Bundle - 203 Prime", "CRI39 - 001 Prime",
  "CAMBR008 - 002 Prime", "HOT04B - 005", "CRUSHA001 - 003 Prime", "MONINS34 - 001 Prime",
  "BUNDLE007 - 001", "FLORA004 - 001", "PAS03 - 001 Prime", "SPI56A - 001 uk shipping",
  "FAT03C - 001", "BUT25D", "MUSTAR03 - 001 One Day", "DRIPINE001 - 001 Prime",
  "SWE62 - 005 Prime", "CRI50 - 002", "HEI44 - 001 - Prime", "DRI12 Prime",
  "CATER003 - 001", "TAYLOR010 - 002", "SUG16 - 002 Prime", "OIL02I - 001 One day",
  "HON27C - 002 Prime", "Bundle - 009 Prime", "CRUSHA004 - 001", "VIN17 - 001 Prime",
  "VEG15E - 001", "CAL28AB - 001", "TAR10B - 010 Prime", "Bundle - 216 Prime",
  "CRI10", "ELSIN001 - 007", "VEG01E - 001", "VIN60 Prime", "TATECA001 - 002",
  "BAK24 - 002", "ORI300C - 015", "BAK30 - 001 Prime", "SOS06D - 001 Prime",
  "CON12A - Prime", "OIL28 - 001 Prime", "BAK24 - 004", "FOL05 - 002 Prime",
  "PAS03 - 001", "BAR30 - 001 Prime", "CHO31B - 017", "Bundle - 195 Prime",
  "KY-B3GZ-JQ9Y", "VIN10", "CORESA009 - 001 Prime", "CAL04D - 003", "MCD05",
  "ALP09A - 002", "Bundle - 215 Prime", "TATECA002 - 002", "LIO02 - 001 Prime",
  "WRA01 - 001", "JAM03B - 009", "JUS04", "PIC05A - 001", "MED07D - 004 Prime",
  "SEE09 - 001"
];

async function loadMappingFromCsv(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n');
  const mapping = new Map();
  
  if (lines.length < 2) return mapping;
  
  // Use a proper CSV regex that handles quoted fields with commas inside
  const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
  
  // Let's first inspect header to decide delimiter
  const firstLine = lines[0];
  let delimiter = ',';
  if (!firstLine.includes(',') && firstLine.includes('\t')) {
    delimiter = '\t';
  }
  
  const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
  const skuIdx = headers.indexOf('seller-sku');
  const asinIdx = headers.indexOf('asin1');
  const nameIdx = headers.indexOf('item-name');
  
  console.log(`Using delimiter: "${delimiter === '\t' ? '\\t' : delimiter}"`);
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    let cols;
    if (delimiter === ',') {
      // Split by comma NOT inside quotes
      cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    } else {
      cols = line.split('\t');
    }
    
    if (cols.length > Math.max(skuIdx, asinIdx)) {
      const sku = cols[skuIdx]?.trim().replace(/^"|"$/g, '');
      const asin = cols[asinIdx]?.trim().replace(/^"|"$/g, '');
      const name = nameIdx !== -1 ? cols[nameIdx]?.trim().replace(/^"|"$/g, '') : null;
      if (sku && asin) {
        mapping.set(sku, { asin, name });
      }
    }
  }
  
  console.log(`Loaded ${mapping.size} mappings from CSV.`);
  return mapping;
}

async function seed() {
  console.log(`Seeding ${skus.length} SKUs...`);
  
  const csvPath = path.resolve('data/Active+Listings+Report_02-26-2026.csv');
  const csvMapping = await loadMappingFromCsv(csvPath);
  
  for (let i = 0; i < skus.length; i++) {
    const sku = skus[i];
    
    // Attempt to find ASIN from CSV mapping
    let asin = 'PENDING';
    let productName = 'Top Seller ' + (i + 1);
    
    if (csvMapping.has(sku)) {
      const info = csvMapping.get(sku);
      asin = info.asin;
      if (info.name) productName = info.name;
    } else {
      // Fallback: Check Supabase if not in CSV
      const { data: mapping } = await supabase
        .from('sku_asin_mapping')
        .select('asin, product_name')
        .eq('sku', sku)
        .maybeSingle();
        
      if (mapping) {
        asin = mapping.asin;
        if (mapping.product_name) productName = mapping.product_name;
      }
    }

    const { error } = await supabase
      .from('monitored_top_100_skus')
      .upsert({
        sku,
        asin,
        product_name: productName,
        rank: i + 1,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error(`Error seeding SKU ${sku}:`, error.message);
    } else {
      console.log(`[${i+1}/100] Seeded ${sku} (ASIN: ${asin})`);
    }
  }
  
  console.log('Seeding complete.');
}

seed();

async function seed() {
  console.log(`Seeding ${skus.length} SKUs...`);
  
  const csvPath = path.resolve('data/Active+Listings+Report_02-26-2026.csv');
  const csvMapping = await loadMappingFromCsv(csvPath);
  
  for (let i = 0; i < skus.length; i++) {
    const sku = skus[i];
    
    // Attempt to find ASIN from CSV mapping
    let asin = 'PENDING';
    let productName = 'Top Seller ' + (i + 1);
    
    if (csvMapping.has(sku)) {
      const info = csvMapping.get(sku);
      asin = info.asin;
      productName = info.name;
    } else {
      // Fallback: Check Supabase if not in CSV
      const { data: mapping } = await supabase
        .from('sku_asin_mapping')
        .select('asin, product_name')
        .eq('sku', sku)
        .maybeSingle();
        
      if (mapping) {
        asin = mapping.asin;
        if (mapping.product_name) productName = mapping.product_name;
      }
    }

    const { error } = await supabase
      .from('monitored_top_100_skus')
      .upsert({
        sku,
        asin,
        product_name: productName,
        rank: i + 1,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error(`Error seeding SKU ${sku}:`, error.message);
    } else {
      console.log(`[${i+1}/100] Seeded ${sku} (ASIN: ${asin})`);
    }
  }
  
  console.log('Seeding complete.');
}

seed();
