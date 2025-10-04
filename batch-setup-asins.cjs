#!/usr/bin/env node
/**
 * Batch ASIN Setup Runner
 * Usage: node batch-setup-asins.js
 */

const { batchProcessAsins } = require('./add-asins-to-monitoring.cjs');
const { NEW_ASINS, PRIORITY_UPDATES } = require('./asin-batch-config.cjs');

async function main() {
    console.log('🚀 ASIN Batch Setup Starting...\n');

    // Validate configuration
    if (NEW_ASINS.length === 0 && PRIORITY_UPDATES.length === 0) {
        console.log('⚠️  No ASINs or priority updates configured.');
        console.log('📝 Edit asin-batch-config.js to add your ASINs');
        process.exit(0);
    }

    // Show what will be processed
    console.log('📋 Configuration Summary:');
    console.log(`   • New ASINs to add: ${NEW_ASINS.length}`);
    console.log(`   • Priority updates: ${PRIORITY_UPDATES.length}`);

    if (NEW_ASINS.length > 0) {
        console.log('\n➕ New ASINs:');
        NEW_ASINS.forEach(({ asin, sku, priority }) => {
            console.log(`   - ${asin} (${sku}) → Priority ${priority}`);
        });
    }

    if (PRIORITY_UPDATES.length > 0) {
        console.log('\n📊 Priority Updates:');
        PRIORITY_UPDATES.forEach(({ asin, priority }) => {
            console.log(`   - ${asin} → Priority ${priority}`);
        });
    }

    // Confirm before proceeding
    console.log('\n⏳ Starting batch processing in 3 seconds...');
    console.log('   (Press Ctrl+C to cancel)');
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
        // Run batch processing
        const results = await batchProcessAsins(NEW_ASINS, PRIORITY_UPDATES);

        // Final summary
        console.log('\n🎉 Batch setup complete!');
        console.log('\n📊 Visit your monitoring dashboard:');
        console.log('   • Real-time: http://localhost:5173/buy-box-alerts/real-time');
        console.log('   • Configuration: http://localhost:5173/buy-box-alerts');

    } catch (error) {
        console.error('\n❌ Batch setup failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main().then(() => process.exit(0)).catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { main };