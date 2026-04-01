<script lang="ts">
	interface Recommendation {
		itemName: string;
		brand: string | null;
		category: string | null;
		subCategory?: string | null;
		ean: string | null;
		upc: string | null;
		isbn: string | null;
		asin?: string | null;
		partNumber: string | null;
		modelNumber: string | null;
		initialB2bBuyerRequestedDate: string | null;
		initialB2bBuyerIndustry: string | null;
		link?: string;
		lowestPriceInTheLastWeek?: { amount: number; currencyCode: string } | null;
		hasFBAOffer?: boolean;
		offerCount?: number;
		reviewCount?: number;
		b2bSalesRank?: number;
		b2bSalesRankGrowth?: string;
		pageViews?: string;
		productPerformance?: any;
		isProductOnAmazon?: boolean;
		hasAmazonOffer?: boolean;
		hasOfferWithVatInvoiceGeneration?: boolean;
		isBrandYouOffer?: boolean;
		isCategoryYouOffer?: boolean;
	}

	// Initial sample data so the page isn't empty on load
	let reportData: { recommendations: Recommendation[] } = {
		recommendations: [
			{
				itemName: 'Sample Item (Click Fetch for Live Data)',
				brand: 'SAMPLE',
				category: 'Furniture',
				ean: '6424721049560',
				initialB2bBuyerRequestedDate: '2020-11-14 00:00:00',
				initialB2bBuyerIndustry: 'Hospitality',
				partNumber: 'EH-CABANA-GROMMET',
				upc: '123456789012',
				modelNumber: 'EH-CAB-001',
				isbn: '',
				lowestPriceInTheLastWeek: null
			},
			{
				brand: 'Callebaut',
				category: 'Grocery',
				partNumber: null,
				ean: '5410522516777',
				upc: null,
				modelNumber: null,
				isbn: null,
				asin: 'B0060OPQ8G',
				link: 'https://www.amazon.co.uk/dp/B0060OPQ8G/ref_=mbop',
				itemName: 'Callebaut Chocolate White Easi-Melt Buttons Callets 2.5 Kg',
				subCategory: '1000 Baking Supplies',
				lowestPriceInTheLastWeek: {
					amount: 13.49,
					currencyCode: 'GBP'
				},
				hasFBAOffer: false,
				offerCount: 0,
				reviewCount: 167,
				b2bSalesRank: 625,
				b2bSalesRankGrowth: 'LOW',
				pageViews: 'LOW',
				productPerformance: null,
				isProductOnAmazon: true,
				hasAmazonOffer: false,
				hasOfferWithVatInvoiceGeneration: false,
				isBrandYouOffer: false,
				isCategoryYouOffer: true,
				initialB2bBuyerRequestedDate: null,
				initialB2bBuyerIndustry: null
			}
		]
	};

	let isLoading = false;
	let status = '';
	let error = '';
	let reportId = '';
	let fetched = false;

	async function fetchLiveReport() {
		isLoading = true;
		status = 'Requesting report...';
		error = '';

		try {
			const response = await fetch('/api/amazon/b2b-opportunities', {
				method: 'POST'
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
			const response = await fetch(`/api/amazon/b2b-opportunities?reportId=${reportId}`);
			const data = await response.json();

			if (data.status === 'DONE') {
				status = 'Complete!';
				isLoading = false;
				fetched = true;
				if (data.data && data.data.recommendations) {
					recommendations = data.data.recommendations;
				} else if (data.data) {
					// Handle case where data might be just the array or different structure
					console.warn('Unexpected data format:', data.data);
					reportData = { recommendations: Array.isArray(data.data) ? data.data : [] };
				}
			} else if (data.status === 'CANCELLED' || data.status === 'FATAL') {
				throw new Error(`Report failed with status: ${data.status}`);
			} else {
				status = `Processing... (${data.status})`;
				// Poll again in 5 seconds
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

	let growthFilter: string | null = null;
	let viewsFilter: string | null = null;
	const LEVELS = ['LOW', 'MEDIUM', 'HIGH'];

	function toggleGrowth(level: string) {
		growthFilter = growthFilter === level ? null : level;
	}

	function toggleViews(level: string) {
		viewsFilter = viewsFilter === level ? null : level;
	}

	let recommendations: Recommendation[] = [];

	// Reactively filter recommendations whenever reportData, growthFilter, or viewsFilter changes
	$: {
		let source = reportData.recommendations || [];
		recommendations = source.filter((item) => {
			if (growthFilter && item.b2bSalesRankGrowth !== growthFilter) return false;
			if (viewsFilter && item.pageViews !== viewsFilter) return false;
			return true;
		});
	}
</script>

<div class="container mx-auto p-4 space-y-6">
	<div class="flex flex-col gap-6">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-2xl font-bold tracking-tight">B2B Product Opportunities Report</h1>
				<div class="text-sm text-muted-foreground flex items-center gap-2">
					<span>Type: GET_B2B_PRODUCT_OPPORTUNITIES_RECOMMENDED_FOR_YOU</span>
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
				<button
					on:click={fetchLiveReport}
					disabled={isLoading}
					class="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 py-2 px-4 shadow"
				>
					{isLoading ? 'Processing...' : 'Fetch Live Report'}
				</button>
			</div>
		</div>

		<!-- Filters -->
		<div class="flex flex-wrap gap-6 p-4 rounded-md border bg-muted/30">
			<div class="flex items-center gap-3">
				<span class="text-sm font-medium text-muted-foreground">Growth:</span>
				<div class="flex gap-2">
					{#each LEVELS as level}
						<button
							class="px-3 py-1 text-xs font-medium rounded-full border transition-all {growthFilter ===
							level
								? 'bg-primary text-primary-foreground border-primary'
								: 'bg-background hover:bg-muted border-input'}"
							on:click={() => toggleGrowth(level)}
						>
							{level}
						</button>
					{/each}
				</div>
			</div>

			<div class="w-px h-6 bg-border"></div>

			<div class="flex items-center gap-3">
				<span class="text-sm font-medium text-muted-foreground">Page Views:</span>
				<div class="flex gap-2">
					{#each LEVELS as level}
						<button
							class="px-3 py-1 text-xs font-medium rounded-full border transition-all {viewsFilter ===
							level
								? 'bg-primary text-primary-foreground border-primary'
								: 'bg-background hover:bg-muted border-input'}"
							on:click={() => toggleViews(level)}
						>
							{level}
						</button>
					{/each}
				</div>
			</div>

			{#if growthFilter || viewsFilter}
				<div class="w-px h-6 bg-border"></div>
				<button
					class="text-xs text-muted-foreground hover:text-foreground underline"
					on:click={() => {
						growthFilter = null;
						viewsFilter = null;
					}}
				>
					Clear Filters
				</button>
			{/if}
		</div>
	</div>

	<div class="rounded-md border bg-card text-card-foreground shadow-sm">
		<div class="relative w-full overflow-auto">
			<table class="w-full caption-bottom text-sm">
				<thead class="[&_tr]:border-b">
					<tr class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
							>Item Name</th
						>
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Brand</th
						>
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
							>Category/Subcat</th
						>
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
							>Industry</th
						>
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
							>Part/Model/ASIN</th
						>
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
							>Stats (Rank/Views/Reviews)</th
						>
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
							>Offers</th
						>
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
							>EAN/UPC/ISBN</th
						>
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
							>Requested Date</th
						>
					</tr>
				</thead>
				<tbody class="[&_tr:last-child]:border-0">
					{#if recommendations.length === 0}
						<tr>
							<td colspan="9" class="p-8 text-center text-muted-foreground">
								No recommendations found. Try fetching a live report.
							</td>
						</tr>
					{/if}
					{#each recommendations as item}
						<tr class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
							<td class="p-4 align-middle font-medium max-w-[300px]" title={item.itemName}>
								<div class="truncate">{item.itemName}</div>
								{#if item.link}
									<a
										href={item.link}
										target="_blank"
										rel="noopener noreferrer"
										class="text-xs text-blue-500 hover:underline inline-flex items-center gap-1 mt-1"
									>
										View on Amazon
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="10"
											height="10"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
											><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
											></path><polyline points="15 3 21 3 21 9"></polyline><line
												x1="10"
												y1="14"
												x2="21"
												y2="3"
											></line></svg
										>
									</a>
								{/if}
							</td>
							<td class="p-4 align-middle">{item.brand}</td>
							<td class="p-4 align-middle">
								<div class="flex flex-col gap-1 items-start">
									{#if item.category}
										<span
											class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80"
										>
											{item.category}
										</span>
									{/if}
									{#if item.subCategory}
										<span class="text-xs text-muted-foreground ml-1">{item.subCategory}</span>
									{/if}
								</div>
							</td>
							<td class="p-4 align-middle">{item.initialB2bBuyerIndustry || '-'}</td>
							<td class="p-4 align-middle font-mono text-xs text-muted-foreground">
								{#if item.asin}
									<div class="font-bold text-foreground">ASIN: {item.asin}</div>
									{#if item.isProductOnAmazon}<div class="text-[10px] text-green-600">
											On Amazon
										</div>{/if}
								{/if}
								{#if item.partNumber}<div>PN: {item.partNumber}</div>{/if}
								{#if item.modelNumber}<div>Model: {item.modelNumber}</div>{/if}
								{#if !item.partNumber && !item.modelNumber && !item.asin}-
								{/if}
							</td>
							<td class="p-4 align-middle text-xs">
								{#if item.b2bSalesRank}<div class="whitespace-nowrap">
										Rank: <span class="font-medium">{item.b2bSalesRank}</span>
									</div>{/if}
								{#if item.b2bSalesRankGrowth}<div class="text-muted-foreground">
										Growth: {item.b2bSalesRankGrowth}
									</div>{/if}
								{#if item.pageViews}<div>Views: {item.pageViews}</div>{/if}
								{#if item.reviewCount}<div>Reviews: {item.reviewCount}</div>{/if}
								{#if !item.b2bSalesRank && !item.pageViews && !item.reviewCount}-
								{/if}
							</td>
							<td class="p-4 align-middle text-xs">
								{#if item.offerCount !== undefined}<div>Count: {item.offerCount}</div>{/if}
								{#if item.hasFBAOffer !== undefined}
									<div
										class={item.hasFBAOffer
											? 'text-green-600 font-medium'
											: 'text-muted-foreground'}
									>
										FBA: {item.hasFBAOffer ? 'Yes' : 'No'}
									</div>
								{/if}
								{#if item.lowestPriceInTheLastWeek}
									<div>
										Low: {item.lowestPriceInTheLastWeek.amount}
										{item.lowestPriceInTheLastWeek.currencyCode}
									</div>
								{/if}
								{#if item.offerCount === undefined && item.hasFBAOffer === undefined}-
								{/if}
							</td>
							<td class="p-4 align-middle font-mono text-xs">
								{#if item.ean}<div>EAN: {item.ean}</div>{/if}
								{#if item.upc}<div>UPC: {item.upc}</div>{/if}
								{#if item.isbn}<div>ISBN: {item.isbn}</div>{/if}
								{#if !item.ean && !item.upc && !item.isbn}-
								{/if}
							</td>
							<td class="p-4 align-middle text-muted-foreground">
								{item.initialB2bBuyerRequestedDate
									? new Date(item.initialB2bBuyerRequestedDate).toLocaleDateString()
									: '-'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
