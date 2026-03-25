<script lang="ts">
	import { onMount } from 'svelte';

	interface SalesAndTrafficData {
		childAsin: string;
		parentAsin: string;
		sku?: string;
		sales: {
			orderedProductSales: { amount: number; currencyCode: string };
			unitsOrdered: number;
			totalOrderItems: number;
			averageSellingPrice?: { amount: number; currencyCode: string };
		};
		traffic: {
			browserPageViews: number;
			mobileAppPageViews: number;
			sessions: number;
			browserSessions: number;
			buyBoxPercentage: number;
		};
	}

	let queryId: string | null = null;
	let status: string = '';
	let error: string = '';
	let isLoading = false;
	let fetched = false;

	let startDate = '';
	let endDate = '';
	let items: SalesAndTrafficData[] = [];

	let sortKey: string = '';
	let sortDirection: 'asc' | 'desc' = 'desc';

	onMount(() => {
		// Default to last full week (Sun-Sat)
		const today = new Date();
		const day = today.getDay(); // 0 is Sunday
		const daysSinceLastSaturday = day + 1;

		const lastSaturday = new Date(today);
		lastSaturday.setDate(today.getDate() - daysSinceLastSaturday);

		const lastSunday = new Date(lastSaturday);
		lastSunday.setDate(lastSaturday.getDate() - 6);

		startDate = lastSunday.toISOString().split('T')[0];
		endDate = lastSaturday.toISOString().split('T')[0];
	});

	async function fetchReport() {
		isLoading = true;
		status = 'Requesting query...';
		error = '';
		items = [];

		try {
			const response = await fetch('/api/amazon/sales-and-traffic', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					startDate,
					endDate
				})
			});

			if (!response.ok) {
				throw new Error('Failed to request query');
			}

			const data = await response.json();
			queryId = data.queryId;
			status = 'Query requested. Polling status...';

			pollStatus();
		} catch (e: unknown) {
			if (e instanceof Error) {
				error = e.message;
			} else {
				error = String(e);
			}
			isLoading = false;
		}
	}

	async function pollStatus() {
		if (!queryId) return;

		try {
			const response = await fetch(`/api/amazon/sales-and-traffic?queryId=${queryId}`);
			const data = await response.json();

			if (data.status === 'DONE') {
				status = 'Complete!';
				isLoading = false;
				fetched = true;
				if (data.data) {
					// Handle different response formats (Raw JSON or nested GraphQL)
					const result = data.data;

					if (Array.isArray(result)) {
						items = result;
					} else if (result.data?.analytics_salesAndTraffic_2024_04_24?.salesAndTrafficByAsin) {
						items = result.data.analytics_salesAndTraffic_2024_04_24.salesAndTrafficByAsin;
					} else if (result.salesAndTrafficByAsin) {
						items = result.salesAndTrafficByAsin;
					} else {
						// Fallback: try to find an array in the object
						console.error('Unexpected data structure:', result);
						error = 'Unexpected data structure received from Amazon.';
					}
				}
			} else if (data.status === 'CANCELLED' || data.status === 'FATAL') {
				throw new Error(`Query failed with status: ${data.status}`);
			} else {
				status = `Processing... (${data.status})`;
				setTimeout(pollStatus, 5000);
			}
		} catch (e: unknown) {
			if (e instanceof Error) {
				error = e.message;
			} else {
				error = String(e);
			}
			isLoading = false;
		}
	}

	function sort(key: string) {
		if (sortKey === key) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDirection = 'desc';
		}

		items = [...items].sort((a, b) => {
			let valA: any, valB: any;

			if (key === 'asin') valA = a?.childAsin || '';
			if (key === 'sku') valA = a?.sku || '';

			if (key === 'sales') valA = a?.sales?.orderedProductSales?.amount || 0;
			if (key === 'units') valA = a?.sales?.unitsOrdered || 0;
			if (key === 'orders') valA = a?.sales?.totalOrderItems || 0;

			if (key === 'sessions') valA = a?.traffic?.sessions || 0;
			if (key === 'views')
				valA = (a?.traffic?.browserPageViews || 0) + (a?.traffic?.mobileAppPageViews || 0);
			if (key === 'buybox') valA = a?.traffic?.buyBoxPercentage || 0;

			if (key === 'asin') valB = b?.childAsin || '';
			if (key === 'sku') valB = b?.sku || '';

			if (key === 'sales') valB = b?.sales?.orderedProductSales?.amount || 0;
			if (key === 'units') valB = b?.sales?.unitsOrdered || 0;
			if (key === 'orders') valB = b?.sales?.totalOrderItems || 0;

			if (key === 'sessions') valB = b?.traffic?.sessions || 0;
			if (key === 'views')
				valB = (b?.traffic?.browserPageViews || 0) + (b?.traffic?.mobileAppPageViews || 0);
			if (key === 'buybox') valB = b?.traffic?.buyBoxPercentage || 0;

			if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
			if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
			return 0;
		});
	}
</script>

