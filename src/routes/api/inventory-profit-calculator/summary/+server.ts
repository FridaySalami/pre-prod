import { json } from '@sveltejs/kit';
import { db } from '$lib/supabaseServer';

export async function POST() {
  try {
    // For now, just return success as the data is dynamically calculated
    // In the future, you could implement caching or pre-computation here
    return json({ success: true, message: 'Report refreshed successfully.' });
  } catch (e) {
    return json({
      success: false,
      error: e instanceof Error ? e.message : 'Failed to generate report'
    }, { status: 500 });
  }
}

export async function GET({ url }) {
  try {
    // Pagination and search
    const search = url.searchParams.get('search')?.toLowerCase() || '';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);

    // First, check if we can connect to the database and count products
    const { count: productCount } = await db.from('inventory').select('*', { count: 'exact', head: true });
    console.log('Total products in inventory table:', productCount);

    // Fetch ALL products from inventory table (Supabase has a default 1000 limit)
    // We need to fetch in chunks or use range to get all records
    let allProducts: any[] = [];
    let startIndex = 0;
    const chunkSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: chunk, error: chunkError } = await db
        .from('inventory')
        .select(`
          id,
          sku,
          stock_level,
          depth,
          height,
          width,
          purchase_price,
          retail_price,
          title,
          tracked,
          weight
        `)
        .range(startIndex, startIndex + chunkSize - 1);

      if (chunkError) {
        throw new Error(`Failed to fetch inventory: ${chunkError.message}`);
      }

      if (chunk && chunk.length > 0) {
        allProducts = allProducts.concat(chunk);
        startIndex += chunkSize;
        hasMore = chunk.length === chunkSize; // Continue if we got a full chunk
      } else {
        hasMore = false;
      }
    }

    const products = allProducts;

    // Fetch Amazon listings for shipping lookup - fetch all records
    let allAmazonListings: any[] = [];
    let amazonStartIndex = 0;
    let amazonHasMore = true;

    while (amazonHasMore) {
      const { data: amazonChunk, error: amazonChunkError } = await db
        .from('amazon_listings')
        .select('seller_sku, merchant_shipping_group')
        .range(amazonStartIndex, amazonStartIndex + chunkSize - 1);

      if (amazonChunkError) {
        throw new Error(`Failed to fetch Amazon listings: ${amazonChunkError.message}`);
      }

      if (amazonChunk && amazonChunk.length > 0) {
        allAmazonListings = allAmazonListings.concat(amazonChunk);
        amazonStartIndex += chunkSize;
        amazonHasMore = amazonChunk.length === chunkSize;
      } else {
        amazonHasMore = false;
      }
    }

    const amazonListings = allAmazonListings;

    // Fetch Linnworks Composition Summary for cost lookup - fetch all records  
    let allLinnworksComposition: any[] = [];
    let linnworksStartIndex = 0;
    let linnworksHasMore = true;

    while (linnworksHasMore) {
      const { data: linnworksChunk, error: linnworksChunkError } = await db
        .from('linnworks_composition_summary')
        .select('parent_sku, total_value, child_vats, created_at')
        .range(linnworksStartIndex, linnworksStartIndex + chunkSize - 1);

      if (linnworksChunkError) {
        throw new Error(`Failed to fetch Linnworks data: ${linnworksChunkError.message}`);
      }

      if (linnworksChunk && linnworksChunk.length > 0) {
        allLinnworksComposition = allLinnworksComposition.concat(linnworksChunk);
        linnworksStartIndex += chunkSize;
        linnworksHasMore = linnworksChunk.length === chunkSize;
      } else {
        linnworksHasMore = false;
      }
    }

    // Fetch Sage Reports for individual product cost lookup
    let allSageReports: any[] = [];
    let sageStartIndex = 0;
    let sageHasMore = true;

    while (sageHasMore) {
      const { data: sageChunk, error: sageChunkError } = await db
        .from('sage_reports')
        .select('stock_code, standard_cost, tax_rate')
        .range(sageStartIndex, sageStartIndex + chunkSize - 1);

      if (sageChunkError) {
        console.error('Failed to fetch Sage reports:', sageChunkError.message);
        // Continue without sage data rather than failing
        break;
      }

      if (sageChunk && sageChunk.length > 0) {
        allSageReports = allSageReports.concat(sageChunk);
        sageStartIndex += chunkSize;
        sageHasMore = sageChunk.length === chunkSize;
      } else {
        sageHasMore = false;
      }
    }

    const sageReports = allSageReports;
    const linnworksComposition = allLinnworksComposition;

    // Create a lookup map for Amazon shipping data
    const amazonShippingMap = new Map<string, string>();
    (amazonListings || []).forEach(listing => {
      amazonShippingMap.set(listing.seller_sku, listing.merchant_shipping_group || 'Off Amazon');
    });

    // Create a lookup map for Sage Reports (individual product costs)
    const sageCostMap = new Map<string, number>();
    const sageVATMap = new Map<string, number>();
    (sageReports || []).forEach(report => {
      sageCostMap.set(report.stock_code, report.standard_cost || 0);
      sageVATMap.set(report.stock_code, report.tax_rate || 0);
    });

    // Create a lookup map for Linnworks cost data (VLOOKUP equivalent)
    // Use the most recent record for each parent_sku to avoid duplicates
    const linnworksCostMap = new Map<string, number>();
    const linnworksVATMap = new Map<string, number>();

    // Group by parent_sku and take the most recent (last) record
    const costsByParentSku = new Map<string, any>();
    (linnworksComposition || []).forEach(comp => {
      const existingComp = costsByParentSku.get(comp.parent_sku);
      if (!existingComp || new Date((comp as any).created_at) > new Date((existingComp as any).created_at)) {
        costsByParentSku.set(comp.parent_sku, comp);
      }
    });

    // Now build the lookup maps from the deduplicated data
    costsByParentSku.forEach((comp, parentSku) => {
      linnworksCostMap.set(parentSku, comp.total_value || 0);

      // Parse VAT rates from JSON array and get the first VAT rate
      try {
        const vatRates = JSON.parse(comp.child_vats || '[]');
        const firstVATRate = vatRates[0] || 0;
        linnworksVATMap.set(parentSku, firstVATRate);
      } catch (e) {
        linnworksVATMap.set(parentSku, 0);
      }
    });

    // Box size cost lookup map (hardcoded for performance) - Updated to match screenshot
    const boxSizeCosts = new Map<string, number>([
      ['5.25x5.25x5.25', 0.15],        // 5x5x5
      ['6.25x6.25x6.25', 0.16],        // 6x6x6
      ['9.25x6.25x6.25', 0.20],        // 9x6x6
      ['9.25x9.25x9.25', 0.28],        // 9x9x9
      ['0x0x0', 0.00],                 // 0x0x0
      ['12.25x9.25x3.25', 0.22],       // 12x9x3
      ['14.75x11.25x14.75', 1.96],     // 14.5x11x14.5
      ['12.25x9.25x6.25', 0.26],       // 12x9x6
      ['14.25x4.25x4.25', 0.73],       // 14x4x4
      ['14.25x12.25x8.25', 1.67],      // 14x12x8
      ['14.25x10.5x12.25', 0.72],      // 14x10.25x12
      ['16.25x10.25x10.75', 0.73],     // 16x10x10.5
      ['16.25x11.25x7.25', 0.56],      // 16x11x7
      ['18.25x12.25x7.25', 0.46],      // 18x12x7
      ['18.25x12.25x12.25', 0.95],     // 18x12x12
      ['18.25x18.25x18.25', 1.85],     // 18x18x18
      ['Bubble Wrap', 9.33],
      ['Fragile Tape', 0.67],
      ['Pallet Wrap', 4.65],
      ['10.25x8.25x6.25', 0.24],       // 10x8x6
      ['14.25x11.25x9.25', 0.43],      // 14x11x9
      ['15.75x11.75x7.75', 0.70],      // 15.5x11.5x7.5
      ['10.25x7.25x2.25', 0.17],       // 10x7x2
      ['11.25x14.25x3.25', 0.24],      // 11x14x3
      ['14.25x10.25x12.25', 0.72],     // 14x10x12
      ['15.25x10.25x5.25', 1.34],      // 15x10x5
      ['10.25x10.25x10.25', 0.00],     // 10x10x10
      ['15.25x15.25x15.25', 0.00],     // 15x15x15
      ['Maggi Box', 1.52],
      ['20.25x15.25x6.25', 1.52],      // 20x15x6 (Fixed from 10.25x15.25x6.25)
      ['Poly Bag', 0.04]
    ]);

    // Shipping table - hardcoded shipping costs and dimensions
    const shippingTable = [
      { service: 'Nationwide Prime', weightMin: 0, weightMax: 2, depthMin: 0, depthMax: 6.3, heightMin: 0, heightMax: 13.8, widthMin: 0, widthMax: 17.7, tier: 'Prime - up to 2kg', cost: 3.60 },
      { service: 'Nationwide Prime', weightMin: 0, weightMax: 7, depthMin: 0, depthMax: 11.8, heightMin: 0, heightMax: 15.7, widthMin: 0, widthMax: 19.7, tier: 'Prime - up to 7kg', cost: 4.13 },
      { service: 'Nationwide Prime', weightMin: 0, weightMax: 15, depthMin: 0, depthMax: 18.1, heightMin: 0, heightMax: 18.1, widthMin: 0, widthMax: 24, tier: 'Prime - up to 15kg', cost: 5.12 },
      { service: 'Nationwide Prime', weightMin: 0, weightMax: 30, depthMin: 0, depthMax: 30, heightMin: 0, heightMax: 30, widthMin: 0, widthMax: 30, tier: 'Prime - DPD', cost: 6.77 },
      { service: 'Nationwide Prime', weightMin: 0, weightMax: 60, depthMin: 0, depthMax: 30, heightMin: 0, heightMax: 30, widthMin: 0, widthMax: 30, tier: 'Prime - DPD 2+', cost: 9.62 },
      { service: 'UK Shipping', weightMin: 0, weightMax: 2, depthMin: 0, depthMax: 6.3, heightMin: 0, heightMax: 13.8, widthMin: 0, widthMax: 17.7, tier: 'Standard - up to 2kg', cost: 3.03 },
      { service: 'UK Shipping', weightMin: 0, weightMax: 7, depthMin: 0, depthMax: 11.8, heightMin: 0, heightMax: 15.7, widthMin: 0, widthMax: 19.7, tier: 'Standard - up to 7kg', cost: 3.64 },
      { service: 'UK Shipping', weightMin: 0, weightMax: 15, depthMin: 0, depthMax: 18.1, heightMin: 0, heightMax: 18.1, widthMin: 0, widthMax: 24, tier: 'Standard - up to 15kg', cost: 4.84 },
      { service: 'UK Shipping', weightMin: 0, weightMax: 30, depthMin: 0, depthMax: 30, heightMin: 0, heightMax: 30, widthMin: 0, widthMax: 30, tier: 'Standard - Parcel Force', cost: 5.89 },
      { service: 'UK Shipping', weightMin: 0, weightMax: 60, depthMin: 0, depthMax: 30, heightMin: 0, heightMax: 30, widthMin: 0, widthMax: 30, tier: 'Standard - DPD 2+', cost: 9.62 },
      { service: 'Off Amazon', weightMin: 0, weightMax: 2, depthMin: 0, depthMax: 6.3, heightMin: 0, heightMax: 13.8, widthMin: 0, widthMax: 17.7, tier: 'Standard - up to 2kg', cost: 3.03 },
      { service: 'Off Amazon', weightMin: 0, weightMax: 7, depthMin: 0, depthMax: 11.8, heightMin: 0, heightMax: 15.7, widthMin: 0, widthMax: 19.7, tier: 'Standard - up to 7kg', cost: 3.64 },
      { service: 'Off Amazon', weightMin: 0, weightMax: 15, depthMin: 0, depthMax: 18.1, heightMin: 0, heightMax: 18.1, widthMin: 0, widthMax: 24, tier: 'Standard - up to 15kg', cost: 4.84 },
      { service: 'Off Amazon', weightMin: 0, weightMax: 30, depthMin: 0, depthMax: 30, heightMin: 0, heightMax: 30, widthMin: 0, widthMax: 30, tier: 'Standard - Parcel Force', cost: 5.89 },
      { service: 'Off Amazon', weightMin: 0, weightMax: 60, depthMin: 0, depthMax: 30, heightMin: 0, heightMax: 30, widthMin: 0, widthMax: 30, tier: 'Standard - DPD 2+', cost: 9.62 }
    ];

    console.log('Found products:', (products || []).length);
    console.log('Found Amazon listings:', (amazonListings || []).length);
    console.log('Found Linnworks compositions:', (linnworksComposition || []).length);
    console.log('Unique parent SKUs in composition data:', costsByParentSku.size);
    if ((products || []).length > 0) {
      console.log('Sample product:', products![0]);
    }
    if (costsByParentSku.size > 0) {
      console.log('Sample cost mapping:', Array.from(costsByParentSku.entries()).slice(0, 3));
    }

    // If no products found, return helpful message
    if ((products || []).length === 0) {
      return json({
        success: true,
        data: [],
        total: 0,
        message: 'No products found in inventory table.'
      });
    }

    // Transform products into profit calculator format
    let data = (products || []).map(p => {
      const purchasePrice = typeof p.purchase_price === 'number' ? p.purchase_price : 0;
      const retailPrice = typeof p.retail_price === 'number' ? p.retail_price : 0;
      const profit = retailPrice - purchasePrice;
      const profitMargin = retailPrice > 0 ? ((profit / retailPrice) * 100).toFixed(2) : '0.00';

      // VLOOKUP equivalent for shipping - look up SKU in Amazon listings
      const shipping = amazonShippingMap.get(p.sku) || 'Off Amazon';

      // Box dimensions concatenation: CONCAT(Width,"x",Height,"x",Depth) - Fixed order to match lookup table
      const box = `${String(p.width ?? '')}x${String(p.height ?? '')}x${String(p.depth ?? '')}`;

      // Box cost lookup based on box size (for Box Cost column display)
      const boxCost = boxSizeCosts.get(box) || 0;

      // Shipping tier and cost calculation based on weight and dimensions
      const productWeight = p.weight ?? 0;
      const productDepth = p.depth ?? 0;
      const productHeight = p.height ?? 0;
      const productWidth = p.width ?? 0;

      // Find matching shipping tier based on service type, weight, and dimensions
      const shippingService = shipping; // Use the shipping service from Amazon lookup
      let shippingTier = 'No Match';
      let shippingCost = 0;

      // Filter shipping table by service and find best match
      const serviceOptions = shippingTable.filter(s => s.service === shippingService);

      for (const option of serviceOptions) {
        // Check if product fits within weight and dimension constraints
        if (productWeight >= option.weightMin && productWeight <= option.weightMax &&
          productDepth >= option.depthMin && productDepth <= option.depthMax &&
          productHeight >= option.heightMin && productHeight <= option.heightMax &&
          productWidth >= option.widthMin && productWidth <= option.widthMax) {
          shippingTier = option.tier;
          shippingCost = option.cost;
          break; // Take first match (shipping table should be ordered by preference)
        }
      }

      // Material cost (tape, paper, bubblewrap) - fixed value for all products
      const materialCost = 0.20;

      // Fragile charge lookup - hardcoded list of SKUs that require fragile packing
      const fragileSKUs = new Set([
        'Bundle - 008', 'Bundle - 008 Prime', 'CRI23', 'CRI30', 'CRI30 - 002 Prime', 'CRI31', 'CRI31 - 005',
        'CRI33', 'CRI34', 'CRI35', 'CRI37', 'CRI38', 'CRI38 - 001', 'CRI39', 'CRI39 - 001 Prime',
        'Crisps Bundle - 001 Prime', 'Crisps Bundle - 002 Prime', 'Crisps Bundle - 003 Prime',
        'Crisps Bundle - 004 Prime', 'Crisps Bundle - 005 Prime', 'Crisps Bundle - 006 Prime',
        'Crisps Bundle - 007 Prime', 'Crisps Bundle - 008 Prime', 'Crisps Bundle - 009 Prime',
        'Crisps Bundle - 010 Prime', 'KY-B3GZ-JQ9Y', 'CRI10', 'CRI10 - 001', 'CRI10 - 002',
        'CRI10 - 002 Prime', 'CRI10 uk shipping', 'Bundle - 159 Prime', 'TAR00', 'TAR02', 'TAR02 - 001 Prime',
        'TAR05C', 'TAR05C - 001', 'TAR10B', 'TAR10B - 010 Prime', 'TAR10B - 011 Prime', 'TAR11', 'TAR11 - 001',
        'TAR14', 'TAR16', 'TAR17', 'TAR31', 'TAR31 - 002', 'TAR31 - 002 uk shipping', 'TAR31 - 003 Prime',
        'TAR31-001', 'TAR31-001 Prime', 'TAR31A', 'TAR31A - 001 Prime', 'TAR32', 'TAR32 - 001', 'TAR32 - 001 Prime',
        'TAR34', 'TAR34A', 'TAR34A - 001 Prime', 'TAR35', 'TAR36', 'TAR36 - 001', 'TAR36A', 'TAR37', 'TAR37 - 001',
        'BAR80', 'BAR80 - 001 Prime', 'BAR80A', 'SWE01', 'SWE01 - 005', 'SWE01 - 005 Prime', 'SWE01 - 006',
        'SWE01 - 006 Prime', 'SWE01 - 007', 'SWE01 - 007 Prime', 'SWE01 - 008', 'SWE01 - 008 Prime',
        'SWE01 - 009', 'SWE01 - 009 Prime', 'SWE01 - 010', 'SWE01 - 010 Prime', 'SWE01 - 011', 'SWE01 - 011 Prime',
        'SWE01 - 012', 'SWE01 - 012 Prime', 'SWE71F', 'SWE71F - 101', 'SWE71F - 102', 'SWE71F - 103',
        'SWE71G', 'SWE71H', 'BODER002 - 005', 'BODER002 - 005 - prime', 'BORDER002', 'BORDER002 - 003',
        'BORDER002 - 003 - Prime', 'BORDER002 - 004', 'BORDER002 - 004 Prime', 'BORDER002 - 006',
        'BORDER002 - 006 Prime', 'BORDER002 - 007', 'BORDER002 - 008', 'BORDER002 - 008 Prime',
        'BORDER002 - 010', 'BORDER002 - 011', 'BORDER002 - 011 Prime', 'BORDER002 - 012', 'BORDER002 - 012 Prime',
        'BORDER02 - 001', 'Bundle - 149 Prime', 'SOUTHD001 - 001', 'SOUTHD002 - 001', 'SOUTHD003 - 001',
        'SOUTHD004 - 001', 'COR50 - 001 Prime', 'COR50 - 004 Prime', 'COR50 - 102', 'COR51 - 005 Prime',
        'COR51 - 102', 'COR52 - 002 Prime', 'COR52 - 102', 'WATER009 - 001', 'WATER005 - 002 Prime',
        'PES07C - 001 Prime', 'SOUTHD009 - 001', 'SOUTHD005 - 001 Prime', 'SOUTHD008 - 001 Prime'
      ]);
      const fragileCharge = fragileSKUs.has(p.sku) ? 0.66 : 0.00;

      // Debug: Log when box size is not found
      if (boxCost === 0 && box !== '0x0x0' && box !== 'xxx') {
        console.log(`Box size not found in lookup: "${box}" for SKU: ${p.sku}`);
      }

      // Cost lookup: first try Linnworks composition, then fallback to Sage reports
      const cost = linnworksCostMap.get(p.sku) || sageCostMap.get(p.sku) || 0;

      // VAT Code lookup: first try Linnworks composition, then fallback to Sage reports
      const vatCode = linnworksVATMap.get(p.sku) || sageVATMap.get(p.sku) || 0;

      // Calculate VAT: IF(vatCode=20, cost*0.2, 0)
      const vatAmount = vatCode === 20 ? cost * 0.2 : 0;

      // Calculate Material Total Cost: sum of VAT, Box Cost, Material Cost, Fragile Charge, and Cost of item (as per Excel)
      const materialTotalCost = vatAmount + boxCost + materialCost + fragileCharge + cost;

      // Calculation columns
      const marginPercent = 23; // Default value for all products
      const prProfit = (100 - marginPercent) / 100; // (100-23)/100 = 0.77
      const costPlusMargin = cost > 0 ? cost / prProfit : 0; // Cost/PRProfit

      // Calculate profit (Cost + Margin - Cost = just the margin portion)
      const marginProfit = costPlusMargin - cost;

      // Calculate Amazon Price exactly like Excel: (Profit + Material Total Cost + Shipping Cost) / (1 - 0.15)
      const amazonPrice = (marginProfit + materialTotalCost + shippingCost) / (1 - 0.15);

      return {
        id: p.id,
        sku: p.sku,
        stockLevel: p.stock_level ?? 0,
        depth: String(p.depth ?? ''),
        height: String(p.height ?? ''),
        width: String(p.width ?? ''),
        box,
        purchasePrice,
        retailPrice,
        title: p.title,
        tracked: p.tracked ? 'Yes' : 'No',
        weight: p.weight ?? 0,
        shipping,
        shippingTier,
        shippingCost,
        cost,
        boxCost,
        materialCost,
        fragileCharge,
        vatCode,
        vatAmount,
        marginPercent,
        prProfit,
        costPlusMargin,
        materialTotalCost,
        amazonPrice,
        profit,
        profitMargin: `${profitMargin}%`
      };
    });

    // Apply search filter
    if (search) {
      data = data.filter(row =>
        row.sku?.toLowerCase().includes(search) ||
        row.title?.toLowerCase().includes(search) ||
        String(row.id).includes(search)
      );
    }

    const total = data.length;
    const paginationStart = (page - 1) * limit;
    const paginationEnd = paginationStart + limit;
    const paginatedData = data.slice(paginationStart, paginationEnd);

    return json({ success: true, data: paginatedData, total });
  } catch (e) {
    return json({
      success: false,
      error: e instanceof Error ? e.message : 'Unknown error'
    }, { status: 500 });
  }
}
