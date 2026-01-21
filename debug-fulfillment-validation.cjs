
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.PRIVATE_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runValidation() {
    // Get date for 2 days ago or user specified date
    const targetDateStr = process.argv[2] || '2026-01-18';
    console.log(`Checking orders for date: ${targetDateStr}`);

    const startDate = new Date(targetDateStr);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDateStr);
    endDate.setHours(23, 59, 59, 999);

    console.log(`Range: ${startDate.toISOString()} - ${endDate.toISOString()}`);

    const { data: orders, error } = await supabase
        .from('amazon_orders')
        .select('*')
        .gte('purchase_date', startDate.toISOString())
        .lte('purchase_date', endDate.toISOString());

    if (error) {
        console.error('DB Error:', error);
        return;
    }

    if (!orders || orders.length === 0) {
        console.log('No orders found for this date.');
        return;
    }

    console.log(`Found ${orders.length} orders.`);

    const validationResults = orders.map(order => {
        const issues = [];

        // Detailed logging for Canceled orders to verify status string
        if (order.order_status?.toLowerCase().includes('cancel')) {
            console.log(`[DEBUG] Found Cancelled-like order: ${order.amazon_order_id} - Status: '${order.order_status}'`);
        }

        // Logic from +server.ts
        if (order.order_status === 'Canceled' || order.order_status === 'Pending') {
            return {
                orderId: order.amazon_order_id,
                status: order.order_status,
                isComplete: true,
                issues: []
            };
        }

        // Check Shipping Cost
        if (order.shipping_cost === null || order.shipping_cost === undefined) {
            issues.push('Missing Shipping Cost');
        }

        // Check Carrier
        if (!order.automated_carrier && !order.carrier) {
            issues.push('Missing Carrier');
        }

        // Check Tracking
        // Relaxed: Tracking ID is not strictly required for report readiness if cost is present
        // if (!order.tracking_id) {
        //     issues.push('Missing Tracking ID');
        // }

        return {
            orderId: order.amazon_order_id,
            status: order.order_status,
            isComplete: issues.length === 0,
            issues
        };
    });

    const total = validationResults.length;
    const complete = validationResults.filter(r => r.isComplete).length;
    const incomplete = validationResults.filter(r => !r.isComplete).length;
    const incompleteDetails = validationResults.filter(r => !r.isComplete);

    // Report Ready Criteria: 90% completion
    const completionRate = total > 0 ? (complete / total) : 1;
    const reportReady = completionRate >= 0.90;

    console.log('\n--- Validation Summary ---');
    console.log(`Total: ${total}`);
    console.log(`Complete: ${complete}`);
    console.log(`Incomplete: ${incomplete}`);
    console.log(`Completion Rate: ${(completionRate * 100).toFixed(1)}%`);
    console.log(`Report Ready (>=90%): ${reportReady ? 'YES' : 'NO'}`);

    if (incomplete > 0) {
        console.log('\n--- Incomplete Orders Details ---');
        incompleteDetails.forEach(d => {
            console.log(`Order: ${d.orderId} | Status: ${d.status}`);
            console.log(`   Issues: ${d.issues.join(', ')}`);
        });
    } else {
        console.log('\nTests passed! All orders valid.');
    }
}

runValidation();
