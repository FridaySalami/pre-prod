<script lang="ts">
	import { Button } from '$lib/shadcn/ui/button';
	import { RefreshCw, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-svelte';
	import { showToast } from '$lib/toastStore';
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';

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

	$: selectedDate = data.date;

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
				return (
					sum +
					((item.costs.materialTotalCost || 0) +
						(item.costs.shippingCost || 0) +
						(item.costs.amazonFee || 0)) *
						item.quantity_ordered
				);
			}
			return sum;
		}, 0);
	}

	$: filteredOrders = data.orders || [];

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

	$: totalSales = sortedOrders.reduce(
		(sum, order) => sum + (parseFloat(order.order_total) || 0),
		0
	);
	$: totalCosts = sortedOrders.reduce((sum, order) => sum + calculateOrderCost(order), 0);
	$: totalProfit = totalSales - totalCosts;

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
		syncStartTime = Date.now();
		syncDuration = 0;
		syncing = true;
		syncStatus = 'Starting sync...';
		syncProgress = 0;
		syncTotal = 0;

		try {
			console.log(`Fetching /api/amazon/orders/sync?date=${selectedDate}...`);
			const response = await fetch(`/api/amazon/orders/sync?date=${selectedDate}`);

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
</script>

<div class="flex flex-col gap-6 p-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Amazon Orders</h1>
			<p class="text-muted-foreground">View and manage your Amazon orders</p>
		</div>
		<div class="flex flex-col items-end gap-2">
			<div class="flex items-center gap-2">
				<input
					type="date"
					class="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					value={selectedDate}
					onchange={(e) => goto(`?date=${e.currentTarget.value}`)}
				/>
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

	<div class="grid gap-4 md:grid-cols-3">
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
									{#if order.amazon_order_items && order.amazon_order_items.length > 0}
										<div class="flex flex-col gap-2">
											{#each order.amazon_order_items as item}
												<div class="text-xs flex flex-col">
													<div class="flex items-center gap-1">
														<span class="font-semibold">{item.seller_sku || 'No SKU'}</span>
														<span class="text-muted-foreground bg-muted px-1 rounded"
															>ASIN: {item.asin}</span
														>
														<span class="font-bold">x{item.quantity_ordered}</span>
														{#if item.shipping_price_amount > 0}
															<span class="text-xs text-muted-foreground ml-1">
																(+{formatCurrency(
																	item.shipping_price_amount,
																	item.shipping_price_currency
																)} ship)
															</span>
														{/if}
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
										<span class="text-muted-foreground text-xs italic">No items synced</span>
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
