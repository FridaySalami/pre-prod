<script lang="ts">
	import { onMount } from 'svelte';

	interface SearchCatalogPerformanceData {
		startDate: string;
		endDate: string;
		asin: string;
		impressionData: {
			impressionCount: number;
			impressionMedianPrice: { amount: number; currencyCode: string };
			sameDayShippingImpressionCount: number;
			oneDayShippingImpressionCount: number;
			twoDayShippingImpressionCount: number;
		};
		clickData: {
			clickCount: number;
			clickRate: number;
			clickedMedianPrice: { amount: number; currencyCode: string };
			sameDayShippingClickCount: number;
			oneDayShippingClickCount: number;
			twoDayShippingClickCount: number;
		};
		cartAddData: {
			cartAddCount: number;
			cartAddedMedianPrice: { amount: number; currencyCode: string };
			sameDayShippingCartAddCount: number;
			oneDayShippingCartAddCount: number;
			twoDayShippingCartAddCount: number;
		};
		purchaseData: {
			purchaseCount: number;
			searchTrafficSales: { amount: number; currencyCode: string };
			conversionRate: number;
			purchaseMedianPrice: { amount: number; currencyCode: string };
			sameDayShippingPurchaseCount: number;
			oneDayShippingPurchaseCount: number;
			twoDayShippingPurchaseCount: number;
		};
	}

	interface ReportSpecification {
		reportType: string;
		reportOptions: {
			reportPeriod: string;
			asins?: string;
		};
		dataStartTime: string;
		dataEndTime: string;
		marketplaceIds: string[];
	}

	interface ReportResponse {
		reportSpecification: ReportSpecification;
		dataByAsin: SearchCatalogPerformanceData[];
		pagination?: {
			nextToken: string;
		};
	}

	let reportData: ReportResponse = {
		reportSpecification: {
			reportType: 'GET_BRAND_ANALYTICS_SEARCH_CATALOG_PERFORMANCE_REPORT',
			reportOptions: {
				reportPeriod: 'WEEK',
				asins: 'B123456789 B987654321'
			},
			dataStartTime: '2025-01-05',
			dataEndTime: '2025-01-11',
			marketplaceIds: ['ATVPDKIKX0DER']
		},
		dataByAsin: [
			{
				startDate: '2025-01-05',
				endDate: '2025-01-11',
				asin: 'B123456789 (SAMPLE)',
				impressionData: {
					impressionCount: 10000,
					impressionMedianPrice: { amount: 19.99, currencyCode: 'GBP' },
					sameDayShippingImpressionCount: 5000,
					oneDayShippingImpressionCount: 3000,
					twoDayShippingImpressionCount: 2000
				},
				clickData: {
					clickCount: 1000,
					clickRate: 0.1,
					clickedMedianPrice: { amount: 19.99, currencyCode: 'GBP' },
					sameDayShippingClickCount: 500,
					oneDayShippingClickCount: 300,
					twoDayShippingClickCount: 200
				},
				cartAddData: {
					cartAddCount: 100,
					cartAddedMedianPrice: { amount: 19.99, currencyCode: 'GBP' },
					sameDayShippingCartAddCount: 50,
					oneDayShippingCartAddCount: 30,
					twoDayShippingCartAddCount: 20
				},
				purchaseData: {
					purchaseCount: 50,
					searchTrafficSales: { amount: 999.5, currencyCode: 'GBP' },
					conversionRate: 0.05,
					purchaseMedianPrice: { amount: 19.99, currencyCode: 'GBP' },
					sameDayShippingPurchaseCount: 25,
					oneDayShippingPurchaseCount: 15,
					twoDayShippingPurchaseCount: 10
				}
			}
		]
	};

	let isLoading = false;
	let status = '';
	let error = '';
	let reportId = '';
	let fetched = false;

	// Default dates (last full week: Sunday to Saturday)
	let startDate = '';
	let endDate = '';
	let reportPeriod = 'WEEK';
	let asins = '';

	onMount(() => {
		// Calculate last full week (Sunday to Saturday)
		const today = new Date();
		const dayOfWeek = today.getDay(); // 0 is Sunday

		// Go back to previous Saturday
		const lastSaturday = new Date(today);
		lastSaturday.setDate(today.getDate() - dayOfWeek - 1);

		// Go back 6 days from Saturday to get Sunday
		const lastSunday = new Date(lastSaturday);
		lastSunday.setDate(lastSaturday.getDate() - 6);

		startDate = lastSunday.toISOString().split('T')[0];
		endDate = lastSaturday.toISOString().split('T')[0];
	});

	let isAppending = false;

	async function fetchLiveReport(nextToken?: string) {
		isLoading = true;
		status = 'Requesting report...';
		error = '';

		if (!nextToken) {
			isAppending = false;
			items = [];
		} else {
			isAppending = true;
		}

		try {
			const response = await fetch('/api/amazon/search-catalog-performance', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					reportPeriod,
					dataStartTime: startDate,
					dataEndTime: endDate,
					asins: asins.trim() || undefined,
					nextToken
				})
			});

			if (!response.ok) {
				throw new Error('Failed to request report');
			}

			const data = await response.json();
			reportId = data.reportId;
			status = 'Report requested. Polling status...';

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
		if (!reportId) return;

		try {
			const response = await fetch(`/api/amazon/search-catalog-performance?reportId=${reportId}`);
			const data = await response.json();

			if (data.status === 'DONE') {
				status = 'Complete!';
				isLoading = false;
				fetched = true;
				if (data.data) {
					const newItems = data.data.dataByAsin || [];
					if (isAppending) {
						items = [...items, ...newItems];
					} else {
						items = newItems;
					}
					// Update reportData to get the new nextToken
					reportData = data.data;
				}
			} else if (data.status === 'CANCELLED' || data.status === 'FATAL') {
				throw new Error(`Report failed with status: ${data.status}`);
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

	let items: SearchCatalogPerformanceData[] = [];
	// Removed reactive assignment to allow manual appending
	// $: items = reportData.dataByAsin || [];

	let sortKey: string = '';
	let sortDirection: 'asc' | 'desc' = 'desc';

	function sort(key: string) {
		if (sortKey === key) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDirection = 'desc';
		}

		items = [...items].sort((a, b) => {
			let valA: any, valB: any;

			// Handle nested properties access safely
			if (key === 'impressionCount') valA = a.impressionData?.impressionCount || 0;
			if (key === 'impressionPrice') valA = a.impressionData?.impressionMedianPrice?.amount || 0;
			if (key === 'impression1Day') valA = a.impressionData?.oneDayShippingImpressionCount || 0;

			if (key === 'clickCount') valA = a.clickData?.clickCount || 0;
			if (key === 'clickRate') valA = a.clickData?.clickRate || 0;
			if (key === 'clickPrice') valA = a.clickData?.clickedMedianPrice?.amount || 0;

			if (key === 'cartCount') valA = a.cartAddData?.cartAddCount || 0;
			if (key === 'cartPrice') valA = a.cartAddData?.cartAddedMedianPrice?.amount || 0;

			if (key === 'purchaseCount') valA = a.purchaseData?.purchaseCount || 0;
			if (key === 'conversionRate') valA = a.purchaseData?.conversionRate || 0;
			if (key === 'purchaseSales') valA = a.purchaseData?.searchTrafficSales?.amount || 0;

			if (key === 'asin') valA = a.asin;

			if (key === 'impressionCount') valB = b.impressionData?.impressionCount || 0;
			if (key === 'impressionPrice') valB = b.impressionData?.impressionMedianPrice?.amount || 0;
			if (key === 'impression1Day') valB = b.impressionData?.oneDayShippingImpressionCount || 0;

			if (key === 'clickCount') valB = b.clickData?.clickCount || 0;
			if (key === 'clickRate') valB = b.clickData?.clickRate || 0;
			if (key === 'clickPrice') valB = b.clickData?.clickedMedianPrice?.amount || 0;

			if (key === 'cartCount') valB = b.cartAddData?.cartAddCount || 0;
			if (key === 'cartPrice') valB = b.cartAddData?.cartAddedMedianPrice?.amount || 0;

			if (key === 'purchaseCount') valB = b.purchaseData?.purchaseCount || 0;
			if (key === 'conversionRate') valB = b.purchaseData?.conversionRate || 0;
			if (key === 'purchaseSales') valB = b.purchaseData?.searchTrafficSales?.amount || 0;

			if (key === 'asin') valB = b.asin;

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
				<h1 class="text-2xl font-bold tracking-tight">Search Catalog Performance Report</h1>
				<div class="text-sm text-muted-foreground flex items-center gap-2">
					<span>Type: GET_BRAND_ANALYTICS_SEARCH_CATALOG_PERFORMANCE_REPORT</span>
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
				<label for="period" class="text-sm font-medium">Period</label>
				<select
					id="period"
					bind:value={reportPeriod}
					class="h-9 px-3 py-1 rounded-md border text-sm"
				>
					<option value="WEEK">WEEK</option>
					<option value="MONTH">MONTH</option>
					<option value="QUARTER">QUARTER</option>
				</select>
			</div>
			<div class="flex flex-col gap-2">
				<label for="start" class="text-sm font-medium">Start Date (Sun)</label>
				<input
					type="date"
					id="start"
					bind:value={startDate}
					class="h-9 px-3 py-1 rounded-md border text-sm"
				/>
			</div>
			<div class="flex flex-col gap-2">
				<label for="end" class="text-sm font-medium">End Date (Sat)</label>
				<input
					type="date"
					id="end"
					bind:value={endDate}
					class="h-9 px-3 py-1 rounded-md border text-sm"
				/>
			</div>
			<div class="flex flex-col gap-2">
				<label for="asins" class="text-sm font-medium">ASINs (Optional, space-sep)</label>
				<input
					type="text"
					id="asins"
					bind:value={asins}
					placeholder="B123 B456"
					class="h-9 px-3 py-1 rounded-md border text-sm"
				/>
			</div>
		</div>

		<button
			on:click={() => fetchLiveReport()}
			disabled={isLoading}
			class="w-full sm:w-auto inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-8 shadow"
		>
			{isLoading ? 'Processing Report Request...' : 'Fetch Live Report'}
		</button>
	</div>

	{#if items.length === 0}
		<div class="rounded-md border p-8 text-center text-muted-foreground">
			{#if isLoading && !isAppending}
				Requesting report from Amazon... This may take a minute.
			{:else if fetched}
				No data found for the selected period.
			{:else}
				Please select a period and fetch the report.
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
								>ASIN {sortKey === 'asin' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</th
							>
							<th
								colspan="3"
								class="h-10 px-4 text-center font-medium text-muted-foreground border-r bg-blue-50/50"
								>Impressions</th
							>
							<th
								colspan="3"
								class="h-10 px-4 text-center font-medium text-muted-foreground border-r bg-green-50/50"
								>Clicks</th
							>
							<th
								colspan="2"
								class="h-10 px-4 text-center font-medium text-muted-foreground border-r bg-yellow-50/50"
								>Add to Cart</th
							>
							<th
								colspan="3"
								class="h-10 px-4 text-center font-medium text-muted-foreground bg-purple-50/50"
								>Purchases</th
							>
						</tr>
						<tr class="border-b text-xs">
							<th class="h-10 px-4 text-left font-medium border-r"
								>Range: {items[0]?.startDate} - {items[0]?.endDate}</th
							>
							<!-- Impressions -->
							<th
								class="px-2 text-right bg-blue-50/30 cursor-pointer hover:bg-blue-100"
								on:click={() => sort('impressionCount')}
								>Count {sortKey === 'impressionCount'
									? sortDirection === 'asc'
										? '↑'
										: '↓'
									: ''}</th
							>
							<th
								class="px-2 text-right bg-blue-50/30 cursor-pointer hover:bg-blue-100"
								on:click={() => sort('impressionPrice')}
								>Price (£) {sortKey === 'impressionPrice'
									? sortDirection === 'asc'
										? '↑'
										: '↓'
									: ''}</th
							>
							<th
								class="px-2 text-right bg-blue-50/30 border-r cursor-pointer hover:bg-blue-100"
								on:click={() => sort('impression1Day')}
								>1-Day {sortKey === 'impression1Day'
									? sortDirection === 'asc'
										? '↑'
										: '↓'
									: ''}</th
							>
							<!-- Clicks -->
							<th
								class="px-2 text-right bg-green-50/30 cursor-pointer hover:bg-green-100"
								on:click={() => sort('clickCount')}
								>Count {sortKey === 'clickCount' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</th
							>
							<th
								class="px-2 text-right bg-green-50/30 cursor-pointer hover:bg-green-100"
								on:click={() => sort('clickRate')}
								>CTR % {sortKey === 'clickRate' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</th
							>
							<th
								class="px-2 text-right bg-green-50/30 border-r cursor-pointer hover:bg-green-100"
								on:click={() => sort('clickPrice')}
								>Price (£) {sortKey === 'clickPrice'
									? sortDirection === 'asc'
										? '↑'
										: '↓'
									: ''}</th
							>
							<!-- Cart -->
							<th
								class="px-2 text-right bg-yellow-50/30 cursor-pointer hover:bg-yellow-100"
								on:click={() => sort('cartCount')}
								>Count {sortKey === 'cartCount' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}</th
							>
							<th
								class="px-2 text-right bg-yellow-50/30 border-r cursor-pointer hover:bg-yellow-100"
								on:click={() => sort('cartPrice')}
								>Price (£) {sortKey === 'cartPrice'
									? sortDirection === 'asc'
										? '↑'
										: '↓'
									: ''}</th
							>
							<!-- Purchases -->
							<th
								class="px-2 text-right bg-purple-50/30 cursor-pointer hover:bg-purple-100"
								on:click={() => sort('purchaseCount')}
								>Count {sortKey === 'purchaseCount'
									? sortDirection === 'asc'
										? '↑'
										: '↓'
									: ''}</th
							>
							<th
								class="px-2 text-right bg-purple-50/30 cursor-pointer hover:bg-purple-100"
								on:click={() => sort('conversionRate')}
								>Conv % {sortKey === 'conversionRate'
									? sortDirection === 'asc'
										? '↑'
										: '↓'
									: ''}</th
							>
							<th
								class="px-2 text-right bg-purple-50/30 cursor-pointer hover:bg-purple-100"
								on:click={() => sort('purchaseSales')}
								>Sales (£) {sortKey === 'purchaseSales'
									? sortDirection === 'asc'
										? '↑'
										: '↓'
									: ''}</th
							>
						</tr>
					</thead>
					<tbody>
						{#each items as item}
							<tr class="border-b hover:bg-muted/50 transition-colors">
								<td class="p-3 border-r font-mono font-medium">{item.asin}</td>

								<!-- Impressions -->
								<td class="p-3 text-right bg-blue-50/10"
									>{item.impressionData?.impressionCount || 0}</td
								>
								<td class="p-3 text-right bg-blue-50/10"
									>{item.impressionData?.impressionMedianPrice?.amount || '-'}</td
								>
								<td class="p-3 text-right border-r bg-blue-50/10 text-muted-foreground"
									>{item.impressionData?.oneDayShippingImpressionCount || 0}</td
								>

								<!-- Clicks -->
								<td class="p-3 text-right bg-green-50/10">{item.clickData?.clickCount || 0}</td>
								<td class="p-3 text-right bg-green-50/10"
									>{((item.clickData?.clickRate || 0) * 100).toFixed(2)}%</td
								>
								<td class="p-3 text-right border-r bg-green-50/10"
									>{item.clickData?.clickedMedianPrice?.amount || '-'}</td
								>

								<!-- Cart -->
								<td class="p-3 text-right bg-yellow-50/10">{item.cartAddData?.cartAddCount || 0}</td
								>
								<td class="p-3 text-right border-r bg-yellow-50/10"
									>{item.cartAddData?.cartAddedMedianPrice?.amount || '-'}</td
								>

								<!-- Purchases -->
								<td class="p-3 text-right bg-purple-50/10 font-bold"
									>{item.purchaseData?.purchaseCount || 0}</td
								>
								<td class="p-3 text-right bg-purple-50/10"
									>{((item.purchaseData?.conversionRate || 0) * 100).toFixed(2)}%</td
								>
								<td class="p-3 text-right bg-purple-50/10"
									>{item.purchaseData?.searchTrafficSales?.amount || '-'}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			{#if reportData?.pagination?.nextToken}
				<div class="p-4 border-t bg-muted/20 flex justify-center">
					<button
						on:click={() => fetchLiveReport(reportData?.pagination?.nextToken)}
						disabled={isLoading}
						class="w-full sm:w-auto inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-4 py-2"
					>
						{isLoading && isAppending ? 'Loading next page...' : 'Load More Results'}
					</button>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Raw Data Review -->
	<div class="rounded-md border bg-muted/20 p-4">
		<details>
			<summary class="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
				Raw Data Review (JSON)
			</summary>
			<div class="mt-4 bg-black rounded-md p-4 overflow-auto max-h-[500px]">
				<pre class="text-xs text-green-400 font-mono whitespace-pre-wrap">{JSON.stringify(
						reportData,
						null,
						2
					)}</pre>
			</div>
		</details>
	</div>
</div>