<div class="container mx-auto p-4 space-y-6">
	<div class="flex flex-col gap-6">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-2xl font-bold tracking-tight">Sales and Traffic Report (Data Kiosk)</h1>
				<div class="text-sm text-muted-foreground flex items-center gap-2">
					<span>Type: analytics_salesAndTraffic_2024_04_24</span>
					{#if fetched}
						<span
							class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800"
						>
							Live Data
						</span>
					{/if}
				</div>
			</div>

			<div class="flex items-center gap-4">
				{#if status}
					<span class="text-sm text-muted-foreground">{status}</span>
				{/if}
				{#if error}
					<span class="text-sm text-red-500 font-medium">{error}</span>
				{/if}
			</div>
		</div>

		<!-- Request params -->
		<div class="grid gap-4 md:grid-cols-4 p-4 border rounded-md bg-muted/20">
			<div class="flex flex-col gap-2">
				<label for="start" class="text-sm font-medium">Start Date</label>
				<input
					type="date"
					id="start"
					bind:value={startDate}
					class="h-9 px-3 py-1 rounded-md border text-sm"
				/>
			</div>
			<div class="flex flex-col gap-2">
				<label for="end" class="text-sm font-medium">End Date</label>
				<input
					type="date"
					id="end"
					bind:value={endDate}
					class="h-9 px-3 py-1 rounded-md border text-sm"
				/>
			</div>
			<div class="flex items-end">
				<button
					on:click={fetchReport}
					disabled={isLoading}
					class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 shadow"
				>
					{isLoading ? 'Running Query...' : 'Run Query'}
				</button>
			</div>
		</div>
	</div>

	{#if items.length === 0}
		<div class="rounded-md border p-8 text-center text-muted-foreground">
			{#if isLoading}
				Running Data Kiosk Query... This may take a minute.
			{:else if fetched}
				No data returned for this period.
			{:else}
				Select dates and run verify query.
			{/if}
		</div>
	{:else}
		<div class="rounded-md border bg-card text-card-foreground shadow-sm overflow-hidden">
			<div class="relative w-full overflow-auto">
				<table class="w-full caption-bottom text-sm border-collapse">
					<thead>
						<tr class="border-b bg-muted/50">
							<th
								class="h-10 px-4 text-left font-medium text-muted-foreground border-r cursor-pointer hover:bg-muted"
								on:click={() => sort('asin')}
							>
								ASIN {sortKey === 'asin' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
							</th>
							<th
								class="h-10 px-4 text-left font-medium text-muted-foreground border-r cursor-pointer hover:bg-muted"
								on:click={() => sort('sku')}
							>
								SKU {sortKey === 'sku' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
							</th>

							<th
								class="h-10 px-4 text-right font-medium text-muted-foreground border-r bg-green-50/50 cursor-pointer hover:bg-green-100"
								on:click={() => sort('sales')}
							>
								Sales {sortKey === 'sales' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
							</th>
							<th
								class="h-10 px-4 text-right font-medium text-muted-foreground border-r bg-green-50/50 cursor-pointer hover:bg-green-100"
								on:click={() => sort('units')}
							>
								Units {sortKey === 'units' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
							</th>

							<th
								class="h-10 px-4 text-right font-medium text-muted-foreground border-r bg-blue-50/50 cursor-pointer hover:bg-blue-100"
								on:click={() => sort('sessions')}
							>
								Sessions {sortKey === 'sessions' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
							</th>
							<th
								class="h-10 px-4 text-right font-medium text-muted-foreground border-r bg-blue-50/50 cursor-pointer hover:bg-blue-100"
								on:click={() => sort('views')}
							>
								Page Views {sortKey === 'views' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
							</th>
							<th
								class="h-10 px-4 text-right font-medium text-muted-foreground bg-yellow-50/50 cursor-pointer hover:bg-yellow-100"
								on:click={() => sort('buybox')}
							>
								Buy Box {sortKey === 'buybox' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
							</th>
						</tr>
					</thead>
					<tbody>
						{#each items as item}
							<tr class="border-b hover:bg-muted/50 transition-colors">
								<td class="p-3 border-r font-mono font-medium">{item.childAsin}</td>
								<td class="p-3 border-r text-muted-foreground text-xs">{item.sku || '-'}</td>

								<td class="p-3 text-right font-bold bg-green-50/10">
									{item.sales.orderedProductSales.amount.toFixed(2)}
									{item.sales.orderedProductSales.currencyCode}
								</td>
								<td class="p-3 text-right bg-green-50/10">{item.sales.unitsOrdered}</td>

								<td class="p-3 text-right bg-blue-50/10">{item.traffic.sessions}</td>
								<td class="p-3 text-right bg-blue-50/10">
									{(item.traffic.browserPageViews || 0) + (item.traffic.mobileAppPageViews || 0)}
								</td>

								<td class="p-3 text-right bg-yellow-50/10">
									{item.traffic.buyBoxPercentage.toFixed(1)}%
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>
