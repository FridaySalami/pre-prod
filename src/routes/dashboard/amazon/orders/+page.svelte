<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button';
	import { RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, Pencil, Bug, Download } from 'lucide-svelte';
	import { showToast } from '$lib/toastStore';
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import UpdateCostModal from '$lib/components/UpdateCostModal.svelte';
	import DebugModal from '$lib/components/DebugModal.svelte';

	export let data;

	let syncing = false;
	let syncStatus = '';
	let syncProgress = 0;
	let syncTotal = 0;
	let syncStartTime = 0;
	let syncDuration = 0;
	let sortColumn = 'purchase_date';
	let sortDirection: 'asc' | 'desc' = 'desc';
	let durationTimer: ReturnType<typeof setInterval> | null = null;

	$: view = $page.url.searchParams.get('view') || 'daily';

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

	$: {
		if (syncing) {
			if (!durationTimer) {
				durationTimer = setInterval(() => {
					if (syncStartTime) {
						syncDuration = (Date.now() - syncStartTime) / 1000;
					}
				}, 100);
			}
		} else if (durationTimer) {
			clearInterval(durationTimer);
			durationTimer = null;
		}
	}

	onDestroy(() => {
		if (durationTimer) clearInterval(durationTimer);
	});

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

	$: filteredOrders = data.orders || [];

	// SKU Analysis
	interface SkuStats {
		sku: string;
		title: string;
		asin: string;
		count: number;
		totalProfit: number;
		avgProfit: number;
		hasCostData: boolean;
	}

	$: skuStats = filteredOrders.reduce((acc: Record<string, SkuStats>, order: any) => {
		if (!order.amazon_order_items) return acc;

		order.amazon_order_items.forEach((item: any) => {
			if (!item.seller_sku) return;

			const sku = item.seller_sku;
			if (!acc[sku]) {
				acc[sku] = {
					sku,
					title: item.title || 'Unknown',
					asin: item.asin || '',
					count: 0,
					totalProfit: 0,
					avgProfit: 0,
					hasCostData: false
				};
			}

			const qty = Number(item.quantity_ordered) || 0;
			acc[sku].count += qty;

			// Calculate profit for this item
			// Item Revenue
			const itemPrice = Number(item.item_price_amount) || 0;
			const revenue = itemPrice * qty;

			// Item Cost
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
		avgProfit: stat.count > 0 ? stat.totalProfit / stat.count : 0
	}));

	$: topSellingSkus = [...skuList].sort((a, b) => b.count - a.count).slice(0, 10);
	$: leastSellingSkus = [...skuList].sort((a, b) => a.count - b.count).slice(0, 10);
	$: mostProfitableSkus = [...skuList]
		.filter((s) => s.hasCostData)
		.sort((a, b) => b.avgProfit - a.avgProfit)
		.slice(0, 10);
	$: leastProfitableSkus = [...skuList]
		.filter((s) => s.hasCostData)
		.sort((a, b) => a.avgProfit - b.avgProfit)
		.slice(0, 10);

	$: sortedOrders = [...filteredOrders].sort((a, b) => {
		let aValue = a[sortColumn];
		let bValue = b[sortColumn];

		if (sortColumn === 'order_total') {
			aValue = parseFloat(aValue) || 0;
			bValue = parseFloat(bValue) || 0;
		} else if (sortColumn === 'total_cost') {
			aValue = calculateOrderCost(a);
			bValue = calculateOrderCost(b);
		} else if (sortColumn === 'profit') {
			const aCost = calculateOrderCost(a);
			const bCost = calculateOrderCost(b);
			const aTotal = parseFloat(a.order_total) || 0;
			const bTotal = parseFloat(b.order_total) || 0;
			aValue = aTotal - aCost;
			bValue = bTotal - bCost;
		}

		if (aValue === bValue) return 0;

		// Handle nulls
		if (aValue === null) return 1;
		if (bValue === null) return -1;

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

	function toggleSort(column: string) {
		if (sortColumn === column) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			sortDirection = 'asc';
		}
	}

	async function syncOrders() {
		console.log('Sync button clicked');
		syncing = true;
		syncStatus = 'Starting sync...';
		syncProgress = 0;
		syncTotal = 0;

		try {
			console.log(`Fetching /api/amazon/orders/sync?date=${selectedDate}&view=${view}...`);
			const response = await fetch(`/api/amazon/orders/sync?date=${selectedDate}&view=${view}`);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const reader = response.body?.getReader();
			if (!reader) throw new Error('Response body is null');

			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const data = JSON.parse(line.slice(6));
						console.log('Stream data:', data);

						if (data.type === 'status') {
							syncStatus = data.message;
						} else if (data.type === 'progress') {
							syncProgress = data.ordersProcessed || 0;
							syncTotal = data.totalOrders || 0;
							syncStatus = `Syncing items... ${syncProgress}/${syncTotal} orders processed`;
						} else if (data.type === 'complete') {
							syncDuration = (Date.now() - syncStartTime) / 1000;
							syncStatus = `Complete! Took ${syncDuration.toFixed(1)}s. ${data.message}`;
							showToast(data.message, 'success');
							setTimeout(() => {
								window.location.reload();
							}, 2000);
						} else if (data.type === 'error') {
							showToast('Error: ' + data.error, 'error');
							syncStatus = 'Error: ' + data.error;
						}
					}
				}
			}
		} catch (e) {
			showToast('Error syncing orders', 'error');
			console.error('Sync error:', e);
			syncStatus = 'Sync failed';
		} finally {
			syncing = false;
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

	function formatCurrency(amount: number | null, currency: string = 'GBP') {
		if (amount === null || amount === undefined) return '-';
		return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
	}

	function downloadCSV() {
		const headers = [
			'Order ID',
			'Purchase Date',
			'Status',
			'Order Total',
			'Total Cost',
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
			const totalCost = calculateOrderCost(order);
			const orderTotal = parseFloat(order.order_total) || 0;
			const profit = orderTotal - totalCost;
			const skus = order.amazon_order_items?.map((i: any) => i.seller_sku).join('; ') || '';

			return [
				order.amazon_order_id,
				order.purchase_date,
				order.order_status,
				orderTotal.toFixed(2),
				totalCost.toFixed(2),
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
			<p class="text-muted-foreground">View and manage your Amazon orders</p>
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
				<Button variant="outline" onclick={downloadCSV}>
					<Download class="mr-2 h-4 w-4" />
					Export CSV
				</Button>
				<Button onclick={syncOrders} disabled={syncing}>
					<RefreshCw class="mr-2 h-4 w-4 {syncing ? 'animate-spin' : ''}" />
					{syncing ? 'Syncing...' : 'Sync Orders'}
				</Button>
			</div>
			{#if syncStatus}
				<div class="text-sm text-muted-foreground text-right">
					{syncStatus}
					{#if syncing || syncDuration > 0}
						<br />
						<span class="text-xs opacity-75">Duration: {syncDuration.toFixed(1)}s</span>
					{/if}
				</div>
			{/if}
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
									>Count</th
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
											<span>{sku.sku}</span>
											<span class="text-xs text-muted-foreground">{sku.title}</span>
										</div>
									</td>
									<td class="p-4 align-middle text-right">{sku.count}</td>
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
									>Count</th
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
											<span>{sku.sku}</span>
											<span class="text-xs text-muted-foreground">{sku.title}</span>
										</div>
									</td>
									<td class="p-4 align-middle text-right">{sku.count}</td>
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
				<h3 class="font-semibold leading-none tracking-tight">Most Profitable SKUs (Avg)</h3>
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
									>Count</th
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
											<span>{sku.sku}</span>
											<span class="text-xs text-muted-foreground">{sku.title}</span>
										</div>
									</td>
									<td class="p-4 align-middle text-right">{sku.count}</td>
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
				<h3 class="font-semibold leading-none tracking-tight">Least Profitable SKUs (Avg)</h3>
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
									>Count</th
								>
								<th class="h-12 px-4 text-right align-middle font-medium text-muted-foreground"
									>Avg Profit</th
								>
							</tr>
						</thead>
						<tbody class="[&_tr:last-child]:border-0">
							{#each leastProfitableSkus as sku}
								<tr
									class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
								>
									<td class="p-4 align-middle font-medium">
										<div class="flex flex-col">
											<span>{sku.sku}</span>
											<span class="text-xs text-muted-foreground">{sku.title}</span>
										</div>
									</td>
									<td class="p-4 align-middle text-right">{sku.count}</td>
									<td
										class="p-4 align-middle text-right {sku.avgProfit < 0
											? 'text-red-600'
											: 'text-green-600'}">{formatCurrency(sku.avgProfit)}</td
									>
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
									Total
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
									Est. Cost
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
						{#each sortedOrders as order}
							{@const totalCost = calculateOrderCost(order)}
							{@const profit = order.order_total ? parseFloat(order.order_total) - totalCost : 0}
							{@const totalUnits =
								order.amazon_order_items?.reduce(
									(sum: number, item: any) =>
										sum + (Number(item.quantity_ordered) || 0) * (item.bundle_quantity || 1),
									0
								) || 0}
							<tr
								class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
							>
								<td class="p-4 align-middle font-medium">{order.amazon_order_id}</td>
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
										<span class="font-medium">{formatCurrency(totalCost, order.currency_code)}</span
										>
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
														<span class="font-semibold">{item.seller_sku || 'No SKU'}</span>
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
						{#if data.orders.length === 0}
							<tr
								class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
							>
								<td colspan="10" class="p-4 align-middle text-center py-8 text-muted-foreground">
									No orders found. Click "Sync Yesterday's Orders" to fetch data.
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
