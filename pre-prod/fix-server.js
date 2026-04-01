const fs = require('fs');
let s = fs.readFileSync('src/routes/api/amazon/costs/update/+server.ts', 'utf8');

const newCode = `    if (compError) {
      console.error('Error updating composition:', compError);
      return json({ success: false, error: 'Failed to update composition: ' + compError.message }, { status: 500 });
    }

    // 4. Clean up any unmapped packing records for orders containing this SKU
    // Find recent order IDs for this SKU to clear out unmapped errors
    const { data: orderItems } = await db
      .from('amazon_order_items')
      .select('amazon_order_id')
      .eq('seller_sku', sku)
      .limit(1000);

    if (orderItems && orderItems.length > 0) {
      const orderIds = [...new Set(orderItems.map(item => item.amazon_order_id))];
      
      // Delete the null mappings so they disappear from the UI and can be recalculated
      const { error: deleteError } = await db
        .from('amazon_order_packaging')
        .delete()
        .is('box_supplconst fs = require('fs');
leazlet s = fs.readFileSync(
 
const newCode = `    if (compError) {
      console.error('Error updating compoped      console.error('Error updating         return json({ success: false, error: 'Failed to update da    }

    // 4. Clean up any unmapped packing records for orders containing this SKU
    // Find recent order IDs :'
   mpE    // Find recent order IDs for this SKU to clear out unmapped errors
    coon    cocompError.message }, { status: 500 });
    }

    return json({ s      .from('amazon_order_items')
      d       .select('amazon_order_id')s.      .eq('seller_sku', sku)
  ma      .limit(1000);

    if',
s);
