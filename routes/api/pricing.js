const express = require('express');
const AmazonSPAPI = require('../../render-service/services/amazon-spapi');
const { supabase } = require('../../render-service/services/supabase-client');

const router = express.Router();
const spapi = new AmazonSPAPI(supabase);

/**
 * POST /api/pricing/check-buy-box
 * Check buy box prices for a batch of SKUs
 * Body: { skus: string[] }
 */
router.post('/check-buy-box', async (req, res) => {
  try {
    const { skus } = req.body;

    if (!skus || !Array.isArray(skus) || skus.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'A non-empty array of SKUs is required'
      });
    }

    if (skus.length > 20) {
      return res.status(400).json({
        success: false,
        error: 'Batch size cannot exceed 20 SKUs'
      });
    }

    const batchResults = await spapi.getListingOffersBatch(skus);

    // Simplify the response for the frontend
    const summary = batchResults.responses.map(resp => {
      const sku = resp.request?.SellerSKU || 'Unknown';
      
      if (resp.status?.statusCode !== 200) {
        return {
          sku,
          status: 'Error',
          error: resp.body?.errors?.[0]?.message || 'Failed to fetch'
        };
      }

      const payload = resp.body?.payload;
      const buyBoxWinner = payload?.Summary?.BuyBoxPrices?.[0];
      const lowestOffer = payload?.Summary?.LowestPrices?.[0];

      return {
        sku,
        status: 'Success',
        asin: payload?.Identifier?.Asin,
        buyBoxPrice: buyBoxWinner ? {
          amount: buyBoxWinner.LandedPrice?.Amount,
          currency: buyBoxWinner.LandedPrice?.CurrencyCode
        } : null,
        lowestPrice: lowestOffer ? {
          amount: lowestOffer.LandedPrice?.Amount,
          currency: lowestOffer.LandedPrice?.CurrencyCode
        } : null,
        totalOffers: payload?.Summary?.TotalOfferCount,
        isBuyBoxWinner: payload?.Summary?.BuyBoxPrices?.length > 0
      };
    });

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error checking buy box prices:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
