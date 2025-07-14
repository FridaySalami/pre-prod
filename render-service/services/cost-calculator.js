// Shared cost calculation service for buy box margin analysis
// Reuses exact logic from inventory-profit-calculator

class CostCalculator {
  constructor(supabaseClient) {
    this.db = supabaseClient;
    this.initializeLookupTables();
  }

  initializeLookupTables() {
    // Box size cost lookup (exact copy from inventory-profit-calculator)
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

    // Fragile SKUs (exact copy from inventory-profit-calculator)
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

    // Shipping table (exact copy from inventory-profit-calculator)
    this.shippingTable = [
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
  }

  async calculateProductCosts(sku) {
    try {
      console.log(`[CostCalculator] Calculating costs for SKU: ${sku}`);

      // Fetch product data
      const { data: product, error: productError } = await this.db
        .from('inventory')
        .select('id, sku, depth, height, width, weight')
        .eq('sku', sku)
        .single();

      if (productError || !product) {
        console.log(`[CostCalculator] Product not found: ${sku}`);
        return null;
      }

      // Fetch Amazon listings for shipping lookup
      const { data: amazonListing } = await this.db
        .from('amazon_listings')
        .select('merchant_shipping_group')
        .eq('seller_sku', sku)
        .single();

      // Fetch Linnworks data for cost lookup
      const { data: linnworksData } = await this.db
        .from('linnworks_composition_summary')
        .select('total_value, child_vats')
        .eq('parent_sku', sku)
        .single();

      // Calculate all cost components
      const shipping = amazonListing?.merchant_shipping_group || 'Off Amazon';
      const box = `${String(product.width ?? '')}x${String(product.height ?? '')}x${String(product.depth ?? '')}`;

      const baseCost = linnworksData?.total_value || 0;
      const boxCost = this.boxSizeCosts.get(box) || 0;
      const materialCost = 0.20;
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
      const shippingCost = this.calculateShippingCost(product, shipping);

      // Material total cost
      const materialTotalCost = vatAmount + boxCost + materialCost + fragileCharge + baseCost;

      console.log(`[CostCalculator] Costs for ${sku}:`, {
        baseCost,
        boxCost,
        materialCost,
        fragileCharge,
        vatAmount,
        shippingCost,
        materialTotalCost
      });

      return {
        baseCost,
        boxCost,
        materialCost,
        fragileCharge,
        vatAmount,
        shippingCost,
        materialTotalCost,
        shipping,
        box,
        vatCode,
        dataSource: linnworksData ? 'linnworks' : 'fallback'
      };

    } catch (error) {
      console.error(`[CostCalculator] Error calculating costs for ${sku}:`, error);
      return null;
    }
  }

  calculateShippingCost(product, shippingService) {
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

  calculateMargins(costs, yourPrice, buyboxPrice, amazonFeeRate = 0.15) {
    if (!costs) {
      return {
        yourMargin: 0,
        yourMarginPercent: 0,
        buyboxMargin: 0,
        buyboxMarginPercent: 0,
        marginDifference: 0,
        profitOpportunity: 0,
        breakEvenPrice: 0,
        recommendedAction: 'data_unavailable'
      };
    }

    // Calculate margin at your current price
    const yourAmazonFee = yourPrice * amazonFeeRate;
    const yourNetRevenue = yourPrice - yourAmazonFee;
    const yourMargin = yourNetRevenue - costs.materialTotalCost - costs.shippingCost;
    const yourMarginPercent = yourPrice > 0 ? (yourMargin / yourPrice) * 100 : 0;

    // Calculate margin if matching buy box price
    const buyboxAmazonFee = buyboxPrice * amazonFeeRate;
    const buyboxNetRevenue = buyboxPrice - buyboxAmazonFee;
    const buyboxMargin = buyboxNetRevenue - costs.materialTotalCost - costs.shippingCost;
    const buyboxMarginPercent = buyboxPrice > 0 ? (buyboxMargin / buyboxPrice) * 100 : 0;

    // Calculate opportunity and recommendations
    const marginDifference = buyboxMargin - yourMargin;
    const profitOpportunity = Math.max(0, marginDifference);
    const breakEvenPrice = (costs.materialTotalCost + costs.shippingCost) / (1 - amazonFeeRate);

    // Determine recommended action
    let recommendedAction;
    if (buyboxMarginPercent < 5) {
      recommendedAction = 'not_profitable';
    } else if (buyboxMarginPercent < 10) {
      recommendedAction = 'investigate';
    } else if (profitOpportunity > 1) {
      recommendedAction = 'match_buybox';
    } else {
      recommendedAction = 'hold_price';
    }

    return {
      yourMargin: parseFloat(yourMargin.toFixed(2)),
      yourMarginPercent: parseFloat(yourMarginPercent.toFixed(2)),
      buyboxMargin: parseFloat(buyboxMargin.toFixed(2)),
      buyboxMarginPercent: parseFloat(buyboxMarginPercent.toFixed(2)),
      marginDifference: parseFloat(marginDifference.toFixed(2)),
      profitOpportunity: parseFloat(profitOpportunity.toFixed(2)),
      breakEvenPrice: parseFloat(breakEvenPrice.toFixed(2)),
      recommendedAction
    };
  }

  async enrichBuyBoxData(buyboxData) {
    try {
      const costs = await this.calculateProductCosts(buyboxData.sku);

      if (!costs) {
        console.log(`[CostCalculator] No cost data available for SKU: ${buyboxData.sku}`);
        return {
          ...buyboxData,
          cost_data_source: 'unavailable',
          recommended_action: 'data_unavailable'
        };
      }

      const margins = this.calculateMargins(
        costs,
        buyboxData.price,
        buyboxData.competitor_price
      );

      return {
        ...buyboxData,
        // Cost breakdown
        your_cost: costs.baseCost,
        your_shipping_cost: costs.shippingCost,
        your_material_total_cost: costs.materialTotalCost,
        your_box_cost: costs.boxCost,
        your_vat_amount: costs.vatAmount,
        your_fragile_charge: costs.fragileCharge,

        // Margin analysis
        your_margin_at_current_price: margins.yourMargin,
        your_margin_percent_at_current_price: margins.yourMarginPercent,
        margin_at_buybox_price: margins.buyboxMargin,
        margin_percent_at_buybox_price: margins.buyboxMarginPercent,
        margin_difference: margins.marginDifference,
        profit_opportunity: margins.profitOpportunity,

        // Recommendations
        recommended_action: margins.recommendedAction,
        price_adjustment_needed: buyboxData.competitor_price - buyboxData.price,
        break_even_price: margins.breakEvenPrice,

        // Metadata
        margin_calculation_version: 'v1.0',
        cost_data_source: costs.dataSource
      };

    } catch (error) {
      console.error(`[CostCalculator] Error enriching buy box data for ${buyboxData.sku}:`, error);
      return {
        ...buyboxData,
        cost_data_source: 'error',
        recommended_action: 'data_unavailable'
      };
    }
  }
}

module.exports = CostCalculator;
