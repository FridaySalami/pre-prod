/**
 * Single Buybox Record API
 * 
 * Endpoint for fetching updated buybox records after live pricing updates
 */

const express = require('express');
const { SupabaseService } = require('../services/supabase-client');

const router = express.Router();

/**
 * GET /api/buybox-record/:id
 * Fetch a single buybox record by ID
 */
router.get('/buybox-record/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Record ID is required'
      });
    }

    // Fetch the record from buybox_data table
    const { data: record, error } = await SupabaseService.client
      .from('buybox_data')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Database error fetching record:', error);
      return res.status(500).json({
        success: false,
        error: 'Database error fetching record'
      });
    }

    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Record not found'
      });
    }

    console.log(`✅ Successfully fetched record ${id} for SKU: ${record.sku}`);

    res.json({
      success: true,
      data: record,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in buybox-record endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
