
import { Renderer } from 'better-svelte-email';
// @ts-ignore
import DailyReport from '$lib/emails/DailyReport.svelte';

const renderer = new Renderer();

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(amount);
}

// Helper to calculate costs (reused)
function calculateOrderCost(order: any): number {
  if (!order.amazon_order_items) return 0;
  return order.amazon_order_items.reduce((sum: number, item: any) => {
    if (item.costs) {
      const material = Number(item.costs.materialTotalCost) || 0;
      const shipping = Number(item.costs.shippingCost) || 0;
      const fee = Number(item.costs.amazonFee) || 0;
      const salesVat = Number(item.costs.salesVat) || 0;
      const qty = Number(item.quantity_ordered) || 0;
      return sum + (material + shipping + fee + salesVat) * qty;
    }
    return sum;
  }, 0);
}

export async function generateDailyReportHtml(orders: any[], date: Date) {
  const validOrders = orders.filter(o => o.order_status !== 'Pending' && o.order_status !== 'Canceled');
  const dateStr = date.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Sort logic
  const sortedOrders = [...validOrders].sort((a, b) => {
    const getProfit = (o: any) => {
      const revenue = parseFloat(o.order_total) || 0;
      const cost = calculateOrderCost(o);
      return revenue - cost;
    };
    return getProfit(b) - getProfit(a);
  });

  const totalRevenue = validOrders.reduce((sum, o) => sum + (parseFloat(o.order_total) || 0), 0);

  // Calculate best SKU (Simplified)
  let bestSku = { sku: 'N/A', title: 'N/A', profit: 0 };
  const skuMap: Record<string, any> = {};

  validOrders.forEach(o => {
    o.amazon_order_items?.forEach((i: any) => {
      if (!i.seller_sku) return;
      if (!skuMap[i.seller_sku]) skuMap[i.seller_sku] = { sku: i.seller_sku, title: i.title, profit: 0 };

      // Calc item profit
      const qty = i.quantity_ordered || 0;
      const rev = parseFloat(i.item_price_amount || '0');
      let cost = 0;
      if (i.costs) {
        const material = Number(i.costs.materialTotalCost) || 0;
        const shipping = Number(i.costs.shippingCost) || 0;
        const fee = Number(i.costs.amazonFee) || 0;
        const salesVat = Number(i.costs.salesVat) || 0;
        cost = (material + shipping + fee + salesVat) * qty;
      }
      skuMap[i.seller_sku].profit += (rev - cost);
    });
  });

  const bestSkuObj = Object.values(skuMap).sort((a: any, b: any) => b.profit - a.profit)[0];
  if (bestSkuObj) {
    bestSku = {
      sku: bestSkuObj.sku,
      title: bestSkuObj.title,
      profit: bestSkuObj.profit
    };
  }

  // Let's pass simplified data to the component
  const emailProps = {
    date: dateStr,
    totalOrders: validOrders.length,
    totalRevenue: formatCurrency(totalRevenue),
    topSku: {
      sku: bestSku.sku,
      title: bestSku.title,
      profit: formatCurrency(bestSku.profit)
    },
    orders: sortedOrders.map(o => {
      const revenue = parseFloat(o.order_total) || 0;
      const cost = calculateOrderCost(o);
      const profit = (o.order_status === 'Canceled' ? 0 : revenue) - cost;
      return {
        amazon_order_id: o.amazon_order_id,
        revenue: formatCurrency(revenue),
        cost: formatCurrency(cost),
        profit: formatCurrency(profit)
      };
    })
  };

  // Render the Svelte component to HTML
  const html = await renderer.render(DailyReport, {
    props: emailProps
  });

  return html;
}
