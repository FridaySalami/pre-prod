import { db } from '$lib/supabaseServer';

export class CostCalculator {
  private boxSizeCosts!: Map<string, number>;
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

  async calculateProductCosts(sku: string, price: number = 0, options: { isPrime?: boolean, actualTax?: number, quantity?: number, customFragileCharge?: number } = {}) {
    try {
      // Fetch product data
      const { data: product, error: productError } = await db
        .from('inventory')
        .select('id, sku, depth, height, width, weight, is_fragile')
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

      return this.calculate(sku, price, product, skuMapping, linnworksData, options);

    } catch (error) {
      console.error(`[CostCalculator] Error calculating costs for ${sku}:`, error);
      return null;
    }
  }

  calculate(
    sku: string,
    price: number,
    product: any,
    skuMapping: any,
    linnworksData: any,
    options: { isPrime?: boolean, actualTax?: number, quantity?: number, customFragileCharge?: number } = {}
  ) {
    try {
      const quantity = options.quantity || 1;

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

      let fragileCharge = 0.00;
      if (options.customFragileCharge !== undefined) {
        fragileCharge = options.customFragileCharge;
      } else {
        // Default: 1.00 per box. Amortize over quantity assuming 1 box.
        fragileCharge = (product.is_fragile || false) ? (1.00 / quantity) : 0.00;
      }

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
