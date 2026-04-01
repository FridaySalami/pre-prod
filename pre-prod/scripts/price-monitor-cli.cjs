#!/usr/bin/env node
/**
 * Price Monitoring CLI Tool
 * 
 * Usage:
 *   node price-monitor-cli.js start [interval_minutes]
 *   node price-monitor-cli.js stop
 *   node price-monitor-cli.js add-item --asin B07XYZ123 --sku ITEM-SKU --user user@example.com [options]
 *   node price-monitor-cli.js list-items [--user user@example.com]
 *   node price-monitor-cli.js test-alerts --user user@example.com
 */

require('dotenv').config();

const { BatchPriceMonitor } = require('./batch-price-monitor.cjs');
const { SupabaseService } = require('./render-service/services/supabase-client');
const readline = require('readline');

class PriceMonitorCLI {
  constructor() {
    this.monitor = new BatchPriceMonitor();
  }

  async parseArgs() {
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
      case 'start':
        const interval = parseInt(args[1]) || 30; // Default 30 minutes
        await this.startMonitoring(interval);
        break;

      case 'stop':
        await this.stopMonitoring();
        break;

      case 'add-item':
        await this.addMonitoringItem(args);
        break;

      case 'list-items':
        await this.listMonitoringItems(args);
        break;

      case 'test-alerts':
        await this.testAlerts(args);
        break;

      case 'run-once':
        await this.runOnce();
        break;

      default:
        this.showUsage();
    }
  }

  async startMonitoring(intervalMinutes) {
    console.log(`🚀 Starting continuous price monitoring (${intervalMinutes} minute intervals)`);
    console.log('Press Ctrl+C to stop monitoring...');

    this.monitor.startMonitoring(intervalMinutes);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\\n🛑 Shutting down monitoring...');
      this.monitor.stopMonitoring();
      process.exit(0);
    });

    // Keep process alive
    process.stdin.resume();
  }

  async stopMonitoring() {
    console.log('🛑 Stopping price monitoring...');
    this.monitor.stopMonitoring();
    process.exit(0);
  }

  async addMonitoringItem(args) {
    const options = this.parseOptions(args);

    if (!options.asin || !options.sku || !options.user) {
      console.error('❌ Required: --asin, --sku, --user');
      this.showUsage();
      return;
    }

    try {
      const { error } = await SupabaseService.client
        .from('price_monitoring_config')
        .insert({
          user_email: options.user,
          asin: options.asin,
          sku: options.sku,
          priority: parseInt(options.priority) || 2,
          price_change_threshold: parseFloat(options.threshold) || 5.0,
          alert_types: options.alerts ? JSON.parse(options.alerts) : ['email', 'database'],
          monitoring_enabled: true
        });

      if (error) throw error;

      console.log(`✅ Added monitoring for:`);
      console.log(`   ASIN: ${options.asin}`);
      console.log(`   SKU: ${options.sku}`);
      console.log(`   User: ${options.user}`);
      console.log(`   Priority: ${options.priority || 2}`);
      console.log(`   Threshold: ${options.threshold || 5.0}%`);

    } catch (error) {
      console.error('❌ Error adding monitoring item:', error);
    }
  }

  async listMonitoringItems(args) {
    const options = this.parseOptions(args);

    try {
      let query = SupabaseService.client
        .from('price_monitoring_config')
        .select(`
          id,
          asin,
          sku,
          user_email,
          priority,
          price_change_threshold,
          monitoring_enabled,
          last_checked,
          created_at
        `)
        .order('priority');

      if (options.user) {
        query = query.eq('user_email', options.user);
      }

      const { data, error } = await query;

      if (error) throw error;

      console.log(`\\n📋 Monitoring Configuration (${data?.length || 0} items):`);
      console.log('─'.repeat(120));
      console.log('PRIORITY | ASIN      | SKU                    | USER                | THRESHOLD | ENABLED | LAST CHECKED');
      console.log('─'.repeat(120));

      data?.forEach(item => {
        const lastChecked = item.last_checked
          ? new Date(item.last_checked).toLocaleString()
          : 'Never';

        console.log(
          `${item.priority.toString().padEnd(8)} | ` +
          `${item.asin.padEnd(9)} | ` +
          `${item.sku.substring(0, 22).padEnd(22)} | ` +
          `${item.user_email.substring(0, 19).padEnd(19)} | ` +
          `${item.price_change_threshold.toString().padEnd(9)} | ` +
          `${item.monitoring_enabled ? 'YES' : 'NO'} | ` +
          `${lastChecked}`
        );
      });

    } catch (error) {
      console.error('❌ Error listing monitoring items:', error);
    }
  }

  async testAlerts(args) {
    const options = this.parseOptions(args);

    if (!options.user) {
      console.error('❌ Required: --user email');
      return;
    }

    console.log(`🧪 Testing alert system for ${options.user}...`);

    // Create test alerts
    const testAlerts = [
      {
        type: 'buy_box_price_change',
        severity: 'high',
        asin: 'B07TEST123',
        sku: 'TEST-SKU-001',
        itemName: 'Test Product - Callebaut Dark Chocolate 2.5kg',
        message: 'Buy Box price changed by -15.2% (-£2.50)',
        previousPrice: 16.45,
        currentPrice: 13.95,
        changePercent: -15.2,
        timestamp: new Date().toISOString(),
        userEmail: options.user
      },
      {
        type: 'buy_box_ownership_change',
        severity: 'high',
        asin: 'B07TEST456',
        sku: 'TEST-SKU-002',
        itemName: 'Test Product - Valrhona Chocolate 1kg',
        message: 'Lost Buy Box!',
        previousOwner: process.env.AMAZON_SELLER_ID,
        currentOwner: 'COMPETITOR123',
        timestamp: new Date().toISOString(),
        userEmail: options.user
      }
    ];

    try {
      await this.monitor.sendAlerts(testAlerts);
      console.log('✅ Test alerts sent successfully!');
    } catch (error) {
      console.error('❌ Error sending test alerts:', error);
    }
  }

  async runOnce() {
    console.log('🔄 Running single monitoring cycle...');
    await this.monitor.runMonitoringCycle();
    console.log('✅ Monitoring cycle completed');
    process.exit(0);
  }

  parseOptions(args) {
    const options = {};

    for (let i = 0; i < args.length; i++) {
      if (args[i].startsWith('--')) {
        const key = args[i].substring(2);
        const value = args[i + 1];
        options[key] = value;
        i++; // Skip next arg since we used it as value
      }
    }

    return options;
  }

  showUsage() {
    console.log(`
📊 Amazon Price Monitoring CLI Tool

Usage:
  node price-monitor-cli.js <command> [options]

Commands:
  start [interval]              Start continuous monitoring (default: 30 minutes)
  stop                          Stop monitoring
  run-once                      Run single monitoring cycle and exit
  
  add-item                      Add ASIN/SKU to monitoring
    --asin <asin>               Amazon ASIN (required)
    --sku <sku>                 Your SKU (required) 
    --user <email>              User email (required)
    --priority <1-5>            Priority level (default: 2)
    --threshold <percent>       Price change threshold (default: 5.0)
    --alerts <json>             Alert types JSON array (default: ["email","database"])
  
  list-items                    List all monitoring configurations
    --user <email>              Filter by user email (optional)
  
  test-alerts                   Send test alerts
    --user <email>              User email to send test alerts to (required)

Examples:
  # Start monitoring every 15 minutes
  node price-monitor-cli.js start 15
  
  # Add high-priority item with 3% threshold
  node price-monitor-cli.js add-item --asin B07XYZ123 --sku CHOC-2.5KG-PRIME --user jack@example.com --priority 1 --threshold 3.0
  
  # List items for specific user
  node price-monitor-cli.js list-items --user jack@example.com
  
  # Test alert system
  node price-monitor-cli.js test-alerts --user jack@example.com

Environment Variables Required:
  AMAZON_SELLER_ID              Your Amazon seller ID
  SMTP_HOST, SMTP_USER, etc.    Email configuration (optional)
  WEBHOOK_URL                   Webhook endpoint (optional)
  PUBLIC_SUPABASE_URL           Supabase database URL
  PRIVATE_SUPABASE_SERVICE_KEY  Supabase service key
`);
  }
}

// Run CLI if called directly
if (require.main === module) {
  const cli = new PriceMonitorCLI();
  cli.parseArgs().catch(error => {
    console.error('❌ CLI Error:', error);
    process.exit(1);
  });
}

module.exports = { PriceMonitorCLI };