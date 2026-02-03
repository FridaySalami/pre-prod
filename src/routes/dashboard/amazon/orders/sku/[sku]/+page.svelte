<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button';
	import { Input } from '$lib/shadcn/ui/input';
	import {
		ArrowUpDown,
		ArrowUp,
		ArrowDown,
		Pencil,
		Bug,
		ArrowLeft,
		Download,
		RefreshCw,
		Search
	} from 'lucide-svelte';
	import { showToast } from '$lib/toastStore';
	import { goto } from '$app/navigation';
	import UpdateCostModal from '$lib/components/UpdateCostModal.svelte';
	import DebugModal from '$lib/components/DebugModal.svelte';
	import { onMount } from 'svelte';
	import Chart from 'chart.js/auto';
	import 'chartjs-adapter-date-fns';

	export let data;

	let searchSku = '';
	let suggestions: string[] = [];
	let showSuggestions = false;
	let searchTimeout: NodeJS.Timeout;

	function handleInput() {
		clearTimeout(searchTimeout);
		if (searchSku.length < 2) {
			suggestions = [];
			showSuggestions = false;
			return;
		}

		searchTimeout = setTimeout(async () => {
			try {
				const res = await fetch(`/api/amazon/sku-search?q=${encodeURIComponent(searchSku)}`);
				if (res.ok) {
					suggestions = await res.json();
					showSuggestions = suggestions.length > 0;
				}
			} catch (e) {
				console.error('Error fetching suggestions', e);
			}
		}, 300);
	}

	function selectSuggestion(sku: string) {
		searchSku = sku;
		showSuggestions = false;
		handleSkuSearch();
	}

	function handleBlur() {
		// Delay hiding to allow click event on suggestion to fire
		setTimeout(() => {
			showSuggestions = false;
		}, 200);
	}

	function handleSkuSearch() {
		showSuggestions = false; // ensure closed
		if (searchSku.trim()) {
			goto(`/dashboard/amazon/orders/sku/${encodeURIComponent(searchSku.trim())}`);
		}
	}

	let sortColumn = 'purchase_date';
	let sortDirection: 'asc' | 'desc' = 'desc';

	// Chart state
	let chartCanvas: HTMLCanvasElement;
	let chartInstance: Chart;
	let elasticityChartCanvas: HTMLCanvasElement;
	let elasticityChartInstance: Chart;

	// Enriched Data Structure
	interface EnrichedOrder {
		amazon_order_id: string;
		purchase_date: string;
		order_status: string;
		currency_code: string;

		// Order Level (Basket)
		orderRevenue: number;
		orderCost: number;
		orderProfit: number;
		orderShippingCost: number;

		// SKU Level (Line)
		skuRevenue: number;
		skuCost: number;
		skuProfit: number;
		skuUnits: number;
		skuPacks: number; // Number of packs sold (qty)

		// Expanded properties from original order
		[key: string]: any;
	}

	function localDateKey(dateInput: string | number | Date) {
		const d = new Date(dateInput);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	// Helper functions defined first so they can be used in enrichment
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

	function getOrderShippingClass(order: any) {
		const display = getShippingCostDisplay(order);
		return display.class;
	}

	function getShippingTypeLabel(order: any) {
		const display = getShippingCostDisplay(order);
		return display.type;
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

	function enrichOrders(orders: any[], targetSku: string): EnrichedOrder[] {
		return orders.map((order: any) => {
			// 1. Order Level Calculations
			const orderRevenue = parseFloat(order.order_total) || 0;
			const orderCost = calculateOrderCost(order);
			const orderProfit = orderRevenue - orderCost;

			const shippingDisplay = getShippingCostDisplay(order);
			const orderShippingCost = shippingDisplay.amount;

			// 2. SKU Level Calculations
			let skuRevenue = 0;
			let skuCost = 0;
			let skuUnits = 0;
			let skuPacks = 0;

			if (order.amazon_order_items) {
				order.amazon_order_items.forEach((item: any) => {
					if (item.seller_sku === targetSku) {
						// Revenue: item_price_amount is usually the line total
						skuRevenue += parseFloat(item.item_price_amount) || 0;

						const qty = Number(item.quantity_ordered) || 0;
						skuPacks += qty;

						const bundleQty = Number(item.bundle_quantity) || 1;
						const units = qty * bundleQty;

						skuUnits += units;

						if (item.costs) {
							const material = Number(item.costs.materialTotalCost) || 0;
							const shipping = Number(item.costs.shippingCost) || 0;
							const fee = Number(item.costs.amazonFee) || 0;
							const salesVat = Number(item.costs.salesVat) || 0;
							// Costs are per "Sold Item" (Pack), including fees/shipping.
							skuCost += (material + shipping + fee + salesVat) * qty;
						}
					}
				});
			}

			const skuProfit = skuRevenue - skuCost;

			return {
				...order, // Spread original properties for compatibility

				orderRevenue,
				orderCost,
				orderProfit,
				orderShippingCost,

				skuRevenue,
				skuCost,
				skuProfit,
				skuUnits,
				skuPacks
			} as EnrichedOrder;
		});
	}

	$: enrichedOrders = enrichOrders(
		(data.orders || []).filter((o) => o.order_status !== 'Pending'),
		data.sku
	);

	$: filteredOrders = enrichedOrders; // Keep for compatibility if needed, or replace usages

	function createElasticityChart() {
		if (!elasticityChartCanvas || !enrichedOrders || enrichedOrders.length < 5) return;

		if (elasticityChartInstance) {
			elasticityChartInstance.destroy();
		}

		const ctx = elasticityChartCanvas.getContext('2d');
		if (!ctx) return;

		// 1. Group orders by Date to get Daily metrics (using SKU Level data)
		const dailyMap = new Map<
			string,
			{ units: number; packs: number; revenue: number; profit: number }
		>();

		enrichedOrders.forEach((order) => {
			if (order.order_status === 'Canceled') return;
			// Use local date for bucket
			const dateKey = localDateKey(order.purchase_date);

			if (!dailyMap.has(dateKey))
				dailyMap.set(dateKey, { units: 0, packs: 0, revenue: 0, profit: 0 });
			const entry = dailyMap.get(dateKey)!;

			entry.units += order.skuUnits;
			// Fallback: if packs logic isn't populated for older data, assume packs = units / bundle size?
			// Enriched data guarantees skuPacks is at least units/bundle or raw qty.
			// If skuPacks is 0/undefined, fallback to skuUnits (assume single item)
			entry.packs += order.skuPacks || order.skuUnits;
			entry.revenue += order.skuRevenue;
			entry.profit += order.skuProfit;
		});

		// 2. Convert to scatter points: X=Avg Price (Per Pack), Y=Daily Packs Sold
		const points = Array.from(dailyMap.entries())
			.map(([date, metrics]) => {
				if (metrics.packs === 0) return null;
				// Avg Price per PACK (SKU Price), not per inner unit
				const avgPrice = metrics.revenue / metrics.packs;
				return {
					x: avgPrice,
					y: metrics.packs, // Daily Packs Sold
					date: date,
					profit: metrics.profit
				};
			})
			.filter((p) => p !== null);

		elasticityChartInstance = new Chart(ctx, {
			type: 'scatter',
			data: {
				datasets: [
					{
						label: 'Daily Sales Volume (Packs) vs Price',
						data: points,
						backgroundColor: function (context) {
							const val = context.raw as any;
							return val && val.profit > 0 ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)';
						},
						borderColor: function (context) {
							const val = context.raw as any;
							return val && val.profit > 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)';
						},
						borderWidth: 1,
						pointRadius: 5,
						pointHoverRadius: 7
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					x: {
						title: {
							display: true,
							text: 'SKU Sale Price (£)'
						},
						ticks: {
							callback: function (value) {
								return '£' + value;
							}
						}
					},
					y: {
						title: {
							display: true,
							text: 'Daily Packs Sold'
						},
						beginAtZero: true
					}
				},
				plugins: {
					tooltip: {
						callbacks: {
							label: function (context) {
								const raw = context.raw as any;
								return [
									`Date: ${raw.date}`,
									`SKU Price: £${raw.x.toFixed(2)}`,
									`Volume: ${raw.y} packs`,
									`Profit: £${raw.profit.toFixed(2)}`
								];
							}
						}
					},
					legend: {
						display: false
					}
				}
			}
		});
	}

	function createChart() {
		if (!chartCanvas || !enrichedOrders || enrichedOrders.length === 0) return;

		if (chartInstance) {
			chartInstance.destroy();
		}

		const ctx = chartCanvas.getContext('2d');
		if (!ctx) return;

		// Sort orders by date (oldest to newest) for the chart
		const chartData = [...enrichedOrders]
			.filter((order) => order.order_status !== 'Canceled')
			.sort((a, b) => new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime());

		// Prepare data using pre-calculated SKU metrics
		// Note: unitRevenue is now "Per Sold Pack" (Amazon Listing Price)
		const processedData = chartData
			.map((order) => {
				if (order.skuUnits === 0) return null;

				const packs = order.skuPacks || order.skuUnits; // Fallback to units if packs is 0 (shouldn't happen)
				const unitRevenue = order.skuRevenue / packs;

				return {
					x: new Date(order.purchase_date).getTime(),
					unitRevenue,
					skuCost: order.skuCost,
					skuProfit: order.skuProfit,
					skuRevenue: order.skuRevenue,
					qty: order.skuUnits,
					orderId: order.amazon_order_id
				};
			})
			.filter((d) => d !== null);

		chartInstance = new Chart(ctx, {
			type: 'line',
			data: {
				datasets: [
					{
						label: 'Amazon Listing Price',
						data: processedData.map((d) => ({
							x: d.x,
							y: d.unitRevenue,
							qty: d.qty,
							skuRevenue: d.skuRevenue
						})),
						borderColor: 'rgb(59, 130, 246)', // Blue
						backgroundColor: 'rgba(59, 130, 246, 0.1)',
						borderWidth: 2,
						pointRadius: 2,
						tension: 0.1
					},
					{
						label: 'Order Cost',
						data: processedData.map((d) => ({
							x: d.x,
							y: d.skuCost,
							qty: d.qty,
							skuRevenue: d.skuRevenue
						})),
						borderColor: 'rgba(249, 115, 22, 0.7)', // Faint Orange
						backgroundColor: 'rgba(249, 115, 22, 0.05)',
						borderWidth: 1.5,
						borderDash: [4, 4], // Dashed line
						pointRadius: 1,
						tension: 0.1
					},
					{
						label: 'Order Profit',
						data: processedData.map((d) => ({
							x: d.x,
							y: d.skuProfit,
							qty: d.qty,
							skuRevenue: d.skuRevenue
						})),
						borderColor: 'rgb(34, 197, 94)', // Green
						backgroundColor: 'rgba(34, 197, 94, 0.1)',
						borderWidth: 2,
						pointRadius: 2,
						tension: 0.1
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					x: {
						type: 'time',
						time: {
							unit: 'day',
							displayFormats: {
								day: 'MMM d'
							}
						},
						grid: {
							display: false
						}
					},
					y: {
						beginAtZero: true,
						ticks: {
							callback: function (value) {
								return '£' + value;
							}
						}
					}
				},
				interaction: {
					mode: 'index',
					intersect: false
				},
				plugins: {
					tooltip: {
						callbacks: {
							footer: (tooltipItems) => {
								if (tooltipItems.length > 0) {
									const raw = tooltipItems[0].raw as any;
									if (raw && raw.skuRevenue !== undefined) {
										return `Order Revenue: ${new Intl.NumberFormat('en-GB', {
											style: 'currency',
											currency: 'GBP'
										}).format(raw.skuRevenue)}`;
									}
								}
								return '';
							},
							label: function (context) {
								let label = context.dataset.label || '';
								if (label) {
									label += ': ';
								}
								if (context.parsed.y !== null) {
									label += new Intl.NumberFormat('en-GB', {
										style: 'currency',
										currency: 'GBP'
									}).format(context.parsed.y);
								}

								// Show quantity if > 1
								const raw = context.raw as any;
								if (raw && raw.qty > 1) {
									label += ` (Qty: ${raw.qty})`;
								}

								return label;
							},
							title: (tooltipItems) => {
								if (tooltipItems.length > 0) {
									const timestamp = tooltipItems[0].parsed.x;
									if (timestamp !== null) {
										return new Date(timestamp).toLocaleString();
									}
								}
								return '';
							}
						}
					}
				}
			}
		});
	}

	onMount(() => {
		createChart();
		createElasticityChart();
		return () => {
			if (chartInstance) {
				chartInstance.destroy();
			}
			if (elasticityChartInstance) {
				elasticityChartInstance.destroy();
			}
		};
	});

	$: chartKey =
		enrichedOrders.length > 0
			? `${data.sku}:${enrichedOrders.length}:${Math.round(
					enrichedOrders.reduce((a, o) => a + o.skuRevenue + o.skuCost, 0) * 100
				)}`
			: '';

	$: if (chartCanvas && chartKey) {
		queueMicrotask(() => createChart());
	}

	$: if (elasticityChartCanvas && chartKey) {
		queueMicrotask(() => createElasticityChart());
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

	async function syncLinnworksOrder(orderId: string) {
		try {
			showToast(`Syncing Linnworks data for ${orderId}...`, 'info');
			const res = await fetch('/api/linnworks/sync-order', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ orderId })
			});
			const data = await res.json();

			if (res.ok && data.success) {
				showToast(`Synced: ${data.data.service}`, 'success');
				setTimeout(() => window.location.reload(), 1000);
			} else {
				showToast(data.error || 'Failed to sync with Linnworks', 'error');
			}
		} catch (e) {
			showToast('Error syncing Linnworks data', 'error');
			console.error(e);
		}
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

	// SKU Stats Interface
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

	// SKU Stats (Related Items) - iterates items to find other SKUs
	$: skuStats = enrichedOrders.reduce((acc: Record<string, SkuStats>, order: any) => {
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
			const itemPrice = Number(item.item_price_amount) || 0;
			const revenue = itemPrice;
			acc[sku].totalRevenue += revenue;

			let itemCost = 0;
			if (item.costs) {
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

	let showProfitStats = false; // Kept for UI state if needed, but section removed

	const dateCols = new Set(['purchase_date']);
	const numericCols = new Set([
		'orderRevenue',
		'orderCost',
		'orderProfit',
		'orderShippingCost',
		'skuRevenue',
		'skuCost',
		'skuProfit',
		'skuUnits'
	]);

	$: sortedOrders = [...enrichedOrders].sort((a, b) => {
		let aValue: any = a[sortColumn as keyof EnrichedOrder] ?? a[sortColumn];
		let bValue: any = b[sortColumn as keyof EnrichedOrder] ?? b[sortColumn];

		if (dateCols.has(sortColumn)) {
			aValue = new Date(a.purchase_date).getTime();
			bValue = new Date(b.purchase_date).getTime();
		} else if (numericCols.has(sortColumn)) {
			aValue = Number(aValue) || 0;
			bValue = Number(bValue) || 0;
		} else {
			aValue = String(aValue ?? '').toLowerCase();
			bValue = String(bValue ?? '').toLowerCase();
		}

		if (aValue === bValue) return 0;
		const comparison = aValue > bValue ? 1 : -1;
		return sortDirection === 'asc' ? comparison : -comparison;
	});

	// Summary Cards Stats (SKU Specific Truth) as requested?
	// Or did the user want explicit separation?
	// "Total Sales" on this page usually refers to the SKU sales.
	// We will use the SKU metrics from EnrichedOrders.
	$: summaryStats = enrichedOrders.reduce(
		(acc, order) => {
			if (order.order_status === 'Canceled') return acc;
			acc.sales += order.skuRevenue;
			acc.costs += order.skuCost;
			acc.units += order.skuUnits;
			return acc;
		},
		{ sales: 0, costs: 0, units: 0 }
	);

	$: totalSales = summaryStats.sales;
	$: totalCosts = summaryStats.costs;
	$: totalProfit = summaryStats.sales - summaryStats.costs;
	$: totalUnitsSold = summaryStats.units;

	// Order Composition Analysis
	$: compositionStats = (() => {
		if (!filteredOrders.length) return null;

		let singleUnitOrders = 0;
		let multiUnitOrders = 0;
		let soloPurchaseMetric = 0; // Sold alone
		let basketBuilderMetric = 0; // Sold with other items
		let totalOrders = 0;

		filteredOrders.forEach((order) => {
			if (order.order_status === 'Canceled') return;
			totalOrders++;

			// Check SKU quantity within order
			let skuQty = 0;
			let otherSkus = false;

			if (order.amazon_order_items) {
				order.amazon_order_items.forEach((item: any) => {
					if (item.seller_sku === data.sku) {
						const qty = Number(item.quantity_ordered) || 0;
						const bundleQty = Number(item.bundle_quantity) || 1;
						skuQty += qty * bundleQty;
					} else {
						otherSkus = true;
					}
				});
			}

			if (skuQty > 1) {
				multiUnitOrders++;
			} else {
				singleUnitOrders++;
			}

			if (otherSkus) {
				basketBuilderMetric++;
			} else {
				soloPurchaseMetric++;
			}
		});

		if (totalOrders === 0) return null;

		return {
			multiRate: (multiUnitOrders / totalOrders) * 100,
			singleRate: (singleUnitOrders / totalOrders) * 100,
			basketBuilderRate: (basketBuilderMetric / totalOrders) * 100,
			soloRate: (soloPurchaseMetric / totalOrders) * 100,
			totalOrders
		};
	})();

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

	// Last 7 Days Analysis
	$: last7DaysDailyStats = (() => {
		const now = new Date();
		const days = [];
		// Generate last 7 days (excluding today, going back 1 further)
		for (let i = 1; i <= 7; i++) {
			const d = new Date(now);
			d.setDate(d.getDate() - i);
			// Reset time to start of day for easier comparison or just use date string
			d.setHours(0, 0, 0, 0);
			days.push(d);
		}

		// Map each day to its stats
		return days
			.map((dayStart) => {
				const dayEnd = new Date(dayStart);
				dayEnd.setHours(23, 59, 59, 999);

				// Filter orders for this specific day
				const daysOrders = filteredOrders.filter((o) => {
					if (o.order_status === 'Canceled') return false;
					const pDate = new Date(o.purchase_date);
					return pDate >= dayStart && pDate <= dayEnd;
				});

				const ordersCount = daysOrders.length;
				const unitsSold = daysOrders.reduce((sum, o) => sum + o.skuUnits, 0);
				const revenue = daysOrders.reduce((sum, o) => sum + o.skuRevenue, 0);
				const profit = daysOrders.reduce((sum, o) => sum + o.skuProfit, 0);

				return {
					date: dayStart,
					dayName: dayStart.toLocaleDateString('en-GB', { weekday: 'short' }), // Mon, Tue...
					dateStr: dayStart.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }), // 20/01
					ordersCount,
					unitsSold,
					revenue,
					profit
				};
			})
			.reverse(); // Reverse so it goes oldest -> newest (Left to Right)
	})();

	// Weekly Trend Analysis (Last 7 Days vs Previous 7 Days)
	$: weeklyTrends = (() => {
		const now = new Date();

		// Current Period: Last 7 Days (excluding today)
		// e.g. T-7 to T-1
		const currentEnd = new Date(now);
		currentEnd.setDate(currentEnd.getDate() - 1);
		currentEnd.setHours(23, 59, 59, 999);

		const currentStart = new Date(currentEnd);
		currentStart.setDate(currentStart.getDate() - 6);
		currentStart.setHours(0, 0, 0, 0);

		// Previous Period: The 7 days before that
		// e.g. T-14 to T-8
		const prevEnd = new Date(currentStart);
		prevEnd.setDate(prevEnd.getDate() - 1);
		prevEnd.setHours(23, 59, 59, 999);

		const prevStart = new Date(prevEnd);
		prevStart.setDate(prevStart.getDate() - 6);
		prevStart.setHours(0, 0, 0, 0);

		const getPeriodStats = (start: Date, end: Date) => {
			const orders = filteredOrders.filter((o) => {
				if (o.order_status === 'Canceled') return false;
				const pDate = new Date(o.purchase_date);
				return pDate >= start && pDate <= end;
			});

			return {
				orders: orders.length,
				units: orders.reduce((sum, o) => sum + o.skuUnits, 0),
				sales: orders.reduce((sum, o) => sum + o.skuRevenue, 0),
				profit: orders.reduce((sum, o) => sum + o.skuProfit, 0)
			};
		};

		const current = getPeriodStats(currentStart, currentEnd);
		const previous = getPeriodStats(prevStart, prevEnd);

		const calcTrend = (curr: number, prev: number) => {
			if (prev === 0) return curr > 0 ? 100 : 0;
			return ((curr - prev) / prev) * 100;
		};

		return {
			orders: {
				current: current.orders,
				prev: previous.orders,
				trend: calcTrend(current.orders, previous.orders)
			},
			units: {
				current: current.units,
				prev: previous.units,
				trend: calcTrend(current.units, previous.units)
			},
			sales: {
				current: current.sales,
				prev: previous.sales,
				trend: calcTrend(current.sales, previous.sales)
			},
			profit: {
				current: current.profit,
				prev: previous.profit,
				trend: calcTrend(current.profit, previous.profit)
			}
		};
	})();

	// Velocity Analysis
	$: velocityStats = (() => {
		if (!filteredOrders.length) return null;

		const sorted = [...filteredOrders]
			.filter((o) => o.order_status !== 'Canceled')
			.sort((a, b) => new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime());

		if (sorted.length < 2) return null;

		// Average TBO
		let totalDiffMs = 0;
		for (let i = 1; i < sorted.length; i++) {
			totalDiffMs +=
				new Date(sorted[i].purchase_date).getTime() -
				new Date(sorted[i - 1].purchase_date).getTime();
		}
		const avgTboMs = totalDiffMs / (sorted.length - 1);
		const avgTboHours = avgTboMs / (1000 * 60 * 60);

		// Alive Check
		const lastOrder = sorted[sorted.length - 1];
		const lastOrderDate = new Date(lastOrder.purchase_date).getTime();
		const now = Date.now();
		const hoursSinceLastSale = (now - lastOrderDate) / (1000 * 60 * 60);

		// Heatmap (Day of Week vs Hour)
		// each cell = { count, revenue, avgPrice }
		const heatmap = Array(7)
			.fill(0)
			.map(() =>
				Array(24)
					.fill(0)
					.map(() => ({ count: 0, revenue: 0, units: 0 }))
			);

		sorted.forEach((order) => {
			const d = new Date(order.purchase_date);
			const day = d.getDay(); // 0 = Sunday
			const hour = d.getHours();

			const cell = heatmap[day][hour];
			cell.count += 1;
			cell.revenue += order.skuRevenue;
			cell.units += order.skuUnits;
		});

		// Calculate max for opacity scaling
		const maxCount = Math.max(...heatmap.flat().map((c) => c.count)) || 1;

		return {
			avgTboHours,
			hoursSinceLastSale,
			heatmap,
			lastOrderDate,
			maxCount
		};
	})();

	// Stability & Volatility Analysis (Risk)
	$: stabilityStats = (() => {
		if (!filteredOrders.length) return null;

		const validOrders = filteredOrders
			.filter((o) => o.order_status !== 'Canceled')
			.sort((a, b) => new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime());

		if (validOrders.length < 2) return null;

		const firstDate = new Date(validOrders[0].purchase_date);
		const lastDate = new Date(validOrders[validOrders.length - 1].purchase_date);

		// 1. Daily Sales Volatility
		const dailySales: Record<string, number> = {};
		const dayMs = 24 * 60 * 60 * 1000;
		const totalDays = Math.ceil((lastDate.getTime() - firstDate.getTime()) / dayMs) + 1;

		for (let i = 0; i < totalDays; i++) {
			const d = new Date(firstDate.getTime() + i * dayMs);
			const dateKey = localDateKey(d);
			dailySales[dateKey] = 0;
		}

		validOrders.forEach((order) => {
			const dateKey = localDateKey(order.purchase_date);
			let units = 0;
			if (order.amazon_order_items) {
				order.amazon_order_items.forEach((item: any) => {
					if (item.seller_sku === data.sku) {
						units += (Number(item.quantity_ordered) || 0) * (Number(item.bundle_quantity) || 1);
					}
				});
			}
			if (dailySales[dateKey] !== undefined) {
				dailySales[dateKey] += units;
			}
		});

		const values = Object.values(dailySales);
		if (values.length === 0) return null;

		const sum = values.reduce((a, b) => a + b, 0);
		const mean = sum / values.length;

		const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
		const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
		const stdDev = Math.sqrt(avgSquaredDiff);
		const cv = mean > 0 ? stdDev / mean : 0;

		// 2. Returns & Cancellations
		let cancelCount = 0;
		let returnCount = 0;

		filteredOrders.forEach((order) => {
			if (order.order_status === 'Canceled') {
				cancelCount++;
			}
			const method = order.automated_ship_method || order.shipment_service_level_category || '';
			if (method === 'SWA-UK-RTO' || method === 'Amazon Return to Origin') {
				returnCount++;
			}
		});

		const totalExamined = filteredOrders.length;
		const defectRate = totalExamined > 0 ? ((cancelCount + returnCount) / totalExamined) * 100 : 0;

		return {
			stdDev,
			mean,
			cv,
			cancelCount,
			returnCount,
			defectRate,
			totalDays
		};
	})();

	$: priceAnalysis = (() => {
		if (!enrichedOrders || enrichedOrders.length < 5) return null;

		// 1. Group daily stats first
		const dailyMap = new Map<
			string,
			{ units: number; packs: number; revenue: number; profit: number }
		>();
		enrichedOrders.forEach((order) => {
			if (order.order_status === 'Canceled' || order.skuUnits <= 0) return;
			// Use Local Date for bucket
			const dateKey = localDateKey(order.purchase_date);

			if (!dailyMap.has(dateKey))
				dailyMap.set(dateKey, { units: 0, packs: 0, revenue: 0, profit: 0 });
			const entry = dailyMap.get(dateKey)!;
			entry.units += order.skuUnits;
			entry.packs += order.skuPacks || order.skuUnits;
			entry.revenue += order.skuRevenue;
			entry.profit += order.skuProfit;
		});

		// 2. Group by Price Bin
		// We'll group by rounding to nearest £0.10 to cluster similar prices
		const priceBins = new Map<
			string,
			{
				count: number;
				totalPacks: number;
				totalProfit: number;
				totalRevenue: number;
				actualPriceSum: number;
			}
		>();

		dailyMap.forEach((metrics) => {
			if (metrics.packs === 0) return;
			const avgPrice = metrics.revenue / metrics.packs;
			// Bin Key: Round to nearest 0.1
			const binKey = (Math.round(avgPrice * 10) / 10).toFixed(2);

			if (!priceBins.has(binKey)) {
				priceBins.set(binKey, {
					count: 0,
					totalPacks: 0,
					totalProfit: 0,
					totalRevenue: 0,
					actualPriceSum: 0
				});
			}
			const bin = priceBins.get(binKey)!;
			bin.count++;
			bin.totalPacks += metrics.packs;
			bin.totalProfit += metrics.profit;
			bin.totalRevenue += metrics.revenue;
			bin.actualPriceSum += avgPrice;
		});

		const results = Array.from(priceBins.entries())
			.map(([key, bin]) => {
				const avgPrice = bin.actualPriceSum / bin.count;
				const dailyVolume = bin.totalPacks / bin.count;
				const dailyProfit = bin.totalProfit / bin.count;
				const dailyRevenue = bin.totalRevenue / bin.count;

				return {
					priceLabel: `£${parseFloat(key).toFixed(2)}`,
					displayPrice: avgPrice,
					dailyVolume,
					dailyProfit,
					dailyRevenue,
					days: bin.count
				};
			})
			.sort((a, b) => a.displayPrice - b.displayPrice);

		if (results.length === 0) return null;

		// Find Optimal Points
		const maxProfit = results.reduce((prev, current) =>
			prev.dailyProfit > current.dailyProfit ? prev : current
		);
		const maxRevenue = results.reduce((prev, current) =>
			prev.dailyRevenue > current.dailyRevenue ? prev : current
		);
		const maxVolume = results.reduce((prev, current) =>
			prev.dailyVolume > current.dailyVolume ? prev : current
		);

		return {
			points: results,
			maxProfit,
			maxRevenue,
			maxVolume
		};
	})();

	function toggleSort(column: string) {
		if (sortColumn === column) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			// Default to descending for money columns, ascending for text
			if (
				[
					'orderRevenue',
					'orderCost',
					'orderProfit',
					'orderShippingCost',
					'skuRevenue',
					'skuCost',
					'skuProfit',
					'skuUnits'
				].includes(column)
			) {
				sortDirection = 'desc';
			} else {
				sortDirection = 'asc';
			}
		}
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
		const safeCurrency = currency || 'GBP';
		try {
			return new Intl.NumberFormat('en-GB', { style: 'currency', currency: safeCurrency }).format(
				amount
			);
		} catch (e) {
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

	function testLinnworksSync() {
		const orderId = prompt('Enter Amazon Order ID to sync with Linnworks:', '026-1322675-7177918');
		if (orderId) {
			syncLinnworksOrder(orderId);
		}
	}

	function downloadCSV() {
		const headers = [
			'Order ID',
			'Purchase Date',
			'Status',
			'SKU Revenue',
			'SKU Cost',
			'SKU Profit',
			'SKU Units',
			'Order Revenue',
			'Order Cost',
			'Order Profit',
			'Shipping Cost',
			'Currency'
		];

		const csvCell = (v: any) => {
			const s = String(v ?? '');
			return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
		};

		const rows = sortedOrders.map((order) => {
			return [
				order.amazon_order_id,
				order.purchase_date,
				order.order_status,
				(order.skuRevenue || 0).toFixed(2),
				(order.skuCost || 0).toFixed(2),
				(order.skuProfit || 0).toFixed(2),
				order.skuUnits,
				(order.orderRevenue || 0).toFixed(2),
				(order.orderCost || 0).toFixed(2),
				(order.orderProfit || 0).toFixed(2),
				(order.orderShippingCost || 0).toFixed(2),
				order.currency_code
			]
				.map(csvCell)
				.join(',');
		});

		const csvContent = [headers.join(','), ...rows].join('\n');
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		const url = URL.createObjectURL(blob);
		link.setAttribute('href', url);
		link.setAttribute('download', `amazon_orders_sku_${data.sku}.csv`);
		link.style.visibility = 'hidden';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}
</script>

<div class="flex flex-col gap-6 p-6">
	<!-- Back Button -->
	<div>
		<Button variant="outline" onclick={() => goto('/dashboard/amazon/orders')}>
			<ArrowLeft class="mr-2 h-4 w-4" />
			Back to Orders
		</Button>
	</div>

	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Orders for SKU: {data.sku}</h1>
			<p class="text-muted-foreground">
				View order history and profitability for this specific SKU
			</p>
		</div>
		<div class="flex items-center gap-2">
			<div class="flex w-full max-w-sm items-center space-x-2 mr-2 relative">
				<div class="relative w-full">
					<Input
						type="text"
						placeholder="Search another SKU..."
						bind:value={searchSku}
						oninput={handleInput}
						onblur={handleBlur}
						onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && handleSkuSearch()}
						autocomplete="off"
					/>
					{#if showSuggestions && suggestions.length > 0}
						<div
							class="absolute top-full left-0 z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
						>
							<div class="py-1">
								{#each suggestions as suggestion}
									<button
										class="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 text-left"
										onclick={() => selectSuggestion(suggestion)}
									>
										{suggestion}
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>
				<Button type="submit" size="icon" variant="ghost" onclick={handleSkuSearch}>
					<Search class="h-4 w-4" />
				</Button>
			</div>
			<Button variant="outline" onclick={testLinnworksSync}>
				<RefreshCw class="mr-2 h-4 w-4" />
				Test Linnworks
			</Button>
			<Button variant="outline" onclick={downloadCSV}>
				<Download class="mr-2 h-4 w-4" />
				Export CSV
			</Button>
		</div>
	</div>

	{#if data.error}
		<div class="bg-red-50 border-l-4 border-red-400 p-4">
			<div class="flex">
				<div class="ml-3">
					<p class="text-sm text-red-700">
						<span class="font-medium">Error</span>: {data.error}
					</p>
				</div>
			</div>
		</div>
	{/if}

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

	<!-- Week on Week Breakdown -->
	{#if weeklyTrends}
		<div class="space-y-2">
			<h3 class="font-semibold leading-none tracking-tight">
				Week on Week Performance (Last 7 Days vs Previous)
			</h3>
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
				<!-- Orders Trend -->
				<div class="rounded-xl border bg-card text-card-foreground shadow p-4 space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-muted-foreground">Orders</span>
						{#if weeklyTrends.orders.trend > 0}
							<div
								class="flex items-center text-green-600 bg-green-100 px-2 py-0.5 rounded-full text-xs font-bold"
							>
								<ArrowUp class="w-3 h-3 mr-1" />
								{weeklyTrends.orders.trend.toFixed(1)}%
							</div>
						{:else if weeklyTrends.orders.trend < 0}
							<div
								class="flex items-center text-red-600 bg-red-100 px-2 py-0.5 rounded-full text-xs font-bold"
							>
								<ArrowDown class="w-3 h-3 mr-1" />
								{Math.abs(weeklyTrends.orders.trend).toFixed(1)}%
							</div>
						{:else}
							<div
								class="flex items-center text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full text-xs font-bold"
							>
								-
							</div>
						{/if}
					</div>
					<div class="flex items-end justify-between">
						<div class="text-2xl font-bold">{weeklyTrends.orders.current}</div>
						<div class="text-xs text-muted-foreground pb-1">
							prev: {weeklyTrends.orders.prev}
						</div>
					</div>
				</div>

				<!-- Units Trend -->
				<div class="rounded-xl border bg-card text-card-foreground shadow p-4 space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-muted-foreground">Units</span>
						{#if weeklyTrends.units.trend > 0}
							<div
								class="flex items-center text-green-600 bg-green-100 px-2 py-0.5 rounded-full text-xs font-bold"
							>
								<ArrowUp class="w-3 h-3 mr-1" />
								{weeklyTrends.units.trend.toFixed(1)}%
							</div>
						{:else if weeklyTrends.units.trend < 0}
							<div
								class="flex items-center text-red-600 bg-red-100 px-2 py-0.5 rounded-full text-xs font-bold"
							>
								<ArrowDown class="w-3 h-3 mr-1" />
								{Math.abs(weeklyTrends.units.trend).toFixed(1)}%
							</div>
						{:else}
							<div
								class="flex items-center text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full text-xs font-bold"
							>
								-
							</div>
						{/if}
					</div>
					<div class="flex items-end justify-between">
						<div class="text-2xl font-bold">{weeklyTrends.units.current}</div>
						<div class="text-xs text-muted-foreground pb-1">
							prev: {weeklyTrends.units.prev}
						</div>
					</div>
				</div>

				<!-- Sales Trend -->
				<div class="rounded-xl border bg-card text-card-foreground shadow p-4 space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-muted-foreground">Sales</span>
						{#if weeklyTrends.sales.trend > 0}
							<div
								class="flex items-center text-green-600 bg-green-100 px-2 py-0.5 rounded-full text-xs font-bold"
							>
								<ArrowUp class="w-3 h-3 mr-1" />
								{weeklyTrends.sales.trend.toFixed(1)}%
							</div>
						{:else if weeklyTrends.sales.trend < 0}
							<div
								class="flex items-center text-red-600 bg-red-100 px-2 py-0.5 rounded-full text-xs font-bold"
							>
								<ArrowDown class="w-3 h-3 mr-1" />
								{Math.abs(weeklyTrends.sales.trend).toFixed(1)}%
							</div>
						{:else}
							<div
								class="flex items-center text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full text-xs font-bold"
							>
								-
							</div>
						{/if}
					</div>
					<div class="flex items-end justify-between">
						<div class="text-2xl font-bold">{formatCurrency(weeklyTrends.sales.current)}</div>
						<div class="text-xs text-muted-foreground pb-1">
							prev: {formatCurrency(weeklyTrends.sales.prev)}
						</div>
					</div>
				</div>

				<!-- Profit Trend -->
				<div class="rounded-xl border bg-card text-card-foreground shadow p-4 space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-muted-foreground">Profit</span>
						{#if weeklyTrends.profit.trend > 0}
							<div
								class="flex items-center text-green-600 bg-green-100 px-2 py-0.5 rounded-full text-xs font-bold"
							>
								<ArrowUp class="w-3 h-3 mr-1" />
								{weeklyTrends.profit.trend.toFixed(1)}%
							</div>
						{:else if weeklyTrends.profit.trend < 0}
							<div
								class="flex items-center text-red-600 bg-red-100 px-2 py-0.5 rounded-full text-xs font-bold"
							>
								<ArrowDown class="w-3 h-3 mr-1" />
								{Math.abs(weeklyTrends.profit.trend).toFixed(1)}%
							</div>
						{:else}
							<div
								class="flex items-center text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full text-xs font-bold"
							>
								-
							</div>
						{/if}
					</div>
					<div class="flex items-end justify-between">
						<div
							class="text-2xl font-bold {weeklyTrends.profit.current > 0
								? 'text-green-600'
								: 'text-red-600'}"
						>
							{formatCurrency(weeklyTrends.profit.current)}
						</div>
						<div class="text-xs text-muted-foreground pb-1">
							prev: {formatCurrency(weeklyTrends.profit.prev)}
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Last 7 Days Daily Breakdown -->
	{#if last7DaysDailyStats && last7DaysDailyStats.length > 0}
		<div class="space-y-2">
			<h3 class="font-semibold leading-none tracking-tight">Last 7 Days Performance</h3>
			<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
				{#each last7DaysDailyStats as dayStat}
					<div
						class="rounded-xl border bg-card text-card-foreground shadow p-4 flex flex-col justify-between space-y-2"
					>
						<div class="flex justify-between items-center border-b pb-2">
							<span class="font-bold text-sm">{dayStat.dayName}</span>
							<span class="text-xs text-muted-foreground">{dayStat.dateStr}</span>
						</div>

						<div class="space-y-1">
							<div class="flex justify-between text-xs">
								<span class="text-muted-foreground">Orders:</span>
								<span class="font-medium">{dayStat.ordersCount}</span>
							</div>
							<div class="flex justify-between text-xs">
								<span class="text-muted-foreground">Units:</span>
								<span class="font-medium">{dayStat.unitsSold}</span>
							</div>
							<div class="flex justify-between text-xs">
								<span class="text-muted-foreground">Sales:</span>
								<span class="font-medium">{formatCurrency(dayStat.revenue)}</span>
							</div>
							<div class="flex justify-between text-xs pt-1 border-t mt-1">
								<span class="text-muted-foreground">Profit:</span>
								<span
									class="font-bold {dayStat.profit > 0
										? 'text-green-600'
										: dayStat.profit < 0
											? 'text-red-600'
											: ''}"
								>
									{formatCurrency(dayStat.profit)}
								</span>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Order Performance Chart -->
	<div class="rounded-xl border bg-card text-card-foreground shadow">
		<div class="p-6 pb-2">
			<h3 class="font-semibold leading-none tracking-tight">Order Performance (Per Unit)</h3>
			<p class="text-sm text-muted-foreground">
				Tracking Unit Price, Unit Cost, and Unit Profit over time.
			</p>
		</div>
		<div class="p-6 pt-0">
			<div class="relative w-full h-[350px]">
				<canvas bind:this={chartCanvas}></canvas>
			</div>
		</div>
	</div>

	<!-- Velocity & Timing Analysis -->
	{#if velocityStats}
		<div class="rounded-xl border bg-card text-card-foreground shadow overflow-hidden">
			<div class="px-6 py-4 bg-muted/30 border-b">
				<h3 class="font-semibold text-foreground">Velocity & Timing Analysis</h3>
			</div>
			<div class="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
				<!-- Metrics -->
				<div class="space-y-4">
					<div class="p-4 bg-card rounded-lg border shadow-sm">
						<p class="text-sm font-medium text-muted-foreground mb-1">Avg Time Between Orders</p>
						<p class="text-2xl font-bold">
							{velocityStats.avgTboHours < 1
								? `${Math.round(velocityStats.avgTboHours * 60)} mins`
								: `${velocityStats.avgTboHours.toFixed(1)} hours`}
						</p>
						<p class="text-xs text-muted-foreground mt-1">Lower is better (higher velocity)</p>
					</div>

					<div class="p-4 bg-card rounded-lg border shadow-sm">
						<p class="text-sm font-medium text-muted-foreground mb-1">Time Since Last Order</p>
						<p class="text-2xl font-bold">
							{velocityStats.hoursSinceLastSale < 1
								? `${Math.round(velocityStats.hoursSinceLastSale * 60)} mins`
								: `${velocityStats.hoursSinceLastSale.toFixed(1)} hours`}
						</p>
						<p class="text-xs text-muted-foreground mt-1">
							Last: {new Date(velocityStats.lastOrderDate).toLocaleDateString()}
						</p>
					</div>
				</div>

				<!-- Heatmap -->
				<div class="col-span-2 border rounded-lg p-4">
					<div class="flex items-center justify-between mb-4">
						<h4 class="text-sm font-medium">Sales Heatmap (Day vs Hour)</h4>
						<div class="flex items-center gap-2 text-xs text-muted-foreground">
							<span class="inline-block w-3 h-3 bg-blue-100 rounded-sm"></span> Low
							<span class="inline-block w-3 h-3 bg-blue-500 rounded-sm"></span> High
						</div>
					</div>

					<div class="grid grid-cols-[auto_1fr] gap-2">
						<!-- Y-Axis Labels (Days) -->
						<div class="grid grid-rows-7 text-xs font-medium text-muted-foreground mr-1 gap-1">
							{#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
								<div class="flex items-center h-6">{day}</div>
							{/each}
						</div>

						<!-- Heatmap Grid -->
						<div class="grid grid-rows-7 gap-1">
							{#each velocityStats.heatmap as hours, dayIndex}
								<div
									class="grid gap-1 h-6"
									style="grid-template-columns: repeat(24, minmax(0, 1fr))"
								>
									{#each hours as cell, hourIndex}
										<div
											class="rounded-sm transition-all hover:ring-2 hover:ring-blue-400 cursor-help"
											style="background-color: rgba(59, 130, 246, {cell.count === 0
												? 0.05
												: Math.max(0.2, Math.min(1, cell.count / velocityStats.maxCount))});"
											title="{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
												dayIndex
											]} {hourIndex}:00 - {hourIndex + 1}:00
Orders: {cell.count}
Units: {cell.units}
Revenue: {formatCurrency(cell.revenue)}
Avg Price: {formatCurrency(cell.units ? cell.revenue / cell.units : 0)}"
										></div>
									{/each}
								</div>
							{/each}
						</div>

						<!-- X-Axis Labels (Hours) -->
						<div></div>
						<!-- Spacer for Y-axis -->
						<div
							class="grid mt-1 text-[10px] text-muted-foreground"
							style="grid-template-columns: repeat(24, minmax(0, 1fr))"
						>
							{#each Array(24) as _, i}
								<div class="text-center">{i % 6 === 0 ? i : ''}</div>
							{/each}
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Related SKUs (if any orders contain multiple items) -->
	{#if skuList.length > 1}
		<div class="grid gap-4 md:grid-cols-2">
			<!-- Top Selling SKUs in these orders -->
			<div class="rounded-xl border bg-card text-card-foreground shadow col-span-1">
				<div class="p-6 pb-2">
					<h3 class="font-semibold leading-none tracking-tight">Related SKUs in Orders</h3>
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
										class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted {sku.sku ===
										data.sku
											? 'bg-blue-50/50'
											: ''}"
									>
										<td class="p-4 align-middle font-medium">
											<div class="flex flex-col">
												<span>{sku.sku}</span>
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
		</div>
	{/if}

	<!-- Price Elasticity Analysis -->
	{#if filteredOrders.length >= 5}
		<div class="rounded-xl border bg-card text-card-foreground shadow">
			<div class="p-6 pb-2">
				<h3 class="font-semibold leading-none tracking-tight">Price Elasticity Analysis</h3>
				<p class="text-sm text-muted-foreground">
					Daily Sales Volume vs Unit Price. (Green = Profitable Day, Red = Loss Making Day)
				</p>
			</div>
			<div class="p-6 pt-0">
				<div class="relative w-full h-[400px]">
					<canvas bind:this={elasticityChartCanvas}></canvas>
				</div>

				{#if priceAnalysis}
					<div class="mt-6 border-t pt-4">
						<h4 class="text-sm font-semibold mb-3">Optimal Price Analysis</h4>
						<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
							<div class="p-3 bg-green-50 rounded border border-green-100">
								<span class="text-xs text-muted-foreground uppercase tracking-wider block"
									>Best Daily Profit</span
								>
								<span class="text-lg font-bold text-green-700"
									>{priceAnalysis.maxProfit.priceLabel}</span
								>
								<span class="text-xs text-muted-foreground block">
									{formatCurrency(priceAnalysis.maxProfit.dailyProfit)} profit / day
								</span>
							</div>
							<div class="p-3 bg-blue-50 rounded border border-blue-100">
								<span class="text-xs text-muted-foreground uppercase tracking-wider block"
									>Best Daily Revenue</span
								>
								<span class="text-lg font-bold text-blue-700"
									>{priceAnalysis.maxRevenue.priceLabel}</span
								>
								<span class="text-xs text-muted-foreground block">
									{formatCurrency(priceAnalysis.maxRevenue.dailyRevenue)} revenue / day
								</span>
							</div>
							<div class="p-3 bg-purple-50 rounded border border-purple-100">
								<span class="text-xs text-muted-foreground uppercase tracking-wider block"
									>Max Volume</span
								>
								<span class="text-lg font-bold text-purple-700"
									>{priceAnalysis.maxVolume.priceLabel}</span
								>
								<span class="text-xs text-muted-foreground block">
									{priceAnalysis.maxVolume.dailyVolume.toFixed(1)} units / day
								</span>
							</div>
						</div>

						<div class="relative w-full overflow-auto border rounded-md">
							<table class="w-full caption-bottom text-xs">
								<thead class="bg-muted/50">
									<tr class="border-b">
										<th class="h-8 px-4 text-left font-medium text-muted-foreground">Price Point</th
										>
										<th class="h-8 px-4 text-right font-medium text-muted-foreground">Days</th>
										<th class="h-8 px-4 text-right font-medium text-muted-foreground"
											>Avg Vol/Day</th
										>
										<th class="h-8 px-4 text-right font-medium text-muted-foreground"
											>Avg Rev/Day</th
										>
										<th class="h-8 px-4 text-right font-medium text-muted-foreground"
											>Avg Profit/Day</th
										>
									</tr>
								</thead>
								<tbody>
									{#each priceAnalysis.points as point}
										<tr class="border-b transition-colors hover:bg-muted/50">
											<td class="p-2 px-4 font-medium">{point.priceLabel}</td>
											<td class="p-2 px-4 text-right">{point.days}</td>
											<td class="p-2 px-4 text-right">{point.dailyVolume.toFixed(1)}</td>
											<td class="p-2 px-4 text-right">{formatCurrency(point.dailyRevenue)}</td>
											<td
												class="p-2 px-4 text-right font-semibold {point.dailyProfit > 0
													? 'text-green-600'
													: 'text-red-600'}"
											>
												{formatCurrency(point.dailyProfit)}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Order Composition Analysis -->
	{#if compositionStats}
		<div class="rounded-xl border bg-card text-card-foreground shadow overflow-hidden">
			<div class="px-6 py-4 bg-muted/30 border-b">
				<h3 class="font-semibold text-foreground">Order Composition Analysis</h3>
			</div>
			<div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
				<!-- Multi-Quantity Rate -->
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<div>
							<h4 class="font-medium text-sm">Multi-Unit Orders</h4>
							<p class="text-xs text-muted-foreground">
								Percentage of orders with 2+ units of this SKU
							</p>
						</div>
						<div
							class="text-2xl font-bold {compositionStats.multiRate > 20
								? 'text-green-600'
								: 'text-foreground'}"
						>
							{compositionStats.multiRate.toFixed(1)}%
						</div>
					</div>

					<!-- Progress Bar -->
					<div class="h-4 w-full bg-secondary rounded-full overflow-hidden flex">
						<div
							class="h-full bg-blue-500"
							style="width: {compositionStats.singleRate}%"
							title="Single Unit Orders: {compositionStats.singleRate.toFixed(1)}%"
						></div>
						<div
							class="h-full bg-orange-500"
							style="width: {compositionStats.multiRate}%"
							title="Multi Unit Orders: {compositionStats.multiRate.toFixed(1)}%"
						></div>
					</div>
					<div class="flex justify-between text-xs text-muted-foreground">
						<div class="flex items-center gap-2">
							<span class="w-2 h-2 rounded-full bg-blue-500"></span>
							Single Unit ({compositionStats.singleRate.toFixed(0)}%)
						</div>
						<div class="flex items-center gap-2">
							<span class="w-2 h-2 rounded-full bg-orange-500"></span>
							Multi Unit ({compositionStats.multiRate.toFixed(0)}%)
						</div>
					</div>

					{#if compositionStats.multiRate > 25}
						<div
							class="mt-2 text-xs bg-orange-50 text-orange-800 p-2 rounded border border-orange-100 flex gap-2 items-start"
						>
							<div class="mt-0.5">💡</div>
							<div>
								<strong>High Multi-Unit Rate:</strong> Consider creating a "Pack of 2" variation to save
								on FBA fees and shipping.
							</div>
						</div>
					{/if}
				</div>

				<!-- Basket Value Contribution -->
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<div>
							<h4 class="font-medium text-sm">Basket Builder Rate</h4>
							<p class="text-xs text-muted-foreground">
								Percentage of orders containing OTHER items
							</p>
						</div>
						<div
							class="text-2xl font-bold {compositionStats.basketBuilderRate > 50
								? 'text-green-600'
								: 'text-foreground'}"
						>
							{compositionStats.basketBuilderRate.toFixed(1)}%
						</div>
					</div>

					<!-- Progress Bar -->
					<div class="h-4 w-full bg-secondary rounded-full overflow-hidden flex">
						<div
							class="h-full bg-indigo-500"
							style="width: {compositionStats.soloRate}%"
							title="Solo Orders: {compositionStats.soloRate.toFixed(1)}%"
						></div>
						<div
							class="h-full bg-purple-500"
							style="width: {compositionStats.basketBuilderRate}%"
							title="Mixed Basket: {compositionStats.basketBuilderRate.toFixed(1)}%"
						></div>
					</div>
					<div class="flex justify-between text-xs text-muted-foreground">
						<div class="flex items-center gap-2">
							<span class="w-2 h-2 rounded-full bg-indigo-500"></span>
							Solo Purchase ({compositionStats.soloRate.toFixed(0)}%)
						</div>
						<div class="flex items-center gap-2">
							<span class="w-2 h-2 rounded-full bg-purple-500"></span>
							With Other Items ({compositionStats.basketBuilderRate.toFixed(0)}%)
						</div>
					</div>

					{#if compositionStats.basketBuilderRate > 40}
						<div
							class="mt-2 text-xs bg-purple-50 text-purple-800 p-2 rounded border border-purple-100 flex gap-2 items-start"
						>
							<div class="mt-0.5">🛒</div>
							<div>
								<strong>Basket Builder:</strong> This item is frequently bought with others. It can drive
								cart value even at lower margins.
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Stability & Volatility Analysis (Risk) -->
	{#if stabilityStats}
		<div class="rounded-xl border bg-card text-card-foreground shadow overflow-hidden">
			<div class="px-6 py-4 bg-muted/30 border-b">
				<h3 class="font-semibold text-foreground">Risk Analysis</h3>
			</div>
			<div class="p-6">
				<!-- Defect Rate Impact -->
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<div>
							<h4 class="font-medium text-sm">Defect Rate</h4>
							<p class="text-xs text-muted-foreground">Cancellations & Returns (RTO)</p>
						</div>
						<div
							class="text-2xl font-bold {stabilityStats.defectRate < 5
								? 'text-green-600'
								: stabilityStats.defectRate < 10
									? 'text-yellow-600'
									: 'text-red-600'}"
						>
							{stabilityStats.defectRate.toFixed(1)}%
						</div>
					</div>

					<div class="flex gap-2">
						<div class="flex-1 bg-red-50 p-2 rounded border border-red-100 text-center">
							<span class="block text-xl font-bold text-red-700">{stabilityStats.cancelCount}</span>
							<span class="text-xs text-muted-foreground">Cancellations</span>
						</div>
						<div class="flex-1 bg-orange-50 p-2 rounded border border-orange-100 text-center">
							<span class="block text-xl font-bold text-orange-700"
								>{stabilityStats.returnCount}</span
							>
							<span class="text-xs text-muted-foreground">Returns (RTO)</span>
						</div>
					</div>

					{#if stabilityStats.defectRate > 10}
						<div
							class="mt-2 text-xs bg-red-50 text-red-800 p-2 rounded border border-red-100 flex gap-2 items-start"
						>
							<div class="mt-0.5">🚨</div>
							<div>
								<strong>High Defect Rate:</strong> Over 10% of orders are canceled or returned. Investigate
								product quality or listing accuracy.
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Orders History -->
	<div class="rounded-lg border bg-card text-card-foreground shadow-sm">
		<div class="flex flex-col space-y-1.5 p-6">
			<h3 class="text-2xl font-semibold leading-none tracking-tight">Orders History</h3>
			<p class="text-sm text-muted-foreground">A list of all orders containing {data.sku}.</p>
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
							<!-- SKU Specific Columns -->
							<th
								class="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap bg-blue-50/50 cursor-pointer"
								onclick={() => toggleSort('skuRevenue')}
							>
								<div class="flex items-center gap-1">
									SKU Revenue
									{#if sortColumn === 'skuRevenue'}
										{#if sortDirection === 'asc'}<ArrowUp class="h-3 w-3" />{:else}<ArrowDown
												class="h-3 w-3"
											/>{/if}
									{:else}
										<ArrowUpDown class="h-3 w-3 opacity-50" />
									{/if}
								</div>
							</th>
							<th
								class="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap bg-blue-50/50 cursor-pointer"
								onclick={() => toggleSort('skuProfit')}
							>
								<div class="flex items-center gap-1">
									SKU Profit
									{#if sortColumn === 'skuProfit'}
										{#if sortDirection === 'asc'}<ArrowUp class="h-3 w-3" />{:else}<ArrowDown
												class="h-3 w-3"
											/>{/if}
									{:else}
										<ArrowUpDown class="h-3 w-3 opacity-50" />
									{/if}
								</div>
							</th>
							<th
								class="h-12 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap bg-blue-50/50 cursor-pointer"
								onclick={() => toggleSort('skuUnits')}
							>
								<div class="flex items-center gap-1">
									SKU Units
									{#if sortColumn === 'skuUnits'}
										{#if sortDirection === 'asc'}<ArrowUp class="h-3 w-3" />{:else}<ArrowDown
												class="h-3 w-3"
											/>{/if}
									{:else}
										<ArrowUpDown class="h-3 w-3 opacity-50" />
									{/if}
								</div>
							</th>

							<!-- Order Level Columns -->
							<th
								class="h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground"
								onclick={() => toggleSort('orderRevenue')}
							>
								<div class="flex items-center gap-1">
									Order Total
									{#if sortColumn === 'orderRevenue'}
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
								onclick={() => toggleSort('orderProfit')}
							>
								<div class="flex items-center gap-1">
									Order Profit
									{#if sortColumn === 'orderProfit'}
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
								onclick={() => toggleSort('orderShippingCost')}
							>
								<div class="flex items-center gap-1">
									Shipping Cost
									{#if sortColumn === 'orderShippingCost'}
										{#if sortDirection === 'asc'}<ArrowUp class="h-3 w-3" />{:else}<ArrowDown
												class="h-3 w-3"
											/>{/if}
									{:else}
										<ArrowUpDown class="h-3 w-3 opacity-50" />
									{/if}
								</div>
							</th>

							<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
								>Order Items</th
							>
							<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
								>Order Units</th
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
						</tr>
					</thead>
					<tbody class="[&_tr:last-child]:border-0">
						{#each sortedOrders as order}
							<!-- Pre-calculated fields from enrichedOrders -->
							{@const orderProfit = order.orderProfit}
							{@const skuProfit = order.skuProfit}
							{@const totalUnits = order.skuUnits}
							<!-- This was sku units in logic above or total? Enriched has skuUnits and orderUnits logic might be needed if we want order total units -->
							<!-- Wait, totalUnits in old logic was summing ALL items in order. Enriched order has access to full items. -->
							{@const orderTotalUnits =
								order.amazon_order_items?.reduce(
									(sum: number, item: any) =>
										sum + (Number(item.quantity_ordered) || 0) * (item.bundle_quantity || 1),
									0
								) || 0}

							{@const rowClass =
								skuProfit < 0
									? 'bg-red-50/60 hover:bg-red-100/60'
									: skuProfit > 0
										? 'bg-green-50/40 hover:bg-green-100/50'
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

								<!-- SKU Specific Columns -->
								<td class="p-4 align-middle bg-blue-50/30 font-medium">
									{formatCurrency(order.skuRevenue, order.currency_code)}
								</td>
								<td class="p-4 align-middle bg-blue-50/30">
									<span class="font-medium {skuProfit > 0 ? 'text-green-600' : 'text-red-600'}">
										{skuProfit > 0 ? '+' : ''}{formatCurrency(skuProfit, order.currency_code)}
									</span>
								</td>
								<td class="p-4 align-middle bg-blue-50/30">
									{totalUnits}
								</td>

								<!-- Order Level Columns -->
								<td class="p-4 align-middle">
									{formatCurrency(order.orderRevenue, order.currency_code)}
								</td>
								<td class="p-4 align-middle">
									<span class="font-medium {orderProfit > 0 ? 'text-green-600' : 'text-red-600'}">
										{orderProfit > 0 ? '+' : ''}{formatCurrency(orderProfit, order.currency_code)}
									</span>
								</td>

								<td class="p-4 align-middle">
									{#if order.orderShippingCost > 0}
										<span class={getOrderShippingClass(order)}>
											{formatCurrency(order.orderShippingCost, order.currency_code)}
											<!-- {getShippingTypeLabel(order)} -->
										</span>
									{:else}
										<span class="text-muted-foreground">-</span>
									{/if}
								</td>

								<td class="p-4 align-middle">
									{order.number_of_items_shipped} / {order.number_of_items_unshipped}
								</td>
								<td class="p-4 align-middle">
									{orderTotalUnits}
								</td>
								<td class="p-4 align-middle">
									{#if order.amazon_order_items && order.amazon_order_items.length > 0}
										<div class="flex flex-col gap-2">
											{#each order.amazon_order_items as item}
												<div class="text-xs flex flex-col mb-2 last:mb-0">
													<div class="flex items-center gap-1 flex-wrap">
														<span
															class="font-semibold {item.seller_sku === data.sku
																? 'bg-yellow-200 px-1 rounded'
																: ''}">{item.seller_sku || 'No SKU'}</span
														>
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
															onclick={() => openDebugModal(order.amazon_order_id, item.seller_sku)}
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
								<td class="p-4 align-middle">
									<div class="flex items-center gap-2">
										<span>{order.automated_carrier || '-'}</span>
										<Button
											variant="ghost"
											size="icon"
											class="h-6 w-6 text-muted-foreground hover:text-primary"
											title="Sync from Linnworks"
											onclick={() => syncLinnworksOrder(order.amazon_order_id)}
										>
											<RefreshCw class="h-3 w-3" />
										</Button>
									</div>
								</td>
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
						{#if filteredOrders.length === 0}
							<tr
								class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
							>
								<td colspan="13" class="p-4 align-middle text-center py-8 text-muted-foreground">
									No orders found for this SKU.
								</td>
							</tr>
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
