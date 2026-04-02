const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

const skus = [
  'OIL02H - 001', 'Chef William - 001 Uk shipping', 'BAK01B - 001', 'OSPRIO019 - 001',
  'OIL02I - 001 One day', 'CAL02 - 011 Prime', 'ACC01 - 001 uk shipping', 'ACC01 - 001',
  'CAL03 - 010 Prime', 'MONINS27 - 003', 'ELSIN001 - 006 Prime', 'CHO31B - 014',
  'CHO31B - 016', 'HON27C - 002', 'CRI35 - 002  One Day', 'OIL02H - 001 Prime',
  'CAL03A - 012', 'UHT31B - 003 Prime', 'GRA05 - 004 Prime', 'HON27C - 002 Prime',
  'FRU60B - 003 Prime', 'ELSIN001 - 005 Prime', 'CRI10', 'ORI09C - 001',
  'Chef William - 001 Prime', 'BUT25D', 'CRI50 - 001', 'OIL02I - 001 One day',
  'ESS13 - 010 Prime', 'BAR29 - 002', 'Bundle - 215 Prime', 'VIN22B',
  'WRA01 - 001', 'SPI56A - 001 uk shipping', 'FAT00C - 001 Prime', 'PAS03 - 001',
  'MONINS34 - 001 Prime', 'TAYLOR012 - 001 Prime', 'Bundle - 203 Prime', 'Bundle - 216 Prime',
  'CAL32A - 001', 'UHT03B - 001 Prime', 'LIO02 - 001 Prime', 'VEG01E - 001',
  'OIL02H - 001 One Day', 'CHO30A - 002 Prime', 'TAYLOR010 - 002', 'TAYLOR001 - 001',
  'UHT31C - 001 Prime', 'CRI10  - 003', 'CAL03 - 013 One Day', 'DRI12 Prime',
  'FLORA004 - 001', 'CAL01 - 015', 'CRI39 - 001 Prime', 'CAMBR008 - 002 Prime',
  'MONINS30 - 006', 'HEI44 - 001 - Prime', 'MED07E - 001 Prime', 'CRUSHA004 - 001',
  'DRIPINE001 - 001 Prime', 'SWE62 - 005 Prime', 'CRI70 - 001 Prime', 'VIN16B - 002 Prime',
  'SUG16 - 002 Prime', 'BAK24 - 004', 'BAK24 - 002', 'MUSTAR03 - 001 One Day',
  'ELSIN001 - 001', 'HEI04 - 001', 'VIN60 Prime', 'CON12A - Prime',
  'FOL05 - 002 Prime', 'MUFFIN024A - 001 One Day', 'FOL07 - 001', 'BUNDLE001 - 002 uk shipping',
  'JUS01A - 001', 'KY-B3GZ-JQ9Y', 'CRUSHA003 - 003 Prime', 'CRUSHA001 - 003 Prime',
  'UHT31B - 008', 'FRU18G - 001', 'COL09', 'SPI71 - 001',
  'CRI10 uk shipping', 'CAL03P', 'BAR30 - 001 Prime', 'HEI44 - 001',
  'PAS06 - 001 Prime', 'ELSIN001 - 007', 'CORESA009 - 001 Prime', 'UHT31B - 008 Prime',
  'ALP01 - 011 Prime', 'CAL04D - 003', 'KETTLE001 - 001', 'OIL03 - 001',
  'MED60A - 002 Prime', 'MED07D - 004 Prime', 'CLE04 - 003 Prime', 'Bundle - 195 Prime',
  'OSPRIO019 - 001 Prime', 'BAK13 - 002', 'VIN22B Prime', 'SOS06D - 001 Prime',
  'CAL04 - 009 One Day', 'TATECA001 - 001', 'MED07D - 004', 'DRI12',
  'NAPKIN103 - 001 One Day', 'TAR10B - 010 Prime', 'PAS70A - 005 Prime', 'MONINT03 - 004',
  'BAK30 - 001 Prime', 'TATESO001B - 002', 'POW01 - 001 Prime', 'BUNDLE007 - 001',
  'CRI71 - 001 Prime', 'OLI07A - 003', 'COR20A - 001', 'ORI60 - 001',
  'ALP09A - 002 Prime', 'ACC01 - 002 Prime', 'KETTLE003 - 001', 'VIN17 - 002 Prime',
  'VIN17 - 001 Prime', 'TATECA001 - 002', 'JUS04', 'CAL03A - 010 Prime',
  'OIL02I - 001', 'VIN10', 'VEG15E - 001', 'MAY22 - 003',
  'Bundle - 009 Prime', 'CRI30 - 002 Prime', 'CLE06A - 005 uk shipping', 'CAL03 - 011 Prime',
  'SOUTHD003 - 001', 'COR20A - 002', 'BUNDLE001 - 002', 'JAM03B - 009',
  'CAL01 - 014', 'PAS06 - 001', 'BAR29 - 001 Prime', 'Bundle - 124 Prime',
  'ORI300C - 015', 'PRETZEL001 - 002', 'PAS66 - 001 Prime', 'GAR02A - 001',
  'TATESO002B - 002', 'STO19 - 002', 'HEI02 - 004', 'CORESA008 - 001 Prime',
  'ACC02 - 005', 'FAT03C - 001', 'UHT31B - 005', 'EAGERT001 - 001',
  'DES03 - 007', 'MCD05', 'JAM03C - 006', 'GLA01 - 005',
  'FRU19A', 'KZ-ITK0-EINK uk shipping', 'CAL32A - 002 Prime', 'DRIMIX001-002',
  'UHT03B - 002 Prime', 'CAL09 - 002 One Day', 'PIC05A - 001 Prime', 'CHO31B - 017',
  'ALP09A - 002', 'UHT31B - 002 Prime', 'CHU36 - 002 Prime', 'OSPRIO007 - 001 Prime',
  'CAL28AB - 001', 'FIL01B - 001 Prime', 'DEC23 - 006 Prime', 'TAR02 - 002',
  'CER05A - 001', 'JUI01 - 001', 'SUG16 - 003 Prime', 'TAR11 - 001',
  'CHO33B - 011', 'ESS18 - 003', 'MCD05E', 'CAL52A',
  'GLA03 - 005', 'GHE01C', 'CAP02B Prime', 'BRE04D - 001',
  'VIN61 - 001 Prime', 'BUT25 - 001 Prime', 'SUG16 - 008', 'UHT03 - 004 Prime',
  'PANKO004 - 001 Prime', 'FAT03C - 001 Prime', 'Alexander Bundle - 001 Prime', 'POT04 - 001 Prime',
  'MUFFIN024 - 003 Prime', 'CAL08A - 007', 'CON01E - 002 Prime', 'CALCRI002 - 001 One Day',
  'VIN24'
];

async function seedSkus() {
  console.log(`Starting seed for ${skus.length} SKUs...`);

  // 1. Get ASINs and names from existing cache to avoid manual entry
  const { data: catalog } = await supabase
    .from('amazon_catalog_cache')
    .select('seller_sku, asin, product_name');

  const catalogMap = new Map(catalog?.map(c => [c.seller_sku, c]) || []);

  // Remove duplicates before seeding to avoid Postgres "ON CONFLICT" errors
  const uniqueSkus = [...new Set(skus.map(s => s.trim()))];
  console.log(`Unique SKUs found: ${uniqueSkus.length}`);

  const entries = uniqueSkus.map((sku, index) => {
    const cached = catalogMap.get(sku);
    return {
      sku: sku,
      asin: cached?.asin || 'PENDING_FETCH',
      product_name: cached?.product_name || sku,
      rank: index + 1
    };
  });

  // 2. Upsert into monitored table
  const { error } = await supabase
    .from('monitored_top_100_skus')
    .upsert(entries, { onConflict: 'sku' });

  if (error) {
    console.error('Error seeding SKUs:', error);
  } else {
    console.log('Successfully seeded monitored SKUs list.');
  }
}

seedSkus();