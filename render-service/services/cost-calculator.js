// Shared cost calculation service for buy box margin analysis
// Reuses exact logic from inventory-profit-calculator

class CostCalculator {
  constructor(supabaseClient) {
    if (!supabaseClient) {
      console.warn('[CostCalculator] Warning: No Supabase client provided, cost calculations will be unavailable');
    }
    this.db = supabaseClient;
    this.initializeLookupTables();
  }

  /**
   * Calculate Amazon fee rate based on final selling price
   * @param {number} price - The final selling price
   * @returns {number} - The Amazon fee rate (0.08 for under £10, 0.15 for £10+)
   */
  getAmazonFeeRate(price) {
    return price < 10 ? 0.08 : 0.15;
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

  async calculateProductCosts(sku) {
    try {
      console.log(`[CostCalculator] Calculating costs for SKU: ${sku}`);

      // Check if database client is available
      if (!this.db) {
        console.log(`[CostCalculator] No database client available for SKU: ${sku}`);
        return null;
      }

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

      // Fetch SKU-ASIN mapping for shipping lookup and item name
      console.log(`[CostCalculator] Looking up shipping group and item name for SKU: ${sku}`);
      const { data: skuMapping, error: skuError } = await this.db
        .from('sku_asin_mapping')
        .select('merchant_shipping_group, item_name')
        .eq('seller_sku', sku)
        .single();

      if (skuError) {
        console.log(`[CostCalculator] Error fetching shipping group for SKU ${sku}: ${skuError.message}, Code: ${skuError.code}`);
      } else {
        console.log(`[CostCalculator] SKU mapping found for ${sku}`);
      }

      console.log(`[CostCalculator] SKU: ${sku}, Shipping Group from DB: '${skuMapping?.merchant_shipping_group || 'NULL'}'`);

      // Fetch Linnworks data for cost lookup
      const { data: linnworksData } = await this.db
        .from('linnworks_composition_summary')
        .select('total_value, child_vats')
        .eq('parent_sku', sku)
        .single();

      // Calculate all cost components
      const shipping = skuMapping?.merchant_shipping_group || 'Off Amazon';
      const box = `${String(product.width ?? '')}x${String(product.height ?? '')}x${String(product.depth ?? '')}`;

      // Determine shipping type for display
      const shippingType = shipping === 'Nationwide Prime' ? 'Prime' :
        shipping === 'UK Shipping' ? 'Standard' :
          shipping === 'UK shipping One day' ? 'One Day' :
            'Unknown';

      console.log(`[CostCalculator] SKU: ${sku}, Final Shipping: ${shipping}, Shipping Type: ${shippingType}`);

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

  calculateMargins(costs, yourPrice, buyboxPrice, amazonFeeRate = null) {
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

    // Use dynamic Amazon fee rate based on price if not provided
    const yourFeeRate = amazonFeeRate !== null ? amazonFeeRate : this.getAmazonFeeRate(yourPrice);

    // Calculate margin at your current price
    const yourAmazonFee = yourPrice * yourFeeRate;
    const yourNetRevenue = yourPrice - yourAmazonFee;
    const yourMargin = yourNetRevenue - costs.materialTotalCost - costs.shippingCost;
    // ROI-based margin: profit / total investment (costs + fees)
    const yourTotalInvestment = costs.materialTotalCost + costs.shippingCost + yourAmazonFee;
    const yourMarginPercent = yourTotalInvestment > 0 ? (yourMargin / yourTotalInvestment) * 100 : 0;

    // Handle no Buy Box scenario (buyboxPrice is null)
    if (!buyboxPrice || buyboxPrice === null) {
      const breakEvenPrice = (costs.materialTotalCost + costs.shippingCost) / (1 - yourFeeRate);

      return {
        yourMargin: parseFloat(yourMargin.toFixed(2)),
        yourMarginPercent: parseFloat(yourMarginPercent.toFixed(2)),
        buyboxMargin: null,
        buyboxMarginPercent: null,
        marginDifference: 0,
        profitOpportunity: 0,
        breakEvenPrice: parseFloat(breakEvenPrice.toFixed(2)),
        recommendedAction: 'investigate' // No Buy Box = investigate pricing/listing
      };
    }

    // Calculate margin if matching buy box price
    const buyboxFeeRate = amazonFeeRate !== null ? amazonFeeRate : this.getAmazonFeeRate(buyboxPrice);
    const buyboxAmazonFee = buyboxPrice * buyboxFeeRate;
    const buyboxNetRevenue = buyboxPrice - buyboxAmazonFee;
    const buyboxMargin = buyboxNetRevenue - costs.materialTotalCost - costs.shippingCost;
    // ROI-based margin: profit / total investment (costs + fees)
    const buyboxTotalInvestment = costs.materialTotalCost + costs.shippingCost + buyboxAmazonFee;
    const buyboxMarginPercent = buyboxTotalInvestment > 0 ? (buyboxMargin / buyboxTotalInvestment) * 100 : 0;

    // Calculate opportunity and recommendations
    const marginDifference = buyboxMargin - yourMargin;
    const profitOpportunity = Math.max(0, marginDifference);
    const breakEvenPrice = (costs.materialTotalCost + costs.shippingCost) / (1 - yourFeeRate);

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
      // Validate inputs
      if (!buyboxData || !buyboxData.sku) {
        console.log(`[CostCalculator] Invalid buybox data provided`);
        return {
          ...buyboxData,
          recommended_action: 'data_unavailable'
        };
      }

      const costs = await this.calculateProductCosts(buyboxData.sku);

      if (!costs) {
        console.log(`[CostCalculator] No cost data available for SKU: ${buyboxData.sku}`);
        return {
          ...buyboxData,
          recommended_action: 'data_unavailable'
        };
      }

      const margins = this.calculateMargins(
        costs,
        buyboxData.your_current_price || buyboxData.price,    // Use your_current_price preferably
        buyboxData.buybox_price || buyboxData.competitor_price // Use buybox_price preferably
      );

      // Calculate detailed profit breakdown
      const currentPrice = buyboxData.your_current_price || buyboxData.price;
      const buyboxPrice = buyboxData.buybox_price || buyboxData.competitor_price;

      // Current price profit calculation
      const currentFeeRate = this.getAmazonFeeRate(currentPrice);
      const currentAmazonFee = currentPrice * currentFeeRate;
      const currentNetRevenue = currentPrice - currentAmazonFee;
      const totalOperatingCost = costs.materialTotalCost + costs.shippingCost;
      const currentActualProfit = currentNetRevenue - totalOperatingCost;

      // Buybox price profit calculation (only if valid buy box price exists)
      let buyboxAmazonFee, buyboxNetRevenue, buyboxActualProfit;
      if (buyboxPrice && buyboxPrice > 0) {
        const buyboxFeeRate = this.getAmazonFeeRate(buyboxPrice);
        buyboxAmazonFee = buyboxPrice * buyboxFeeRate;
        buyboxNetRevenue = buyboxPrice - buyboxAmazonFee;
        buyboxActualProfit = buyboxNetRevenue - totalOperatingCost;
      } else {
        buyboxAmazonFee = null;
        buyboxNetRevenue = null;
        buyboxActualProfit = null;
      }

      return {
        ...buyboxData,
        // Cost breakdown
        your_cost: costs.baseCost,
        your_shipping_cost: costs.shippingCost,
        your_material_total_cost: costs.materialTotalCost,
        your_box_cost: costs.boxCost,
        your_vat_amount: costs.vatAmount,
        your_fragile_charge: costs.fragileCharge,

        // Product information
        item_name: costs.itemName,

        // Shipping type information
        merchant_shipping_group: costs.shipping,

        // Enhanced cost breakdown for UI clarity
        material_cost_only: costs.materialTotalCost,
        total_operating_cost: totalOperatingCost,
        material_cost_breakdown: `Base: £${costs.baseCost.toFixed(2)} + Box: £${costs.boxCost.toFixed(2)} + Material: £0.20 + VAT: £${costs.vatAmount.toFixed(2)} + Fragile: £${costs.fragileCharge.toFixed(2)} = £${costs.materialTotalCost.toFixed(2)}`,
        operating_cost_breakdown: `Material: £${costs.materialTotalCost.toFixed(2)} + Shipping: £${costs.shippingCost.toFixed(2)} = £${totalOperatingCost.toFixed(2)}`,
        breakeven_calculation: `(£${costs.materialTotalCost.toFixed(2)} + £${costs.shippingCost.toFixed(2)}) ÷ (1 - ${currentFeeRate.toFixed(2)}) = £${totalOperatingCost.toFixed(2)} ÷ ${(1 - currentFeeRate).toFixed(2)} = £${margins.breakEvenPrice.toFixed(2)}`,

        // ROI-based margin calculation breakdown
        current_margin_calculation: `(£${currentActualProfit.toFixed(2)} profit) ÷ (£${(costs.materialTotalCost + costs.shippingCost + currentAmazonFee).toFixed(2)} total investment) × 100 = ${margins.yourMarginPercent.toFixed(2)}%`,
        buybox_margin_calculation: buyboxActualProfit !== null ?
          `(£${buyboxActualProfit.toFixed(2)} profit) ÷ (£${(costs.materialTotalCost + costs.shippingCost + buyboxAmazonFee).toFixed(2)} total investment) × 100 = ${margins.buyboxMarginPercent.toFixed(2)}%` :
          null,
        total_investment_current: parseFloat((costs.materialTotalCost + costs.shippingCost + currentAmazonFee).toFixed(2)),
        total_investment_buybox: buyboxActualProfit !== null ?
          parseFloat((costs.materialTotalCost + costs.shippingCost + buyboxAmazonFee).toFixed(2)) :
          null,

        // Margin analysis
        your_margin_at_current_price: margins.yourMargin,
        your_margin_percent_at_current_price: margins.yourMarginPercent,
        margin_at_buybox_price: margins.buyboxMargin,
        margin_percent_at_buybox_price: margins.buyboxMarginPercent,
        margin_difference: margins.marginDifference,
        profit_opportunity: margins.profitOpportunity,

        // Actual profit calculations
        current_actual_profit: parseFloat(currentActualProfit.toFixed(2)),
        buybox_actual_profit: buyboxActualProfit !== null ? parseFloat(buyboxActualProfit.toFixed(2)) : null,
        current_profit_breakdown: `£${currentPrice.toFixed(2)} - £${currentAmazonFee.toFixed(2)} (Amazon) - £${totalOperatingCost.toFixed(2)} (Costs) = £${currentActualProfit.toFixed(2)}`,
        buybox_profit_breakdown: buyboxActualProfit !== null ?
          `£${buyboxPrice.toFixed(2)} - £${buyboxAmazonFee.toFixed(2)} (Amazon) - £${totalOperatingCost.toFixed(2)} (Costs) = £${buyboxActualProfit.toFixed(2)}` :
          null,

        // Recommendations
        recommended_action: margins.recommendedAction,
        price_adjustment_needed: (buyboxData.buybox_price || buyboxData.competitor_price) - (buyboxData.your_current_price || buyboxData.price),
        break_even_price: margins.breakEvenPrice
      };

    } catch (error) {
      console.error(`[CostCalculator] Error enriching buy box data for ${buyboxData.sku}:`, error);
      return {
        ...buyboxData,
        recommended_action: 'data_unavailable'
      };
    }
  }
}

module.exports = CostCalculator;
