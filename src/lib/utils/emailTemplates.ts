import { formatCurrency } from './formatters';

export function generateOrderEmailHtml(params: {
    selectedDate: string;
    view: string;
    filteredOrders: any[];
    totalUnitsSold: number;
    totalSales: number;
    totalCosts: number;
    totalProfit: number;
    mostProfitableSkus: any[];
    leastProfitableSkus: any[];
}) {
    const {
        selectedDate,
        view,
        filteredOrders,
        totalUnitsSold,
        totalSales,
        totalCosts,
        totalProfit,
        mostProfitableSkus,
        leastProfitableSkus
    } = params;

    const dateObj = selectedDate ? new Date(selectedDate) : new Date();
    const dateStr = dateObj.toLocaleDateString();
    const period = view === 'daily' ? 'Daily' : view === 'weekly' ? 'Weekly' : 'Monthly';

    // Top 5 Profitable
    const top5 = mostProfitableSkus
        .slice(0, 5)
        .map(
            (sku) => `
        <tr>
            <td style="padding: 5px; border: 1px solid #ddd;"><a href="https://operations.chefstorecookbook.com/dashboard/amazon/orders/sku/${encodeURIComponent(sku.sku)}">${sku.sku}</a></td>
            <td style="padding: 5px; border: 1px solid #ddd;">${sku.title}</td>
            <td style="padding: 5px; border: 1px solid #ddd; text-align: right;">${sku.soldCount}</td>
            <td style="padding: 5px; border: 1px solid #ddd; text-align: right; color: green;">${formatCurrency(sku.totalProfit)}</td>
        </tr>
    `
        )
        .join('');

    // Bottom 5 Profitable
    const bottom5 = leastProfitableSkus
        .slice(0, 5)
        .map(
            (sku) => `
        <tr>
            <td style="padding: 5px; border: 1px solid #ddd;"><a href="https://operations.chefstorecookbook.com/dashboard/amazon/orders/sku/${encodeURIComponent(sku.sku)}">${sku.sku}</a></td>
            <td style="padding: 5px; border: 1px solid #ddd;">${sku.title}</td>
            <td style="padding: 5px; border: 1px solid #ddd; text-align: right;">${sku.soldCount}</td>
            <td style="padding: 5px; border: 1px solid #ddd; text-align: right; color: red;">${formatCurrency(sku.totalProfit)}</td>
        </tr>
    `
        )
        .join('');

    // Sort orders by profit (highest first) for the email report
    const emailOrders = [...filteredOrders].sort((a, b) => {
        let profitA = a._calculated?.profit ?? 0;
        let profitB = b._calculated?.profit ?? 0;
        return profitB - profitA;
    });

    const allOrdersRows = emailOrders
        .map((order) => {
            const totalCost = order._calculated?.totalCost ?? 0;
            const shippingDisplay = order._calculated?.shippingDisplay ?? { amount: 0, type: '' };
            const profit = order._calculated?.profit ?? 0;
            const orderTotal = order._calculated?.orderRevenue ?? 0;

            const skus = order.amazon_order_items
                ?.map((i: any) => `<a href="https://operations.chefstorecookbook.com/dashboard/amazon/orders/sku/${encodeURIComponent(i.seller_sku)}">${i.seller_sku}</a>`)
                .join('; ') || '';
            const units = order.amazon_order_items?.reduce((sum: number, i: any) => sum + (Number(i.quantity_ordered) || 0), 0) || 0;
            const shipMethod = order.automated_ship_method || order.shipment_service_level_category || '';

            return `
        <tr>
            <td style="padding: 5px; border: 1px solid #ddd;"><a href="https://sellercentral.amazon.co.uk/orders-v3/order/${order.amazon_order_id}">${order.amazon_order_id}</a></td>
            <td style="padding: 5px; border: 1px solid #ddd; font-size: 0.8em; max-width: 150px; word-wrap: break-word;">${skus}</td>
            <td style="padding: 5px; border: 1px solid #ddd;">${order.order_status}</td>
            <td style="padding: 5px; border: 1px solid #ddd; text-align: right;">${formatCurrency(orderTotal)}</td>
            <td style="padding: 5px; border: 1px solid #ddd; text-align: right;">${formatCurrency(totalCost)}</td>
            <td style="padding: 5px; border: 1px solid #ddd; text-align: right;">${formatCurrency(shippingDisplay.amount)}</td>
            <td style="padding: 5px; border: 1px solid #ddd; text-align: right; color: ${profit >= 0 ? 'green' : 'red'};">${formatCurrency(profit)}</td>
            <td style="padding: 5px; border: 1px solid #ddd; text-align: center;">${units}</td>
            <td style="padding: 5px; border: 1px solid #ddd;">${shipMethod}</td>
            <td style="padding: 5px; border: 1px solid #ddd;">${order.is_prime ? 'Prime' : order.is_business_order ? 'Business' : 'Std'}</td>
        </tr>`;
        })
        .join('');

    return `
        <html>
        <body style="font-family: Arial, sans-serif;">
            <h2>Amazon Orders Report (${period})</h2>
            <p>
                <a href="https://operations.chefstorecookbook.com/dashboard/amazon/orders?date=${selectedDate}&view=${view}">
                    https://operations.chefstorecookbook.com/dashboard/amazon/orders?date=${selectedDate}&view=${view}
                </a>
            </p>
            <p>Date: ${dateStr}</p>
            
            <h3>Summary</h3>
            <table style="border-collapse: collapse; width: 100%; max-width: 600px; margin-bottom: 20px;">
                <tr style="background-color: #f8f9fa;">
                    <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Metric</th>
                    <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">Value</th>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">Total Orders</td>
                    <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${filteredOrders.length}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">Units Sold</td>
                    <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${totalUnitsSold}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">Total Sales</td>
                    <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${formatCurrency(totalSales)}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">Total Costs</td>
                    <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${formatCurrency(totalCosts)}</td>
                </tr>
                <tr style="font-weight: bold;">
                    <td style="padding: 8px; border: 1px solid #ddd;">Total Profit</td>
                    <td style="padding: 8px; text-align: right; border: 1px solid #ddd; color: ${totalProfit >= 0 ? 'green' : 'red'}">${formatCurrency(totalProfit)}</td>
                </tr>
            </table>

            <h3>Most Profitable Items</h3>
            <table style="border-collapse: collapse; width: 100%; max-width: 800px; margin-bottom: 20px;">
                <tr style="background-color: #f8f9fa;">
                    <th style="padding: 5px; text-align: left; border: 1px solid #ddd;">SKU</th>
                    <th style="padding: 5px; text-align: left; border: 1px solid #ddd;">Title</th>
                    <th style="padding: 5px; text-align: right; border: 1px solid #ddd;">Qty</th>
                    <th style="padding: 5px; text-align: right; border: 1px solid #ddd;">Profit</th>
                </tr>
                ${top5}
            </table>

            <h3>Least Profitable Items</h3>
            <table style="border-collapse: collapse; width: 100%; max-width: 800px; margin-bottom: 20px;">
                <tr style="background-color: #f8f9fa;">
                    <th style="padding: 5px; text-align: left; border: 1px solid #ddd;">SKU</th>
                    <th style="padding: 5px; text-align: left; border: 1px solid #ddd;">Title</th>
                    <th style="padding: 5px; text-align: right; border: 1px solid #ddd;">Qty</th>
                    <th style="padding: 5px; text-align: right; border: 1px solid #ddd;">Profit</th>
                </tr>
                ${bottom5}
            </table>
            
            <h3>All Orders</h3>
            <table style="border-collapse: collapse; width: 100%; font-size: 0.8rem;">
                <tr style="background-color: #f8f9fa;">
                    <th style="padding: 5px; border: 1px solid #ddd;">Order ID</th>
                    <th style="padding: 5px; border: 1px solid #ddd;">Products</th>
                    <th style="padding: 5px; border: 1px solid #ddd;">Status</th>
                    <th style="padding: 5px; border: 1px solid #ddd;">Sale Price</th>
                    <th style="padding: 5px; border: 1px solid #ddd;">Total Cost (inc Shipping)</th>
                    <th style="padding: 5px; border: 1px solid #ddd;">Shipping</th>
                    <th style="padding: 5px; border: 1px solid #ddd;">Profit</th>
                    <th style="padding: 5px; border: 1px solid #ddd;">Units</th>
                    <th style="padding: 5px; border: 1px solid #ddd;">Method</th>
                    <th style="padding: 5px; border: 1px solid #ddd;">Type</th>
                </tr>
                ${allOrdersRows}
            </table>
            
            <p style="font-size: 0.8rem; color: #666; margin-top: 20px;">Generated from Parkers Dashboard</p>
        </body>
        </html>
    `;
}
