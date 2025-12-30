import { db } from '$lib/supabaseServer';

export class CostCalculator {
  private boxSizeCosts!: Map<string, number>;
  private fragileSKUs!: Set<string>;
  private shippingTable!: any[];

  constructor() {
    this.initializeLookupTables();
  }

  private initializeLookupTables() {
    // Box size cost lookup
    this.boxSizeCosts = new Map([
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

    // Fragile SKUs
    this.fragileSKUs = new Set([
      'Bundle - 008', 'Bundle - 008 Prime', 'CRI23', 'CRI30', 'CRI30 - 002 Prime', 'CRI31', 'CRI31 - 005',
      'CRI32', 'CRI32 - 020', 'CRI33', 'CRI33 - 014', 'CRI34', 'CRI34 - 017', 'CRI35', 'CRI35 - 027',
      'CRI36', 'CRI36 - 032', 'CRI37', 'CRI37 - 039', 'CRI38', 'CRI38 - 031', 'CRI39', 'CRI39 - 041',
      'CRI40', 'CRI40 - 051', 'EQ01 - 012', 'GLA01', 'GLA01 - 012', 'GLA02', 'GLA02 - 016', 'GLA03',
      'GLA03 - 020', 'GLA04', 'GLA04 - 024', 'GLA05', 'GLA05 - 034', 'GLA06', 'GLA06 - 029', 'GLA07',
      'GLA07 - 033', 'GLA08', 'GLA08 - 037', 'GLA09', 'GLA09 - 045', 'GLA10', 'GLA10 - 049', 'GLA11',
      'GLA11 - 053', 'GLA12', 'GLA12 - 057', 'GLA13', 'GLA13 - 061', 'LIG05', 'LIG05 - 007', 'MUG01',
      'MUG01 - 004', 'MUG02', 'MUG02 - 008', 'MUG03', 'MUG03 - 013', 'MUG04', 'MUG04 - 018', 'MUG05',
      'MUG05 - 023', 'MUG06', 'MUG06 - 028', 'MUG07', 'MUG07 - 036', 'MUG08', 'MUG08 - 040', 'MUG09',
      'MUG09 - 044', 'MUG10', 'MUG10 - 048', 'MUG11', 'MUG11 - 052', 'MUG12', 'MUG12 - 056', 'MUG13',
      'MUG13 - 060', 'PLA01', 'PLA01 - 001', 'PLA02', 'PLA02 - 005', 'PLA03', 'PLA03 - 009', 'PLA04',
      'PLA04 - 015', 'PLA05', 'PLA05 - 019', 'PLA06', 'PLA06 - 025', 'PLA07', 'PLA07 - 030', 'PLA08',
      'PLA08 - 035', 'PLA09', 'PLA09 - 043', 'PLA10', 'PLA10 - 047', 'PLA11', 'PLA11 - 055', 'PLA12',
      'PLA12 - 059', 'TAB01', 'TAB01 - 003', 'TAB02', 'TAB02 - 006', 'TAB03', 'TAB03 - 011', 'TAB04',
      'TAB04 - 017', 'TAB05', 'TAB05 - 022', 'TAB06', 'TAB06 - 026', 'TAB07', 'TAB07 - 038', 'TAB08',
      'TAB08 - 042', 'TAB09', 'TAB09 - 046', 'TAB10', 'TAB10 - 050', 'TAB11', 'TAB11 - 054', 'TAB12',
      'TAB12 - 058', 'TAB13', 'TAB13 - 062'
    ]);

    // Shipping table
    this.shippingTable = [
      { service: 'Nationwide Prime', weightMin: 0, weightMax: 2, depthMin: 0, depthMax: 6.3, heightMin: 0, heightMax: 13.8, widthMin: 0, widthMax: 17.7, tier: 'Prime - up to 2kg', cost: 3.60 },
      { service: 'Nationwide Prime', weightMin: 0, weightMax: 7, depthMin: 0, depthMax: 11.8, heightMin: 0, heightMax: 15.7, widthMin: 0, widthMax: 19.7, tier: 'Prime - up to 7kg', cost: 4.13 },
      { service: 'Nationwide Prime', weightMin: 0, weightMax: 15, depthMin: 0, depthMax: 32, heightMin: 0, heightMax: 32, widthMin: 0, widthMax: 47, tier: 'Prime - up to 15kg', cost: 5.74 },
      { service: 'Nationwide Prime', weightMin: 0, weightMax: 30, depthMin: 0, depthMax: 30, heightMin: 0, heightMax: 30, widthMin: 0, widthMax: 30, tier: 'Prime - DPD', cost: 6.77 },
      { service: 'Nationwide Prime', weightMin: 0, weightMax: 60, depthMin: 0, depthMax: 30, heightMin: 0, heightMax: 30, widthMin: 0, widthMax: 30, tier: 'Prime - DPD 2+', cost: 9.62 },
      { service: 'UK Shipping', weightMin: 0, weightMax: 2, depthMin: 0, depthMax: 6.3, heightMin: 0, heightMax: 13.8, widthMin: 0, widthMax: 17.7, tier: 'Standard - up to 2kg', cost: 3.03 },
      { service: 'UK Shipping', weightMin: 0, weightMax: 7, depthMin: 0, depthMax: 11.8, heightMin: 0, heightMax: 15.7, widthMin: 0, widthMax: 19.7, tier: 'Standard - up to 7kg', cost: 3.64 },
      { service: 'UK Shipping', weightMin: 0, weightMax: 15, depthMin: 0, depthMax: 18.1, heightMin: 0, heightMax: 18.1, widthMin: 0, widthMax: 24, tier: 'Standard - up to 15kg', cost: 4.84 },
      { service: 'UK Shipping', weightMin: 0, weightMax: 30, depthMin: 0, depthMax: 30, heightMin: 0, heightMax: 30, widthMin: 0, widthMax: 30, tier: 'Standard - Parcel Force', cost: 5.89 },
      { service: 'UK Shipping', weightMin: 0, weightMax: 60, depthMin: 0, depthMax: 30, heightMin: 0, heightMax: 30, widthMin: 0, widthMax: 30, tier: 'Standard - DPD 2+', cost: 9.62 },
      { service: 'UK shipping One day', weightMin: 0, weightMax: 2, depthMin: 0, depthMax: 6.3, heightMin: 0, heightMax: 13.8, widthMin: 0, widthMax: 17.7, tier: 'One Day - up to 2kg', cost: 4.13 },
      { service: 'UK shipping One day', weightMin: 0, weightMax: 7, depthMin: 0, depthMax: 11.8, heightMin: 0, heightMax: 15.7, widthMin: 0, widthMax: 19.7, tier: 'One Day - up to 7kg', cost: 4.13 },
      { service: 'UK shipping One day', weightMin: 0, weightMax: 15, depthMin: 0, depthMax: 18.1, heightMin: 0, heightMax: 18.1, widthMin: 0, widthMax: 24, tier: 'One Day - up to 15kg', cost: 4.13 },
      { service: 'UK shipping One day', weightMin: 0, weightMax: 30, depthMin: 0, depthMax: 30, heightMin: 0, heightMax: 30, widthMin: 0, widthMax: 30, tier: 'One Day - up to 30kg', cost: 4.13 },
      { service: 'UK shipping One day', weightMin: 0, weightMax: 60, depthMin: 0, depthMax: 30, heightMin: 0, heightMax: 30, widthMin: 0, widthMax: 30, tier: 'One Day - up to 60kg', cost: 4.13 },
      { service: 'Off Amazon', weightMin: 0, weightMax: 2, depthMin: 0, depthMax: 6.3, heightMin: 0, heightMax: 13.8, widthMin: 0, widthMax: 17.7, tier: 'Standard - up to 2kg', cost: 3.03 },
      { service: 'Off Amazon', weightMin: 0, weightMax: 7, depthMin: 0, depthMax: 11.8, heightMin: 0, heightMax: 15.7, widthMin: 0, widthMax: 19.7, tier: 'Standard - up to 7kg', cost: 3.64 },
      { service: 'Off Amazon', weightMin: 0, weightMax: 15, depthMin: 0, depthMax: 18.1, heightMin: 0, heightMax: 18.1, widthMin: 0, widthMax: 24, tier: 'Standard - up to 15kg', cost: 4.84 },
      { service: 'Off Amazon', weightMin: 0, weightMax: 30, depthMin: 0, depthMax: 30, heightMin: 0, heightMax: 30, widthMin: 0, widthMax: 30, tier: 'Standard - Parcel Force', cost: 5.89 },
      { service: 'Off Amazon', weightMin: 0, weightMax: 60, depthMin: 0, depthMax: 30, heightMin: 0, heightMax: 30, widthMin: 0, widthMax: 30, tier: 'Standard - DPD 2+', cost: 9.62 }
    ];
  }

  private calculateShippingCost(product: any, shippingService: string): number {
    const productWeight = product.weight ?? 0;
    const productDepth = product.depth ?? 0;
    const productHeight = product.height ?? 0;
    const productWidth = product.width ?? 0;

    // Find matching shipping tier based on service type, weight, and dimensions
    const serviceOptions = this.shippingTable.filter(s => s.service === shippingService);

    for (const option of serviceOptions) {
      if (productWeight >= option.weightMin && productWeight <= option.weightMax &&
        productDepth >= option.depthMin && productDepth <= option.depthMax &&
        productHeight >= option.heightMin && productHeight <= option.heightMax &&
        productWidth >= option.widthMin && productWidth <= option.widthMax) {
        return option.cost;
      }
    }

    return 0; // No match found
  }

  private getAmazonFeeRate(price: number): number {
    return price < 10 ? 0.08 : 0.153;
  }

  async calculateProductCosts(sku: string, price: number = 0, options: { isPrime?: boolean, actualTax?: number, quantity?: number } = {}) {
    try {
      const quantity = options.quantity || 1;

      // Fetch product data
      const { data: product, error: productError } = await db
        .from('inventory')
        .select('id, sku, depth, height, width, weight')
        .eq('sku', sku)
        .single();

      if (productError || !product) {
        console.log(`[CostCalculator] Product not found: ${sku}`);
        return null;
      }

      // Fetch SKU-ASIN mapping for shipping lookup and item name
      const { data: skuMapping, error: skuError } = await db
        .from('sku_asin_mapping')
        .select('merchant_shipping_group, item_name')
        .eq('seller_sku', sku)
        .single();

      // Fetch Linnworks data for cost lookup
      const { data: linnworksData } = await db
        .from('linnworks_composition_summary')
        .select('total_value, child_vats')
        .eq('parent_sku', sku)
        .single();

      // Calculate all cost components
      let shipping = skuMapping?.merchant_shipping_group || 'Off Amazon';

      // Override shipping if Prime
      if (options.isPrime) {
        shipping = 'Nationwide Prime';
      }

      const box = `${String(product.width ?? '')}x${String(product.height ?? '')}x${String(product.depth ?? '')}`;

      // Determine shipping type for display
      const shippingType = shipping === 'Nationwide Prime' ? 'Prime' :
        shipping === 'UK Shipping' ? 'Standard' :
          shipping === 'UK shipping One day' ? 'One Day' :
            'Unknown';

      const baseCost = linnworksData?.total_value || 0;
      const boxCost = this.boxSizeCosts.get(box) || 0;
      const materialCost = 0.35;
      const fragileCharge = this.fragileSKUs.has(sku) ? 0.66 : 0.00;

      // VAT calculation
      let vatCode = 0;
      try {
        const vatRates = JSON.parse(linnworksData?.child_vats || '[]');
        vatCode = vatRates[0] || 0;
      } catch (e) {
        vatCode = 0;
      }
      const vatAmount = vatCode === 20 ? baseCost * 0.2 : 0;

      // Calculate shipping cost
      // Scale weight by quantity to find the correct shipping tier for the whole package
      const shippingProduct = {
        ...product,
        weight: (product.weight || 0) * quantity
      };
      const totalShippingCost = this.calculateShippingCost(shippingProduct, shipping);
      const shippingCost = totalShippingCost / quantity; // Amortize per unit

      // Calculate Sales VAT and Ex-VAT Price
      let salesVat = 0;
      let exVatPrice = price;

      if (options.actualTax !== undefined) {
        salesVat = options.actualTax;
        exVatPrice = price - salesVat;
      } else {
        const vatRate = vatCode / 100;
        exVatPrice = price / (1 + vatRate);
        salesVat = price - exVatPrice;
      }

      // Calculate Amazon Fee
      // Calculate Ex-VAT price for fee calculation
      const amazonFeeRate = this.getAmazonFeeRate(exVatPrice);
      const amazonFee = exVatPrice * amazonFeeRate;

      // Material total cost
      // Exclude VAT from material total cost as it is recoverable
      const materialTotalCost = boxCost + materialCost + fragileCharge + baseCost;

      return {
        baseCost,
        boxCost,
        materialCost,
        fragileCharge,
        vatAmount,
        salesVat,
        shippingCost,
        amazonFee,
        materialTotalCost,
        shipping,
        shippingType,
        box,
        vatCode,
        itemName: skuMapping?.item_name || null
      };

    } catch (error) {
      console.error(`[CostCalculator] Error calculating costs for ${sku}:`, error);
      return null;
    }
  }
}
