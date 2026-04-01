/**
 * Batch ASIN Monitor Setup Script
 * Handles bulk ASIN setup with duplicate checking and priority management
 */

require('dotenv').config({ path: './render-service/.env' });
const { supabase } = require('./render-service/services/supabase-client');

const USER_EMAIL = 'jack.w@parkersfoodservice.co.uk';

/**
 * Get all existing ASINs for the user to check for duplicates
 */
async function getExistingAsins() {
    try {
        const { data, error } = await supabase
            .from('price_monitoring_config')
            .select('asin, sku, priority, monitoring_enabled')
            .eq('user_email', USER_EMAIL);

        if (error) throw error;

        const existingMap = new Map();
        data?.forEach(config => {
            existingMap.set(config.asin, config);
        });

        return existingMap;
    } catch (error) {
        console.error('Error fetching existing ASINs:', error);
        return new Map();
    }
}

/**
 * Add single ASIN with duplicate checking
 */
async function addAsinToMonitoring(asin, sku, options = {}, existingAsins = null) {
    const defaultOptions = {
        user_email: USER_EMAIL,
        monitoring_enabled: true,
        priority: 5,
        price_change_threshold: 5.0,
        alert_types: ['email', 'database'],
        alert_frequency: 'immediate'
    };

    // Check if ASIN already exists
    const existing = existingAsins?.get(asin);
    if (existing) {
        console.log(`⚠️  ASIN ${asin} already exists - Priority: ${existing.priority}, Enabled: ${existing.monitoring_enabled}`);
        return { action: 'skipped', asin, existing };
    }

    const config = { ...defaultOptions, ...options, asin, sku };

    try {
        const { data, error } = await supabase
            .from('price_monitoring_config')
            .insert(config)
            .select();

        if (error) throw error;

        console.log(`✅ Added ASIN ${asin} (SKU: ${sku}) - Priority: ${config.priority}`);
        return { action: 'added', asin, data: data[0] };
    } catch (error) {
        console.error(`❌ Failed to add ASIN ${asin}:`, error.message);
        return { action: 'failed', asin, error: error.message };
    }
}

/**
 * Update priority for existing ASINs in batch
 */
async function batchUpdatePriorities(priorityUpdates) {
    console.log(`\n📊 Updating priorities for ${priorityUpdates.length} ASINs...`);

    const results = { updated: 0, failed: 0 };

    for (const { asin, priority } of priorityUpdates) {
        try {
            const { error } = await supabase
                .from('price_monitoring_config')
                .update({ priority })
                .eq('asin', asin)
                .eq('user_email', USER_EMAIL);

            if (error) throw error;

            console.log(`✅ Updated ASIN ${asin} to priority ${priority}`);
            results.updated++;
        } catch (error) {
            console.error(`❌ Failed to update ASIN ${asin}:`, error.message);
            results.failed++;
        }

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`\n📈 Priority updates complete: ${results.updated} updated, ${results.failed} failed`);
    return results;
}

/**
 * Batch process multiple ASINs with comprehensive reporting
 */
async function batchProcessAsins(asinList, priorityUpdates = []) {
    console.log(`🚀 Starting batch processing...`);
    console.log(`📦 ASINs to add: ${asinList.length}`);
    console.log(`📊 Priority updates: ${priorityUpdates.length}`);

    // Get existing ASINs once for efficiency
    console.log(`\n🔍 Checking existing ASINs...`);
    const existingAsins = await getExistingAsins();
    console.log(`📋 Found ${existingAsins.size} existing ASINs`);

    const results = {
        added: [],
        skipped: [],
        failed: [],
        priorityUpdates: null
    };

    // Process new ASINs
    console.log(`\n➕ Processing new ASINs...`);
    for (const { asin, sku, ...options } of asinList) {
        const result = await addAsinToMonitoring(asin, sku, options, existingAsins);
        results[result.action].push(result);

        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Process priority updates
    if (priorityUpdates.length > 0) {
        results.priorityUpdates = await batchUpdatePriorities(priorityUpdates);
    }

    // Summary report
    console.log(`\n📊 BATCH PROCESSING COMPLETE`);
    console.log(`===============================`);
    console.log(`✅ Added: ${results.added.length}`);
    console.log(`⚠️  Skipped (already exist): ${results.skipped.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    if (results.priorityUpdates) {
        console.log(`📈 Priority updates: ${results.priorityUpdates.updated} updated, ${results.priorityUpdates.failed} failed`);
    }

    return results;
}

/**
 * Helper function to create priority update array from ASIN list
 */
function createPriorityUpdates(asinPriorityList) {
    return asinPriorityList.map(({ asin, priority }) => ({ asin, priority }));
}

// Example usage configurations
async function exampleBatchSetup() {
    // New ASINs to add
    const newAsins = [
        { asin: 'B0EXAMPLE1', sku: 'SKU-001', priority: 3 },
        { asin: 'B0EXAMPLE2', sku: 'SKU-002', priority: 1 },
        { asin: 'B0EXAMPLE3', sku: 'SKU-003', priority: 2 },
        // Add your ASINs here...
    ];

    // Priority updates for existing ASINs
    const priorityUpdates = [
        { asin: 'B09T3GDNGT', priority: 2 }, // Honey - 4 competitors, upgrade to hourly
        { asin: 'B0DVJ17T8C', priority: 3 }, // Callebaut - 3 competitors, upgrade to 4-hourly
        { asin: 'B0BGPMD867', priority: 3 }, // Olive Oil - 3 competitors, upgrade to 4-hourly
        // Add more priority updates here...
    ];

    await batchProcessAsins(newAsins, priorityUpdates);
}

// Uncomment to run example
// exampleBatchSetup().then(() => process.exit(0)).catch(console.error);

module.exports = {
    addAsinToMonitoring,
    batchProcessAsins,
    batchUpdatePriorities,
    getExistingAsins,
    createPriorityUpdates
};