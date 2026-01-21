import { json } from '@sveltejs/kit';
import { db } from '$lib/supabaseServer';

export async function GET({ url }) {
  try {
    const sku = url.searchParams.get('sku');
    if (!sku) {
      return json({ success: false, error: 'SKU parameter is required' }, { status: 400 });
    }

    // Get custom parameters with defaults
    const customShippingCost = url.searchParams.get('shippingCost') ?
      parseFloat(url.searchParams.get('shippingCost')!) : null;
    const customMargin = url.searchParams.get('margin') ?
      parseFloat(url.searchParams.get('margin')!) : 23;
    const customAmazonFee = url.searchParams.get('amazonFee') ?
      parseFloat(url.searchParams.get('amazonFee')!) : 0.15;

    // Fetch the specific product
    const { data: product, error: productError } = await db
      .from('inventory')
      .select(`
        id,
        sku,
        stock_level,
        depth,
        height,
        width,
        is_fragile,
        title,
        tracked,
        weight
      `)
      .eq('sku', sku)
      .single();

    if (productError || !product) {
      return json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    // Fetch Amazon listings for shipping lookup
    const { data: amazonListing } = await db
      .from('amazon_listings')
      .select('merchant_shipping_group')
      .eq('seller_sku', sku)
      .single();

    // Fetch Linnworks data for cost lookup
    const { data: linnworksData } = await db
      .from('linnworks_composition_summary')
      .select('total_value, child_vats')
      .eq('parent_sku', sku)
      .single();

    // Extract shipping service
    const shipping = amazonListing?.merchant_shipping_group || 'Off Amazon';

    // Box dimensions
    const box = `${String(product.width ?? '')}x${String(product.height ?? '')}x${String(product.depth ?? '')}`;

    // Box size cost lookup (same as in summary API)
    const boxSizeCosts = new Map<string, number>([
      ['5.25x5.25x5.25', 0.15],
      ['6.25x6.25x6.25', 0.16],
      ['9.25x6.25x6.25', 0.20],
      ['9.25x9.25x9.25', 0.28],
      ['0x0x0', 0.00],
      ['12.25x9.25x3.25', 0.22],
      ['14.75x11.25x14.75', 1.96],
      ['12.25x9.25x6.25', 0.26],
      ['14.25x4.25x4.25', 0.73],
      ['14.25x12.25x8.25', 1.67],
      ['14.25x10.5x12.25', 0.72],
      ['16.25x10.25x10.75', 0.73],
      ['16.25x11.25x7.25', 0.56],
      ['18.25x12.25x7.25', 0.46],
      ['18.25x12.25x12.25', 0.95],
      ['18.25x18.25x18.25', 1.85],
      ['Bubble Wrap', 9.33],
      ['Fragile Tape', 0.67],
      ['Pallet Wrap', 4.65],
      ['10.25x8.25x6.25', 0.24],
      ['14.25x11.25x9.25', 0.43],
      ['15.75x11.75x7.75', 0.70],
      ['10.25x7.25x2.25', 0.17],
      ['11.25x14.25x3.25', 0.24],
      ['14.25x10.25x12.25', 0.72],
      ['15.25x10.25x5.25', 1.34],
      ['10.25x10.25x10.25', 0.00],
      ['15.25x15.25x15.25', 0.00],
      ['Maggi Box', 1.52],
      ['20.25x15.25x6.25', 1.52],
      ['Poly Bag', 0.04]
    ]);

    // Shipping table (same as in summary API)
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

    // Calculate costs and metrics (same logic as summary API)
    const cost = linnworksData?.total_value || 0;
    const boxCost = boxSizeCosts.get(box) || 0;
    const materialCost = 0.20;

    // Fragile charge lookup
    const fragileCharge = (product.is_fragile || false) ? 1.00 : 0.00;

    // VAT calculation
    let vatCode = 0;
    try {
      const vatRates = JSON.parse(linnworksData?.child_vats || '[]');
      vatCode = vatRates[0] || 0;
    } catch (e) {
      vatCode = 0;
    }
    const vatAmount = vatCode === 20 ? cost * 0.2 : 0;

    // Material total cost
    const materialTotalCost = vatAmount + boxCost + materialCost + fragileCharge + cost;

    // Calculate default shipping cost if not provided
    let shippingCost: number;
    let shippingTier = 'Custom';

    if (customShippingCost === null) {
      // Calculate shipping cost using existing logic
      const productWeight = product.weight ?? 0;
      const productDepth = product.depth ?? 0;
      const productHeight = product.height ?? 0;
      const productWidth = product.width ?? 0;

      const serviceOptions = shippingTable.filter(s => s.service === shipping);

      // Initialize to default value
      shippingCost = 0;
      shippingTier = 'No Match';

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
    } else {
      shippingCost = customShippingCost;
    }

    // Calculate profit metrics
    const prProfit = (100 - customMargin) / 100;
    const costPlusMargin = cost > 0 ? cost / prProfit : 0;
    const marginProfit = costPlusMargin - cost;
    const amazonPrice = (marginProfit + materialTotalCost + shippingCost) / (1 - customAmazonFee);

    // Calculate profit after Amazon fees
    const amazonFee = amazonPrice * customAmazonFee;
    const profitAfterFees = amazonPrice - amazonFee - materialTotalCost - shippingCost;
    const isProfitable = profitAfterFees > 0;

    return json({
      success: true,
      data: {
        sku: product.sku,
        title: product.title,
        weight: product.weight,
        box,
        shipping,
        shippingTier,
        cost,
        costPlusMargin,
        marginProfit,
        materialTotalCost,
        shippingCost,
        amazonPrice,
        amazonFee,
        profitAfterFees,
        isProfitable,
        // Custom parameters used
        customMargin,
        customAmazonFee,
        isCustomShipping: customShippingCost !== null
      }
    });

  } catch (e) {
    console.error('Error calculating profit:', e);
    return json({
      success: false,
      error: e instanceof Error ? e.message : 'Unknown error'
    }, { status: 500 });
  }
}
