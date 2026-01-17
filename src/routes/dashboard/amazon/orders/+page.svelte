<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button';
	import {
		RefreshCw,
		ArrowUpDown,
		ArrowUp,
		ArrowDown,
		Pencil,
		Bug,
		Download,
		Upload,
		Mail
	} from 'lucide-svelte';
	import { showToast } from '$lib/toastStore';
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page, navigating } from '$app/stores';
	import UpdateCostModal from '$lib/components/UpdateCostModal.svelte';
	import DebugModal from '$lib/components/DebugModal.svelte';
	import { syncStore } from '$lib/stores/syncStore';

	export let data;

	let orders: any[] = [];
	let isLoadingOrders = false;

	// Use a weak map or simple logic to prevent race conditions
	let currentLoadId = 0;

	$: if (data.streamed?.orders) {
		isLoadingOrders = true;
		orders = [];
		const loadId = ++currentLoadId;

		data.streamed.orders
			.then((res: any[]) => {
				if (loadId === currentLoadId) {
					// Pre-calculate costs once per load for sorting performance
					orders = res.map(enrichOrderWithTotals);
					isLoadingOrders = false;
				}
			})
			.catch((err) => {
				if (loadId === currentLoadId) {
					console.error('Failed to load orders', err);
					orders = [];
					isLoadingOrders = false;
				}
			});
	}

	function enrichOrderWithTotals(order: any) {
		let totalCost = 0;
		let estimatedShipping = 0;

		const enrichedItems = (order.amazon_order_items || []).map((item: any) => {
			let itemTotalCost = 0;
			if (item.costs) {
				const material = Number(item.costs.materialTotalCost) || 0;
				const shipping = Number(item.costs.shippingCost) || 0;
				const fee = Number(item.costs.amazonFee) || 0;
				const salesVat = Number(item.costs.salesVat) || 0;
				const qty = Number(item.quantity_ordered) || 0;

				itemTotalCost = (material + shipping + fee + salesVat) * qty;
				estimatedShipping += shipping * qty;
			}
			return {
				...item,
				_calculated: {
					totalCost: itemTotalCost
				}
			};
		});

		totalCost = enrichedItems.reduce((sum: number, i: any) => sum + i._calculated.totalCost, 0);

		const orderRevenue = parseFloat(order.order_total) || 0;
		const startProfit = (order.order_status === 'Canceled' ? 0 : orderRevenue) - totalCost;

		// Logic derived from getShippingCostDisplay
		let shippingDisplay;
		if (order.shipping_cost !== null && order.shipping_cost !== undefined) {
			shippingDisplay = {
				amount: Number(order.shipping_cost),
				type: '(Actual)',
				class: 'text-blue-600 font-medium'
			};
		} else {
			shippingDisplay = {
				amount: Number(estimatedShipping),
				type: '(Est.)',
				class: 'text-muted-foreground'
			};
		}

		return {
			...order,
			amazon_order_items: enrichedItems,
			_calculated: {
				totalCost,
				profit: startProfit,
				orderRevenue,
				shippingDisplay
			}
		};
	}

	let sortColumn = 'purchase_date';
	let sortDirection: 'asc' | 'desc' = 'desc';

	$: view = $page.url.searchParams.get('view') || 'daily';

	// Auto-reload when sync completes
	let wasSyncing = false;
	$: {
		if ($syncStore.syncing) {
			wasSyncing = true;
		} else if (wasSyncing && $syncStore.status.includes('Complete')) {
			wasSyncing = false;
			window.location.reload();
		}
	}

	// Modal state
	let showUpdateCostModal = false;
	let selectedSku = '';
	let selectedTitle = '';
	let selectedAsin = '';

	// Debug Modal state
	let showDebugModal = false;
	let debugLogs: string[] = [];
	let debugTitle = '';

	function openUpdateCostModal(sku: string, title: string, asin: string) {
		selectedSku = sku;
		selectedTitle = title;
		selectedAsin = asin;
		showUpdateCostModal = true;
	}

	async function openDebugModal(orderId: string, sku: string) {
		debugTitle = `Debug: ${sku}`;
		debugLogs = ['Loading...'];
		showDebugModal = true;

		try {
			const res = await fetch(
				`/api/amazon/orders/debug?orderId=${orderId}&sku=${encodeURIComponent(sku)}`
			);
			const data = await res.json();
			if (data.logs) {
				debugLogs = data.logs;
			} else {
				debugLogs = ['No logs returned', JSON.stringify(data)];
			}
		} catch (e) {
			debugLogs = ['Error fetching debug info', String(e)];
		}
	}

	let isSyncingProcessing = false;

	async function syncLinnworksOrder(orderId: string, skipReload = false) {
		try {
			if (!skipReload) showToast(`Syncing Linnworks data for ${orderId}...`, 'info');
			const res = await fetch('/api/linnworks/sync-order', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ orderId })
			});
			const data = await res.json();

			if (res.ok && data.success) {
				if (!skipReload) {
					showToast(`Synced: ${data.data.service}`, 'success');
					setTimeout(() => window.location.reload(), 1000);
				}
				return true;
			} else {
				if (!skipReload) showToast(data.error || 'Failed to sync with Linnworks', 'error');
				return false;
			}
		} catch (e) {
			if (!skipReload) showToast('Error syncing Linnworks data', 'error');
			console.error(e);
			return false;
		}
	}

	async function syncMissingCarriers() {
		// Modified: Sync ALL non-canceled orders for testing, except Amazon Shipping
		const targetOrders = (filteredOrders || []).filter(
			(o) =>
				o.order_status !== 'Canceled' &&
				o.order_status !== 'Pending' &&
				(!o.automated_carrier || !o.automated_carrier.toLowerCase().includes('amazon')) &&
				(!o.shipment_service_level_category ||
					!o.shipment_service_level_category.toLowerCase().includes('amazon'))
		);

		if (targetOrders.length === 0) {
			showToast('No eligible orders found (excluding Amazon).', 'info');
			return;
		}

		if (
			!confirm(
				`Found ${targetOrders.length} eligible orders (excluding Amazon). Sync ALL with Linnworks now? This may take a moment.`
			)
		) {
			return;
		}

		isSyncingProcessing = true;
		let successCount = 0;
		let failCount = 0;

		showToast(`Starting sync for ${targetOrders.length} orders...`, 'info');

		// Process sequentially to be gentle on the API
		for (let i = 0; i < targetOrders.length; i++) {
			const order = targetOrders[i];
			// Optional: Update global progress toast here if we had one
			const success = await syncLinnworksOrder(order.amazon_order_id, true);
			if (success) successCount++;
			else failCount++;

			// Small delay between requests
			await new Promise((r) => setTimeout(r, 300));
		}

		isSyncingProcessing = false;
		showToast(`Sync Complete. Updated: ${successCount}. Failed/Not Found: ${failCount}`, 'success');
		setTimeout(() => window.location.reload(), 1500);
	}

	async function syncSingleOrder(orderId: string) {
		try {
			showToast(`Syncing order ${orderId}...`, 'info');
			const res = await fetch(`/api/amazon/orders/sync-single?orderId=${orderId}`);
			const data = await res.json();

			if (data.success) {
				showToast('Order synced successfully', 'success');
				setTimeout(() => window.location.reload(), 1000);
			} else {
				showToast(data.error || 'Failed to sync order', 'error');
			}
		} catch (e) {
			showToast('Error syncing order', 'error');
			console.error(e);
		}
	}

	$: selectedDate = data.date;
	let searchTerm = data.search || '';
	$: if (data.search !== undefined) searchTerm = data.search;

	function performSearch() {
		if (searchTerm.trim()) {
			goto(`?search=${encodeURIComponent(searchTerm.trim())}`);
		} else {
			goto(`?`);
		}
	}

	function getShippingCostDisplay(order: any) {
		if (order.shipping_cost !== null && order.shipping_cost !== undefined) {
			return {
				amount: Number(order.shipping_cost),
				type: '(Actual)',
				class: 'text-blue-600 font-medium'
			};
		}

		if (!order.amazon_order_items)
			return { amount: 0, type: '(Est.)', class: 'text-muted-foreground' };

		const estimatedTotal = order.amazon_order_items.reduce((sum: number, item: any) => {
			if (item.costs) {
				return sum + (Number(item.costs.shippingCost) || 0) * (Number(item.quantity_ordered) || 0);
			}
			return sum;
		}, 0);

		return {
			amount: estimatedTotal,
			type: '(Est.)',
			class: 'text-muted-foreground'
		};
	}

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

	$: filteredOrders = (orders || []).filter((o) => o.order_status !== 'Pending');

	// SKU Analysis
	interface SkuStats {
		sku: string;
		title: string;
		asin: string;
		orderCount: number;
		unitCount: number;
		soldCount: number;
		totalRevenue: number;
		totalProfit: number;
		avgProfit: number;
		hasCostData: boolean;
	}

	$: skuStats = filteredOrders.reduce((acc: Record<string, SkuStats>, order: any) => {
		if (!order.amazon_order_items) return acc;
		if (order.order_status === 'Canceled') return acc;

		order.amazon_order_items.forEach((item: any) => {
			if (!item.seller_sku) return;

			const sku = item.seller_sku;
			if (!acc[sku]) {
				acc[sku] = {
					sku,
					title: item.title || 'Unknown',
					asin: item.asin || '',
					orderCount: 0,
					unitCount: 0,
					soldCount: 0,
					totalRevenue: 0,
					totalProfit: 0,
					avgProfit: 0,
					hasCostData: false
				};
			}

			const qty = Number(item.quantity_ordered) || 0;
			const bundleQty = Number(item.bundle_quantity) || 1;

			acc[sku].soldCount += qty;
			acc[sku].unitCount += qty * bundleQty;
			acc[sku].orderCount += 1;

			// Calculate profit for this item
			// Item Revenue
			const itemPrice = Number(item.item_price_amount) || 0;
			const revenue = itemPrice; // item_price_amount is total for the line
			acc[sku].totalRevenue += revenue;

			// Item Cost
			let itemCost = 0;

			if (item._calculated) {
				itemCost = item._calculated.totalCost;
				if (item.costs) acc[sku].hasCostData = true;
			} else if (item.costs) {
				acc[sku].hasCostData = true;
				const material = Number(item.costs.materialTotalCost) || 0;
				const shipping = Number(item.costs.shippingCost) || 0;
				const fee = Number(item.costs.amazonFee) || 0;
				const salesVat = Number(item.costs.salesVat) || 0;
				itemCost = (material + shipping + fee + salesVat) * qty;
			}

			const profit = revenue - itemCost;
			acc[sku].totalProfit += profit;
		});
		return acc;
	}, {});

	$: skuList = Object.values(skuStats).map((stat) => ({
		...stat,
		avgProfit: stat.orderCount > 0 ? stat.totalProfit / stat.orderCount : 0
	}));

	$: topSellingSkus = [...skuList].sort((a, b) => b.orderCount - a.orderCount).slice(0, 10);
	$: leastSellingSkus = [...skuList]
		.filter((s) => s.orderCount > 0)
		.sort((a, b) => a.orderCount - b.orderCount)
		.slice(0, 10);
	$: mostProfitableSkus = [...skuList]
		.filter((s) => s.hasCostData)
		.sort((a, b) => b.totalProfit - a.totalProfit)
		.slice(0, 10);
	$: leastProfitableSkus = [...skuList]
		.filter((s) => s.hasCostData && s.orderCount > 0)
		.sort((a, b) => a.totalProfit - b.totalProfit)
		.slice(0, 10);

	// Profit Analysis (Bottom 50% Performers)
	$: profitAnalysisStats = (() => {
		// Only consider orders that have cost data to match the summary cards logic
		// The summary cards calculate Total Profit by summing (revenue - cost) ONLY for items that have cost data.
		// We must replicate this logic to ensure the totals match.
		const analyzedOrders = filteredOrders
			.map((order) => {
				if (!order.amazon_order_items) return null;

				// Calculate metrics only for items with costs
				const metrics = order.amazon_order_items.reduce(
					(acc: any, item: any) => {
						if (item.costs) {
							const qty = Number(item.quantity_ordered) || 0;
							const revenue = Number(item.item_price_amount) || 0;

							let cost = 0;
							if (item._calculated) {
								cost = item._calculated.totalCost;
							} else {
								const material = Number(item.costs.materialTotalCost) || 0;
								const shipping = Number(item.costs.shippingCost) || 0;
								const fee = Number(item.costs.amazonFee) || 0;
								const salesVat = Number(item.costs.salesVat) || 0;
								cost = (material + shipping + fee + salesVat) * qty;
							}

							acc.revenue += revenue;
							acc.cost += cost;
							acc.hasData = true;
						}
						return acc;
					},
					{ revenue: 0, cost: 0, hasData: false }
				);

				if (!metrics.hasData) return null;

				return {
					...order,
					calculatedProfit: metrics.revenue - metrics.cost
				};
			})
			.filter((o): o is NonNullable<typeof o> => o !== null)
			.sort((a, b) => a.calculatedProfit - b.calculatedProfit);

		const totalProfit = analyzedOrders.reduce((sum, o) => sum + o.calculatedProfit, 0);
		const bottom50Count = Math.ceil(analyzedOrders.length * 0.5);
		const bottom50Orders = analyzedOrders.slice(0, bottom50Count);
		const bottom50Profit = bottom50Orders.reduce((sum, o) => sum + o.calculatedProfit, 0);

		return {
			bottom50PercentCount: bottom50Count,
			bottom50PercentProfit: bottom50Profit,
			totalProfit: totalProfit,
			bottom50PercentProfitShare: totalProfit !== 0 ? (bottom50Profit / totalProfit) * 100 : 0
		};
	})();

	let showProfitStats = false;

	$: sortedOrders = [...filteredOrders].sort((a, b) => {
		// Use cached values for sorting
		let aValue: any;
		let bValue: any;

		if (sortColumn === 'order_total') {
			aValue = a._calculated.orderRevenue;
			bValue = b._calculated.orderRevenue;
		} else if (sortColumn === 'total_cost') {
			aValue = a._calculated.totalCost;
			bValue = b._calculated.totalCost;
		} else if (sortColumn === 'shipping_cost') {
			aValue = a._calculated.shippingDisplay.amount;
			bValue = b._calculated.shippingDisplay.amount;
		} else if (sortColumn === 'profit') {
			aValue = a._calculated.profit;
			bValue = b._calculated.profit;
		} else {
			// specific standard column handling
			aValue = a[sortColumn];
			bValue = b[sortColumn];
		}

		if (aValue === bValue) return 0;
		if (aValue === null || aValue === undefined) return 1;
		if (bValue === null || bValue === undefined) return -1;

		const comparison = aValue > bValue ? 1 : -1;
		return sortDirection === 'asc' ? comparison : -comparison;
	});

	$: analyzedStats = sortedOrders.reduce(
		(acc, order) => {
			if (!order.amazon_order_items) return acc;

			order.amazon_order_items.forEach((item: any) => {
				const qty = Number(item.quantity_ordered) || 0;
				acc.units += qty * (item.bundle_quantity || 1);

				if (item.costs) {
					const itemPrice = Number(item.item_price_amount) || 0;
					const revenue = itemPrice; // item_price_amount is total for the line

					const material = Number(item.costs.materialTotalCost) || 0;
					const shipping = Number(item.costs.shippingCost) || 0;
					const fee = Number(item.costs.amazonFee) || 0;
					const salesVat = Number(item.costs.salesVat) || 0;
					const itemCost = (material + shipping + fee + salesVat) * qty;

					acc.sales += revenue;
					acc.costs += itemCost;
				}
			});
			return acc;
		},
		{ sales: 0, costs: 0, units: 0 }
	);

	$: totalSales = analyzedStats.sales;
	$: totalCosts = analyzedStats.costs;
	$: totalProfit = analyzedStats.sales - analyzedStats.costs;
	$: totalUnitsSold = analyzedStats.units;

	// Shipping Service Analysis
	$: shippingStats = filteredOrders.reduce((acc: Record<string, any>, order: any) => {
		const totalCost = calculateOrderCost(order);

		// Only include orders with cost data to avoid skewing profit stats
		if (totalCost <= 0) return acc;

		const carrier = order.automated_carrier || 'Unknown';
		const method =
			order.automated_ship_method || order.shipment_service_level_category || 'Unknown';

		// Exclude Return to Origin (RTO) shipments as they are not valid sales
		if (method === 'SWA-UK-RTO' || method === 'Amazon Return to Origin') return acc;

		const service = `${carrier} - ${method}`;

		if (!acc[service]) {
			acc[service] = {
				name: service,
				orderCount: 0,
				totalProfit: 0,
				totalRevenue: 0
			};
		}

		acc[service].orderCount += 1;

		const revenue = parseFloat(order.order_total) || 0;
		const profit = revenue - totalCost;

		acc[service].totalProfit += profit;
		acc[service].totalRevenue += revenue;

		return acc;
	}, {});

	$: shippingStatsList = Object.values(shippingStats).sort(
		(a: any, b: any) => b.totalProfit - a.totalProfit
	);

	function toggleSort(column: string) {
		if (sortColumn === column) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			// Default to descending for money columns, ascending for text
			if (['order_total', 'total_cost', 'shipping_cost', 'profit'].includes(column)) {
				sortDirection = 'desc';
			} else {
				sortDirection = 'asc';
			}
		}
	}

	async function syncOrders() {
		syncStore.startSync(selectedDate || '', view);
	}
	function getStatusColor(status: string) {
		switch (status) {
			case 'Shipped':
				return 'bg-green-100 text-green-800 border-green-200';
			case 'Unshipped':
				return 'bg-yellow-100 text-yellow-800 border-yellow-200';
			case 'Canceled':
				return 'bg-red-100 text-red-800 border-red-200';
			case 'Pending':
				return 'bg-blue-100 text-blue-800 border-blue-200';
			default:
				return 'bg-gray-100 text-gray-800 border-gray-200';
		}
	}

	function formatDate(dateString: string) {
		if (!dateString) return '-';
		return new Date(dateString).toLocaleString();
	}

	function formatCurrency(amount: number | null, currency: string | null = 'GBP') {
		if (amount === null || amount === undefined) return '-';
		// Fallback to GBP if currency is null/undefined/empty
		const safeCurrency = currency || 'GBP';
		try {
			return new Intl.NumberFormat('en-GB', { style: 'currency', currency: safeCurrency }).format(
				amount
			);
		} catch (e) {
			// Fallback if the currency code itself is invalid (e.g. garbage data)
			return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
		}
	}

	function getProfitAnalysis(sku: SkuStats) {
		if (sku.orderCount === 0) return { label: 'No Orders', color: 'text-gray-500' };
		if (sku.totalRevenue === 0) return { label: 'No Revenue', color: 'text-orange-500' };
		if (sku.avgProfit === 0) return { label: 'Break-even', color: 'text-yellow-600' };
		if (sku.avgProfit < 0) return { label: 'Loss Making', color: 'text-red-600' };
		return { label: 'Low Margin', color: 'text-yellow-600' };
	}

	function downloadEmailReport() {
		const dateObj = selectedDate ? new Date(selectedDate) : new Date();
		const dateStr = dateObj.toLocaleDateString();
		const subject = `Amazon Orders Report - ${dateStr}`;
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
			// Use cached profit if available
			let profitA = a._calculated
				? a._calculated.profit
				: (parseFloat(a.order_total) || 0) - calculateOrderCost(a);
			let profitB = b._calculated
				? b._calculated.profit
				: (parseFloat(b.order_total) || 0) - calculateOrderCost(b);

			return profitB - profitA;
		});

		// All Orders Table Rows
		const allOrdersRows = emailOrders
			.map((order) => {
				const isCanceled = order.order_status === 'Canceled';

				// Use cached values
				let totalCost, shippingDisplay, profit, orderTotal;

				if (order._calculated) {
					totalCost = order._calculated.totalCost;
					shippingDisplay = order._calculated.shippingDisplay;
					profit = order._calculated.profit;
					orderTotal = order._calculated.orderRevenue;
				} else {
					// Fallback
					totalCost = calculateOrderCost(order);
					shippingDisplay = getShippingCostDisplay(order);
					orderTotal = parseFloat(order.order_total) || 0;
					if (isCanceled) orderTotal = 0;
					profit = orderTotal - totalCost;
				}

				const skus =
					order.amazon_order_items
						?.map(
							(i: any) =>
								`<a href="https://operations.chefstorecookbook.com/dashboard/amazon/orders/sku/${encodeURIComponent(i.seller_sku)}">${i.seller_sku}</a>`
						)
						.join('; ') || '';
				const units =
					order.amazon_order_items?.reduce(
						(sum: number, i: any) => sum + (Number(i.quantity_ordered) || 0),
						0
					) || 0;
				const shipMethod =
					order.automated_ship_method || order.shipment_service_level_category || '';

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

		const htmlBody = `
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

		const to = '';
		const headers = [
			...(to?.trim() ? [`To: ${to.trim()}`] : []),
			`Subject: ${subject}`,
			`X-Unsent: 1`,
			`MIME-Version: 1.0`,
			`Content-Type: text/html; charset=utf-8`,
			`Content-Transfer-Encoding: 8bit`
		].join('\r\n');

		const emlContent = `${headers}\r\n\r\n${htmlBody}`;

		const blob = new Blob([emlContent], { type: 'message/rfc822' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `Amazon_Report_${new Date().toISOString().split('T')[0]}.eml`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}

	function downloadCSV() {
		const headers = [
			'Order ID',
			'Purchase Date',
			'Status',
			'Order Total',
			'Total Cost',
			'Shipping Cost',
			'Shipping Type',
			'Profit',
			'Currency',
			'Items Shipped',
			'Items Unshipped',
			'Carrier',
			'Ship Method',
			'Is Prime',
			'Is Business',
			'Is Premium',
			'SKUs'
		];

		const rows = sortedOrders.map((order) => {
			let totalCost, shippingDisplay, orderTotal, profit;

			if (order._calculated) {
				totalCost = order._calculated.totalCost;
				shippingDisplay = order._calculated.shippingDisplay;
				orderTotal = order._calculated.orderRevenue;
				profit = order._calculated.profit;
			} else {
				totalCost = calculateOrderCost(order);
				shippingDisplay = getShippingCostDisplay(order);
				orderTotal = parseFloat(order.order_total) || 0;
				profit = orderTotal - totalCost;
			}

			const skus = order.amazon_order_items?.map((i: any) => i.seller_sku).join('; ') || '';

			return [
				order.amazon_order_id,
				order.purchase_date,
				order.order_status,
				orderTotal.toFixed(2),
				totalCost.toFixed(2),
				shippingDisplay.amount.toFixed(2),
				shippingDisplay.type,
				profit.toFixed(2),
				order.currency_code,
				order.number_of_items_shipped,
				order.number_of_items_unshipped,
				order.automated_carrier || '',
				order.automated_ship_method || order.shipment_service_level_category || '',
				order.is_prime ? 'Yes' : 'No',
				order.is_business_order ? 'Yes' : 'No',
				order.is_premium_order ? 'Yes' : 'No',
				`"${skus}"`
			].join(',');
		});

		const csvContent = [headers.join(','), ...rows].join('\n');
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		const url = URL.createObjectURL(blob);
		link.setAttribute('href', url);
		link.setAttribute('download', `amazon_orders_${selectedDate || 'all'}.csv`);
		link.style.visibility = 'hidden';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}
</script>

{#if $navigating || isLoadingOrders}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
	>
		<div class="flex flex-col items-center gap-2">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
			></div>
			<p class="text-sm font-medium text-muted-foreground">Loading orders...</p>
		</div>
	</div>
{/if}

<div class="flex flex-col gap-6 p-6">
	<div class="bg-yellow-50 border-l-4 border-yellow-400 p-4">
		<div class="flex">
			<div class="shrink-0">
				<Bug class="h-5 w-5 text-yellow-400" />
			</div>
			<div class="ml-3">
				<p class="text-sm text-yellow-700">
					<span class="font-medium">Work in Progress</span>
					- This page is currently under active development. Data and calculations may be subject to
					verification.
				</p>
			</div>
		</div>
	</div>

	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Amazon Orders</h1>
			<p class="text-muted-foreground">View your Amazon orders with cost analysis</p>
		</div>
		<div class="flex flex-col items-end gap-2">
			<div class="flex items-center gap-2">
				<form
					onsubmit={(e) => {
						e.preventDefault();
						performSearch();
					}}
					class="flex gap-2"
				>
					<input
						type="text"
						placeholder="Search Order ID, SKU, ASIN..."
						class="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-64"
						bind:value={searchTerm}
					/>
				</form>
				<div class="flex items-center rounded-md border bg-muted p-1">
					<button
						class="rounded-sm px-3 py-1 text-sm font-medium transition-all {view === 'daily'
							? 'bg-background text-foreground shadow-sm'
							: 'text-muted-foreground hover:bg-background/50'}"
						onclick={() => goto(`?date=${selectedDate}&view=daily`)}
					>
						Daily
					</button>
					<button
						class="rounded-sm px-3 py-1 text-sm font-medium transition-all {view === 'weekly'
							? 'bg-background text-foreground shadow-sm'
							: 'text-muted-foreground hover:bg-background/50'}"
						onclick={() => goto(`?date=${selectedDate}&view=weekly`)}
					>
						Weekly
					</button>
				</div>
				<input
					type="date"
					class="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					bind:value={selectedDate}
					onchange={() => goto(`?date=${selectedDate}&view=${view}`)}
				/>
				<Button variant="outline" onclick={() => goto('/dashboard/tools/upload-shipping')}>
					<Upload class="mr-2 h-4 w-4" />
					Upload Shipping Costs
				</Button>
				<Button variant="outline" onclick={() => goto('/dashboard/tools/cost-manager')}>
					<Upload class="mr-2 h-4 w-4" />
					Cost Manager
				</Button>
				<Button variant="outline" onclick={downloadEmailReport}>
					<Mail class="mr-2 h-4 w-4" />
					Email Report
				</Button>
				<Button variant="outline" onclick={syncMissingCarriers} disabled={isSyncingProcessing}>
					<RefreshCw class="mr-2 h-4 w-4 {isSyncingProcessing ? 'animate-spin' : ''}" />
					{isSyncingProcessing ? 'Syncing...' : 'Sync All (Test)'}
				</Button>
				<Button variant="outline" onclick={downloadCSV}>
					<Download class="mr-2 h-4 w-4" />
					Export CSV
				</Button>
				<Button onclick={syncOrders} disabled={$syncStore.syncing}>
					<RefreshCw class="mr-2 h-4 w-4 {$syncStore.syncing ? 'animate-spin' : ''}" />
					{$syncStore.syncing ? 'Syncing...' : 'Sync Orders'}
				</Button>
			</div>
		</div>
	</div>

	<div class="grid gap-4 md:grid-cols-5">
		<div class="rounded-xl border bg-card text-card-foreground shadow">
			<div class="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
				<h3 class="tracking-tight text-sm font-medium">Total Orders</h3>
			</div>
			<div class="p-6 pt-0">
				<div class="text-2xl font-bold">{filteredOrders.length}</div>
			</div>
		</div>
		<div class="rounded-xl border bg-card text-card-foreground shadow">
			<div class="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
				<h3 class="tracking-tight text-sm font-medium">Units Sold</h3>
			</div>
			<div class="p-6 pt-0">
				<div class="text-2xl font-bold">{totalUnitsSold}</div>
			</div>
		</div>
		<div class="rounded-xl border bg-card text-card-foreground shadow">
			<div class="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
				<h3 class="tracking-tight text-sm font-medium">Total Sales</h3>
			</div>
			<div class="p-6 pt-0">
				<div class="text-2xl font-bold">{formatCurrency(totalSales)}</div>
			</div>
		</div>
		<div class="rounded-xl border bg-card text-card-foreground shadow">
			<div class="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
				<h3 class="tracking-tight text-sm font-medium">Total Costs</h3>
			</div>
			<div class="p-6 pt-0">
				<div class="text-2xl font-bold">{formatCurrency(totalCosts)}</div>
			</div>
		</div>
		<div class="rounded-xl border bg-card text-card-foreground shadow">
			<div class="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
				<h3 class="tracking-tight text-sm font-medium">Total Profit</h3>
			</div>
			<div class="p-6 pt-0">
				<div class="text-2xl font-bold {totalProfit > 0 ? 'text-green-600' : 'text-red-600'}">
					{totalProfit > 0 ? '+' : ''}{formatCurrency(totalProfit)}
				</div>
			</div>
		</div>
	</div>

	<!-- Profit Stats Collapsible -->
	<div class="rounded-xl border bg-card text-card-foreground shadow overflow-hidden">
		<button
			class="w-full px-6 py-4 bg-muted/30 flex justify-between items-center hover:bg-muted/50 transition-colors"
			onclick={() => (showProfitStats = !showProfitStats)}
		>
			<span class="font-semibold text-foreground">Profit Analysis (Bottom 50% Performers)</span>
			<span
				class="text-muted-foreground transform transition-transform {showProfitStats
					? 'rotate-180'
					: ''}"
			>
				▼
			</span>
		</button>

		{#if showProfitStats}
			<div class="p-6 border-t bg-card">
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
					<div class="p-4 bg-red-50/50 rounded-lg border border-red-100">
						<p class="text-sm text-muted-foreground uppercase tracking-wide">Orders</p>
						<p class="text-2xl font-bold text-red-700">
							{profitAnalysisStats.bottom50PercentCount} orders
						</p>
						<p class="text-xs text-muted-foreground">50% of total volume</p>
					</div>

					<div class="p-4 bg-yellow-50/50 rounded-lg border border-yellow-100">
						<p class="text-sm text-muted-foreground uppercase tracking-wide">Profit Generated</p>
						<p class="text-2xl font-bold text-yellow-700">
							{formatCurrency(profitAnalysisStats.bottom50PercentProfit)}
						</p>
						<p class="text-xs text-muted-foreground">From bottom 50%</p>
					</div>

					<div class="p-4 bg-blue-50/50 rounded-lg border border-blue-100">
						<p class="text-sm text-muted-foreground uppercase tracking-wide">Profit Share</p>
						<p class="text-2xl font-bold text-blue-700">
							{profitAnalysisStats.bottom50PercentProfitShare.toFixed(1)}%
						</p>
						<p class="text-xs text-muted-foreground">of total profit</p>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Shipping Service Analysis -->
	<div class="rounded-xl border bg-card text-card-foreground shadow">
		<div class="p-6 pb-2">
			<h3 class="font-semibold leading-none tracking-tight">Profit by Shipping Service</h3>
		</div>
		<div class="p-6 pt-0">
			<div class="relative w-full overflow-auto">
				<table class="w-full caption-bottom text-sm">
					<thead class="[&_tr]:border-b">
						<tr class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
							<th
								class="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[300px]"
								>Service</th
							>
							<th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground"
								>Orders</th
							>
							<th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground"
								>Revenue</th
							>
							<th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground"
								>Total Profit</th
							>
							<th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground"
								>Avg Profit / Order</th
							>
						</tr>
					</thead>
					<tbody class="[&_tr:last-child]:border-0">
						{#each shippingStatsList as stat}
							<tr class="border-b transition-colors hover:bg-muted/50">
								<td class="p-4 align-middle font-medium">{stat.name}</td>
								<td class="p-4 align-middle text-right">{stat.orderCount}</td>
								<td class="p-4 align-middle text-right">{formatCurrency(stat.totalRevenue)}</td>
								<td
									class="p-4 align-middle text-right {stat.totalProfit > 0
										? 'text-green-600'
										: 'text-red-600'}"
								>
									{formatCurrency(stat.totalProfit)}
								</td>
								<td
									class="p-4 align-middle text-right {stat.totalProfit > 0
										? 'text-green-600'
										: 'text-red-600'}"
								>
									{formatCurrency(stat.orderCount ? stat.totalProfit / stat.orderCount : 0)}
								</td>
							</tr>
						{/each}
						{#if shippingStatsList.length === 0}
							<tr>
								<td colspan="5" class="p-4 text-center text-muted-foreground">No data available</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	</div>

	<div class="grid gap-4 md:grid-cols-2">
		<!-- Top Selling SKUs -->
		<div class="rounded-xl border bg-card text-card-foreground shadow col-span-1">
			<div class="p-6 pb-2">
				<h3 class="font-semibold leading-none tracking-tight">Most Orders (Top 10)</h3>
			</div>
			<div class="p-6 pt-0">
				<div class="relative w-full overflow-auto max-h-[400px]">
					<table class="w-full caption-bottom text-sm">
						<thead class="[&_tr]:border-b sticky top-0 bg-card">
							<tr
								class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
							>
								<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
									>SKU</th
								>
								<th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground"
									>Order Count</th
								>
								<th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground"
									>Unit Count</th
								>
							</tr>
						</thead>
						<tbody class="[&_tr:last-child]:border-0">
							{#each topSellingSkus as sku}
								<tr
									class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
								>
									<td class="p-4 align-middle font-medium">
										<div class="flex flex-col">
											<a
												href="/dashboard/amazon/orders/sku/{sku.sku
													.replace(/\s+-\s+/g, '-')
													.replace(/\s+/g, '-')}"
												class="font-semibold text-blue-600 hover:underline"
											>
												{sku.sku}
											</a>
											<span class="text-xs text-muted-foreground">{sku.title}</span>
										</div>
									</td>
									<td class="p-4 align-middle text-right">{sku.orderCount}</td>
									<td class="p-4 align-middle text-right">{sku.unitCount}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>

		<!-- Least Selling SKUs -->
		<div class="rounded-xl border bg-card text-card-foreground shadow col-span-1">
			<div class="p-6 pb-2">
				<h3 class="font-semibold leading-none tracking-tight">Least Orders (Bottom 10)</h3>
			</div>
			<div class="p-6 pt-0">
				<div class="relative w-full overflow-auto max-h-[400px]">
					<table class="w-full caption-bottom text-sm">
						<thead class="[&_tr]:border-b sticky top-0 bg-card">
							<tr
								class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
							>
								<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
									>SKU</th
								>
								<th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground"
									>Order Count</th
								>
								<th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground"
									>Unit Count</th
								>
							</tr>
						</thead>
						<tbody class="[&_tr:last-child]:border-0">
							{#each leastSellingSkus as sku}
								<tr
									class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
								>
									<td class="p-4 align-middle font-medium">
										<div class="flex flex-col">
											<a
												href="/dashboard/amazon/orders/sku/{sku.sku
													.replace(/\s+-\s+/g, '-')
													.replace(/\s+/g, '-')}"
												class="font-semibold text-blue-600 hover:underline"
											>
												{sku.sku}
											</a>
											<span class="text-xs text-muted-foreground">{sku.title}</span>
										</div>
									</td>
									<td class="p-4 align-middle text-right">{sku.orderCount}</td>
									<td class="p-4 align-middle text-right">{sku.unitCount}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>

		<!-- Most Profitable SKUs -->
		<div class="rounded-xl border bg-card text-card-foreground shadow col-span-1">
			<div class="p-6 pb-2">
				<h3 class="font-semibold leading-none tracking-tight">Most Profitable SKUs (Total)</h3>
			</div>
			<div class="p-6 pt-0">
				<div class="relative w-full overflow-auto max-h-[400px]">
					<table class="w-full caption-bottom text-sm">
						<thead class="[&_tr]:border-b sticky top-0 bg-card">
							<tr
								class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
							>
								<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
									>SKU</th
								>
								<th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground"
									>Order Count</th
								>
								<th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground"
									>Unit Count</th
								>
								<th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground"
									>Total Profit</th
								>
								<th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground"
									>Avg Profit</th
								>
							</tr>
						</thead>
						<tbody class="[&_tr:last-child]:border-0">
							{#each mostProfitableSkus as sku}
								<tr
									class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
								>
									<td class="p-4 align-middle font-medium">
										<div class="flex flex-col">
											<a
												href="/dashboard/amazon/orders/sku/{sku.sku
													.replace(/\s+-\s+/g, '-')
													.replace(/\s+/g, '-')}"
												class="font-semibold text-blue-600 hover:underline"
											>
												{sku.sku}
											</a>
											<span class="text-xs text-muted-foreground">{sku.title}</span>
										</div>
									</td>
									<td class="p-4 align-middle text-right">{sku.orderCount}</td>
									<td class="p-4 align-middle text-right">{sku.unitCount}</td>
									<td class="p-4 align-middle text-right text-green-600"
										>{formatCurrency(sku.totalProfit)}</td
									>
									<td class="p-4 align-middle text-right text-green-600"
										>{formatCurrency(sku.avgProfit)}</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>

		<!-- Least Profitable SKUs -->
		<div class="rounded-xl border bg-card text-card-foreground shadow col-span-1">
			<div class="p-6 pb-2">
				<h3 class="font-semibold leading-none tracking-tight">Least Profitable SKUs (Total)</h3>
			</div>
			<div class="p-6 pt-0">
				<div class="relative w-full overflow-auto max-h-[400px]">
					<table class="w-full caption-bottom text-sm">
						<thead class="[&_tr]:border-b sticky top-0 bg-card">
							<tr
								class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
							>
								<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
									>SKU</th
								>
								<th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground"
									>Order Count</th
								>
								<th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground"
									>Unit Count</th
								>
								<th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground"
									>Total Profit</th
								>
								<th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground"
									>Avg Profit</th
								>
								<th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground"
									>Insight</th
								>
							</tr>
						</thead>
						<tbody class="[&_tr:last-child]:border-0">
							{#each leastProfitableSkus as sku}
								{@const analysis = getProfitAnalysis(sku)}
								<tr
									class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
								>
									<td class="p-4 align-middle font-medium">
										<div class="flex flex-col">
											<a
												href="/dashboard/amazon/orders/sku/{sku.sku
													.replace(/\s+-\s+/g, '-')
													.replace(/\s+/g, '-')}"
												class="font-semibold text-blue-600 hover:underline"
											>
												{sku.sku}
											</a>
											<span class="text-xs text-muted-foreground">{sku.title}</span>
										</div>
									</td>
									<td class="p-4 align-middle text-right">{sku.orderCount}</td>
									<td class="p-4 align-middle text-right">{sku.unitCount}</td>
									<td
										class="p-4 align-middle text-right {sku.totalProfit < 0
											? 'text-red-600'
											: 'text-green-600'}">{formatCurrency(sku.totalProfit)}</td
									>
									<td
										class="p-4 align-middle text-right {sku.avgProfit < 0
											? 'text-red-600'
											: 'text-green-600'}">{formatCurrency(sku.avgProfit)}</td
									>
									<td class="p-4 align-middle text-right">
										<span
											class="text-xs font-medium px-2 py-1 rounded-full bg-muted {analysis.color}"
										>
											{analysis.label}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</div>

	<div class="rounded-lg border bg-card text-card-foreground shadow-sm">
		<div class="flex flex-col space-y-1.5 p-6">
			<h3 class="text-2xl font-semibold leading-none tracking-tight">Recent Orders</h3>
			<p class="text-sm text-muted-foreground">A list of recent orders from Amazon.</p>
		</div>
		<div class="p-6 pt-0">
			<div class="relative w-full overflow-auto">
				<table class="w-full caption-bottom text-sm">
					<thead class="[&_tr]:border-b">
						<tr class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
							<th
								class="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground"
								onclick={() => toggleSort('amazon_order_id')}
							>
								<div class="flex items-center gap-1">
									Order ID
									{#if sortColumn === 'amazon_order_id'}
										{#if sortDirection === 'asc'}<ArrowUp class="h-3 w-3" />{:else}<ArrowDown
												class="h-3 w-3"
											/>{/if}
									{:else}
										<ArrowUpDown class="h-3 w-3 opacity-50" />
									{/if}
								</div>
							</th>
							<th
								class="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground"
								onclick={() => toggleSort('purchase_date')}
							>
								<div class="flex items-center gap-1">
									Date
									{#if sortColumn === 'purchase_date'}
										{#if sortDirection === 'asc'}<ArrowUp class="h-3 w-3" />{:else}<ArrowDown
												class="h-3 w-3"
											/>{/if}
									{:else}
										<ArrowUpDown class="h-3 w-3 opacity-50" />
									{/if}
								</div>
							</th>
							<th
								class="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground"
								onclick={() => toggleSort('order_status')}
							>
								<div class="flex items-center gap-1">
									Status
									{#if sortColumn === 'order_status'}
										{#if sortDirection === 'asc'}<ArrowUp class="h-3 w-3" />{:else}<ArrowDown
												class="h-3 w-3"
											/>{/if}
									{:else}
										<ArrowUpDown class="h-3 w-3 opacity-50" />
									{/if}
								</div>
							</th>
							<th
								class="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground"
								onclick={() => toggleSort('order_total')}
							>
								<div class="flex items-center gap-1">
									Sale Price
									{#if sortColumn === 'order_total'}
										{#if sortDirection === 'asc'}<ArrowUp class="h-3 w-3" />{:else}<ArrowDown
												class="h-3 w-3"
											/>{/if}
									{:else}
										<ArrowUpDown class="h-3 w-3 opacity-50" />
									{/if}
								</div>
							</th>
							<th
								class="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground"
								onclick={() => toggleSort('total_cost')}
							>
								<div class="flex items-center gap-1">
									<div class="flex flex-col">
										<span>Total Cost</span>
										<span class="text-[10px] font-medium">(Inc. Shipping)</span>
									</div>
									{#if sortColumn === 'total_cost'}
										{#if sortDirection === 'asc'}<ArrowUp class="h-3 w-3" />{:else}<ArrowDown
												class="h-3 w-3"
											/>{/if}
									{:else}
										<ArrowUpDown class="h-3 w-3 opacity-50" />
									{/if}
								</div>
							</th>
							<th
								class="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground"
								onclick={() => toggleSort('shipping_cost')}
							>
								<div class="flex items-center gap-1">
									Shipping
									{#if sortColumn === 'shipping_cost'}
										{#if sortDirection === 'asc'}<ArrowUp class="h-3 w-3" />{:else}<ArrowDown
												class="h-3 w-3"
											/>{/if}
									{:else}
										<ArrowUpDown class="h-3 w-3 opacity-50" />
									{/if}
								</div>
							</th>
							<th
								class="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground"
								onclick={() => toggleSort('profit')}
							>
								<div class="flex items-center gap-1">
									Profit
									{#if sortColumn === 'profit'}
										{#if sortDirection === 'asc'}<ArrowUp class="h-3 w-3" />{:else}<ArrowDown
												class="h-3 w-3"
											/>{/if}
									{:else}
										<ArrowUpDown class="h-3 w-3 opacity-50" />
									{/if}
								</div>
							</th>
							<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
								>Items</th
							>
							<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
								>Units</th
							>
							<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
								>Products</th
							>
							<th
								class="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground"
								onclick={() => toggleSort('automated_carrier')}
							>
								<div class="flex items-center gap-1">
									Carrier
									{#if sortColumn === 'automated_carrier'}
										{#if sortDirection === 'asc'}<ArrowUp class="h-3 w-3" />{:else}<ArrowDown
												class="h-3 w-3"
											/>{/if}
									{:else}
										<ArrowUpDown class="h-3 w-3 opacity-50" />
									{/if}
								</div>
							</th>
							<th
								class="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground"
								onclick={() => toggleSort('automated_ship_method')}
							>
								<div class="flex items-center gap-1">
									Ship Method
									{#if sortColumn === 'automated_ship_method'}
										{#if sortDirection === 'asc'}<ArrowUp class="h-3 w-3" />{:else}<ArrowDown
												class="h-3 w-3"
											/>{/if}
									{:else}
										<ArrowUpDown class="h-3 w-3 opacity-50" />
									{/if}
								</div>
							</th>
							<th
								class="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground"
								onclick={() => toggleSort('order_type')}
							>
								<div class="flex items-center gap-1">
									Type
									{#if sortColumn === 'order_type'}
										{#if sortDirection === 'asc'}<ArrowUp class="h-3 w-3" />{:else}<ArrowDown
												class="h-3 w-3"
											/>{/if}
									{:else}
										<ArrowUpDown class="h-3 w-3 opacity-50" />
									{/if}
								</div>
							</th>
						</tr>
					</thead>
					<tbody class="[&_tr:last-child]:border-0">
						{#if isLoadingOrders}
							<tr>
								<td colspan="13" class="p-8 text-center">
									<div class="flex flex-col items-center justify-center gap-2">
										<RefreshCw class="h-8 w-8 animate-spin text-muted-foreground" />
										<p class="text-muted-foreground">Loading orders...</p>
									</div>
								</td>
							</tr>
						{:else}
							{#each sortedOrders as order}
								{@const totalCost = order._calculated.totalCost}
								{@const shippingDisplay = order._calculated.shippingDisplay}
								{@const profit = order._calculated.profit}
								{@const totalUnits =
									order.amazon_order_items?.reduce(
										(sum: number, item: any) =>
											sum + (Number(item.quantity_ordered) || 0) * (item.bundle_quantity || 1),
										0
									) || 0}
								{@const rowClass =
									totalCost > 0
										? profit < 0
											? 'bg-red-50/60 hover:bg-red-100/60'
											: profit > 0
												? 'bg-green-50/40 hover:bg-green-100/50'
												: 'hover:bg-muted/50'
										: 'hover:bg-muted/50'}
								<tr class="border-b transition-colors data-[state=selected]:bg-muted {rowClass}">
									<td class="p-4 align-middle font-medium">
										<a
											href={`https://sellercentral.amazon.co.uk/orders-v3/order/${order.amazon_order_id}`}
											target="_blank"
											rel="noopener noreferrer"
											class="text-blue-600 hover:underline"
										>
											{order.amazon_order_id}
										</a>
									</td>
									<td class="p-4 align-middle">{formatDate(order.purchase_date)}</td>
									<td class="p-4 align-middle">
										<div
											class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 {getStatusColor(
												order.order_status
											)}"
										>
											{order.order_status}
										</div>
									</td>
									<td class="p-4 align-middle">
										{formatCurrency(order.order_total, order.currency_code)}
									</td>
									<td class="p-4 align-middle">
										{#if totalCost > 0}
											<span class="font-medium"
												>{formatCurrency(totalCost, order.currency_code)}</span
											>
										{:else}
											<span class="text-muted-foreground">-</span>
										{/if}
									</td>
									<td class="p-4 align-middle">
										{#if shippingDisplay.amount > 0}
											<div class="flex flex-col">
												<span class="font-medium {shippingDisplay.class}">
													{formatCurrency(shippingDisplay.amount, order.currency_code)}
												</span>
												<span class="text-[10px] {shippingDisplay.class}">
													{shippingDisplay.type}
												</span>
											</div>
										{:else}
											<span class="text-muted-foreground">-</span>
										{/if}
									</td>
									<td class="p-4 align-middle">
										{#if totalCost > 0 && order.order_total}
											<span class="font-medium {profit > 0 ? 'text-green-600' : 'text-red-600'}">
												{profit > 0 ? '+' : ''}{formatCurrency(profit, order.currency_code)}
											</span>
										{:else}
											<span class="text-muted-foreground">-</span>
										{/if}
									</td>
									<td class="p-4 align-middle">
										{order.number_of_items_shipped} / {order.number_of_items_unshipped}
									</td>
									<td class="p-4 align-middle">
										{totalUnits}
									</td>
									<td class="p-4 align-middle">
										{#if order.amazon_order_items && order.amazon_order_items.length > 0}
											<div class="flex flex-col gap-2">
												{#each order.amazon_order_items as item}
													<div class="text-xs flex flex-col mb-2 last:mb-0">
														<div class="flex items-center gap-1 flex-wrap">
															{#if item.seller_sku}
																<a
																	href="/dashboard/amazon/orders/sku/{item.seller_sku
																		.replace(/\s+-\s+/g, '-')
																		.replace(/\s+/g, '-')}"
																	class="font-semibold text-blue-600 hover:underline"
																>
																	{item.seller_sku}
																</a>
															{:else}
																<span class="font-semibold">No SKU</span>
															{/if}
															<span class="text-muted-foreground bg-muted px-1 rounded"
																>ASIN: {item.asin}</span
															>
															<span class="font-bold">x{item.quantity_ordered}</span>
															{#if item.bundle_quantity > 1}
																<span class="text-xs text-muted-foreground ml-1">
																	({item.bundle_quantity * item.quantity_ordered} units)
																</span>
															{/if}
															{#if item.shipping_price_amount > 0}
																<span class="text-xs text-muted-foreground ml-1">
																	(+{formatCurrency(
																		item.shipping_price_amount,
																		item.shipping_price_currency
																	)} ship)
																</span>
															{/if}
															<button
																class="ml-2 inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-6 w-6"
																title="Update Cost Data"
																onclick={() =>
																	openUpdateCostModal(item.seller_sku, item.title, item.asin)}
															>
																<Pencil class="h-3 w-3" />
															</button>
															<button
																class="ml-1 inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-6 w-6"
																title="Debug Cost Calculation"
																onclick={() =>
																	openDebugModal(order.amazon_order_id, item.seller_sku)}
															>
																<Bug class="h-3 w-3" />
															</button>
														</div>
														<div
															class="truncate max-w-[250px] text-muted-foreground"
															title={item.title}
														>
															{item.title}
														</div>
													</div>
												{/each}
											</div>
										{:else}
											<div class="flex items-center gap-2">
												<span class="text-muted-foreground text-xs italic">No items synced</span>
												<Button
													variant="outline"
													size="sm"
													class="h-6 text-xs"
													onclick={() => syncSingleOrder(order.amazon_order_id)}
												>
													<RefreshCw class="mr-1 h-3 w-3" />
													Sync Items
												</Button>
											</div>
										{/if}
									</td>
									<td class="p-4 align-middle">{order.automated_carrier || '-'}</td>
									<td class="p-4 align-middle">
										{order.automated_ship_method || order.shipment_service_level_category || '-'}
									</td>
									<td class="p-4 align-middle">
										<div class="flex gap-1">
											{#if order.is_prime}
												<div
													class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-blue-200 text-blue-800 bg-blue-50"
												>
													Prime
												</div>
											{/if}
											{#if order.is_business_order}
												<div
													class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-purple-200 text-purple-800 bg-purple-50"
												>
													B2B
												</div>
											{/if}
											{#if order.is_premium_order}
												<div
													class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-amber-200 text-amber-800 bg-amber-50"
												>
													Premium
												</div>
											{/if}
										</div>
									</td>
								</tr>
							{/each}
							{#if orders.length === 0}
								<tr
									class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
								>
									<td colspan="13" class="p-4 align-middle text-center py-8 text-muted-foreground">
										No orders found. Click "Sync Yesterday's Orders" to fetch data.
									</td>
								</tr>
							{/if}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	</div>
</div>

<UpdateCostModal
	bind:open={showUpdateCostModal}
	sku={selectedSku}
	title={selectedTitle}
	asin={selectedAsin}
	on:success={() => {
		// Refresh the page to show updated costs
		window.location.reload();
	}}
/>

<DebugModal bind:open={showDebugModal} logs={debugLogs} title={debugTitle} />
