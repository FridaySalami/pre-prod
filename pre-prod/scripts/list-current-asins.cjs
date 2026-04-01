#!/usr/bin/env node
/**
 * List Current Monitoring Configuration
 * Shows all ASINs currently being monitored
 */

require('dotenv').config({ path: './render-service/.env' });
const { supabase } = require('./render-service/services/supabase-client');

const PRIORITY_LABELS = {
    1: 'Critical (15 min)',
    2: 'High (hourly)',
    3: 'Medium (4 hours)',
    4: 'Low (twice daily)',
    5: 'Monitor (daily)'
};

async function listCurrentAsins() {
    try {
        console.log('🔍 Fetching current monitoring configuration...\n');

        const { data, error } = await supabase
            .from('price_monitoring_config')
            .select('asin, sku, priority, monitoring_enabled, created_at')
            .eq('user_email', 'jack.w@parkersfoodservice.co.uk')
            .order('priority')
            .order('asin');

        if (error) throw error;

        if (!data || data.length === 0) {
            console.log('📭 No ASINs currently configured for monitoring');
            return;
        }

        console.log(`📊 Found ${data.length} ASINs in monitoring system:\n`);

        // Group by priority
        const byPriority = {};
        data.forEach(config => {
            if (!byPriority[config.priority]) {
                byPriority[config.priority] = [];
            }
            byPriority[config.priority].push(config);
        });

        // Display by priority groups
        Object.keys(byPriority).sort().forEach(priority => {
            const configs = byPriority[priority];
            const enabled = configs.filter(c => c.monitoring_enabled).length;

            console.log(`🔥 Priority ${priority} - ${PRIORITY_LABELS[priority]} (${enabled}/${configs.length} enabled)`);
            console.log('─'.repeat(60));

            configs.forEach(config => {
                const status = config.monitoring_enabled ? '✅' : '❌';
                const date = new Date(config.created_at).toLocaleDateString();
                console.log(`   ${status} ${config.asin} (${config.sku}) - Added: ${date}`);
            });
            console.log('');
        });

        // Summary stats
        const enabled = data.filter(c => c.monitoring_enabled).length;
        const disabled = data.length - enabled;

        console.log('📈 Summary:');
        console.log(`   • Total ASINs: ${data.length}`);
        console.log(`   • Enabled: ${enabled}`);
        console.log(`   • Disabled: ${disabled}`);

        // Priority distribution
        console.log('\n🎯 Priority Distribution:');
        Object.keys(byPriority).sort().forEach(priority => {
            const count = byPriority[priority].length;
            console.log(`   • Priority ${priority}: ${count} ASINs`);
        });

    } catch (error) {
        console.error('❌ Error fetching ASINs:', error);
    }
}

// Run if called directly
if (require.main === module) {
    listCurrentAsins().then(() => process.exit(0));
}

module.exports = { listCurrentAsins };