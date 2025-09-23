/**
 * Test Route for Competitive Pricing API Comparison
 * 
 * Compares getItemOffers (current) vs getCompetitivePricing (batch) APIs
 * to analyze performance and data differences
 */

const express = require('express');
const { AmazonSPAPI } = require('../services/amazon-spapi');
const { SupabaseService } = require('../services/supabase-client');

const router = express.Router();

// Initialize Amazon SP-API client
let amazonAPI = null;
const USE_REAL_API = process.env.USE_AMAZON_SPAPI === 'true';

if (USE_REAL_API) {
  try {
    amazonAPI = new AmazonSPAPI(SupabaseService.client);
    console.log('✅ Amazon SP-API client initialized for testing');
  } catch (error) {
    console.warn('⚠️ Amazon SP-API client initialization failed:', error.message);
  }
} else {
  console.error('❌ TEST ERROR: USE_AMAZON_SPAPI not set to true - cannot test real APIs');
}

/**
 * POST /compare - Compare both APIs for specific ASINs
 */
router.post('/compare', async (req, res) => {
  try {
    const { asins, testType = 'both' } = req.body;

    if (!asins || !Array.isArray(asins) || asins.length === 0) {
      return res.status(400).json({
        error: 'asins array is required',
        example: { asins: ['B005R05XAA', 'B08773TN76'] }
      });
    }

    if (asins.length > 20) {
      return res.status(400).json({
        error: 'Maximum 20 ASINs allowed for batch testing'
      });
    }

    if (!amazonAPI) {
      return res.status(500).json({
        error: 'Amazon SP-API not initialized - check environment configuration'
      });
    }

    console.log(`🧪 Starting API comparison test for ${asins.length} ASINs`);
    console.log(`📋 ASINs: ${asins.join(', ')}`);
    console.log(`🔬 Test type: ${testType}`);

    const results = {
      testInfo: {
        timestamp: new Date().toISOString(),
        asinCount: asins.length,
        testType: testType
      },
      currentAPI: null,
      batchAPI: null,
      comparison: null,
      performance: {
        currentAPI: null,
        batchAPI: null
      }
    };

    // Test 1: Current API (getItemOffers) - one by one
    if (testType === 'current' || testType === 'both') {
      console.log('🔍 Testing current API (getItemOffers)...');
      const currentStart = Date.now();

      try {
        const currentResults = [];
        for (const asin of asins) {
          console.log(`📡 Current API: Fetching ${asin}...`);
          const result = await amazonAPI.getCompetitivePricing(asin);
          currentResults.push({
            asin: asin,
            data: result,
            timestamp: new Date().toISOString()
          });

          // Add small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 2100)); // 2.1 seconds = ~0.47 req/sec
        }

        results.currentAPI = currentResults;
        results.performance.currentAPI = {
          duration: Date.now() - currentStart,
          requestCount: asins.length,
          avgPerRequest: (Date.now() - currentStart) / asins.length
        };

        console.log(`✅ Current API completed in ${results.performance.currentAPI.duration}ms`);
      } catch (error) {
        console.error('❌ Current API test failed:', error.message);
        results.currentAPI = { error: error.message };
      }
    }

    // Test 2: Batch API (getCompetitivePricing)
    if (testType === 'batch' || testType === 'both') {
      console.log('🚀 Testing batch API (getCompetitivePricing)...');
      const batchStart = Date.now();

      try {
        console.log(`📡 Batch API: Fetching ${asins.length} ASINs in one request...`);
        const batchResult = await amazonAPI.getCompetitivePricingBatch(asins, 'Asin');

        results.batchAPI = {
          data: batchResult,
          timestamp: new Date().toISOString()
        };
        results.performance.batchAPI = {
          duration: Date.now() - batchStart,
          requestCount: 1,
          avgPerRequest: Date.now() - batchStart
        };

        console.log(`✅ Batch API completed in ${results.performance.batchAPI.duration}ms`);
      } catch (error) {
        console.error('❌ Batch API test failed:', error.message);
        results.batchAPI = { error: error.message };
      }
    }

    // Generate comparison analysis
    if (results.currentAPI && results.batchAPI && !results.currentAPI.error && !results.batchAPI.error) {
      results.comparison = generateComparison(results.currentAPI, results.batchAPI, results.performance);
    }

    console.log(`🎯 Test completed for ${asins.length} ASINs`);

    res.json({
      success: true,
      results: results
    });

  } catch (error) {
    console.error('❌ Test route error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Generate comparison analysis between the two APIs
 */
function generateComparison(currentResults, batchResults, performance) {
  const comparison = {
    performance: {
      speedImprovement: performance.currentAPI.duration / performance.batchAPI.duration,
      timeSaved: performance.currentAPI.duration - performance.batchAPI.duration,
      currentTotal: performance.currentAPI.duration,
      batchTotal: performance.batchAPI.duration
    },
    dataStructure: {
      currentAPI: analyzeCurrentAPIStructure(currentResults),
      batchAPI: analyzeBatchAPIStructure(batchResults.data)
    },
    capabilities: {
      buyBoxWinner: {
        current: 'Available (IsBuyBoxWinner flag)',
        batch: 'Not directly available'
      },
      competitorDetails: {
        current: 'Full seller details available',
        batch: 'Limited competitive pricing only'
      },
      primeInfo: {
        current: 'Detailed Prime/FBA info per offer',
        batch: 'Limited fulfillment info'
      },
      yourOffers: {
        current: 'Available in offers array',
        batch: 'Available in Product.Offers array'
      }
    }
  };

  return comparison;
}

function analyzeCurrentAPIStructure(results) {
  if (!results || results.length === 0) return null;

  const sample = results[0]?.data?.payload;
  return {
    structure: 'payload.Offers array',
    fieldsAvailable: sample?.Offers ? Object.keys(sample.Offers[0] || {}) : [],
    offerCount: sample?.Offers?.length || 0,
    hasBuyBoxInfo: sample?.Offers?.some(offer => offer.IsBuyBoxWinner) || false
  };
}

function analyzeBatchAPIStructure(batchData) {
  if (!batchData?.payload || batchData.payload.length === 0) return null;

  const sample = batchData.payload[0];
  return {
    structure: 'payload array with Product.CompetitivePricing',
    fieldsAvailable: sample?.Product ? Object.keys(sample.Product) : [],
    hasCompetitivePricing: !!sample?.Product?.CompetitivePricing,
    hasOffers: !!sample?.Product?.Offers,
    hasSalesRanking: !!sample?.Product?.SalesRankings
  };
}

/**
 * GET /sample - Get sample ASINs for testing
 */
router.get('/sample', async (req, res) => {
  try {
    // Get some sample ASINs from the database
    const sampleAsins = await SupabaseService.client
      .from('sku_asin_mapping')
      .select('asin1')
      .limit(10);

    const asins = sampleAsins.data?.map(item => item.asin1).filter(Boolean) || [];

    res.json({
      success: true,
      sampleAsins: asins.slice(0, 5), // Return 5 for testing
      usage: {
        endpoint: 'POST /test-competitive-pricing/compare',
        body: {
          asins: asins.slice(0, 3),
          testType: 'both' // or 'current' or 'batch'
        }
      }
    });

  } catch (error) {
    console.error('❌ Sample ASINs error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;