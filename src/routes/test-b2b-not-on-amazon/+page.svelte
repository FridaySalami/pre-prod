<script lang="ts">
	interface Recommendation {
		itemName: string;
		brand: string | null;
		category: string | null;
		initialB2bBuyerIndustry: string | null;
		partNumber: string | null;
		ean: string | null;
		upc: string | null;
		modelNumber: string | null;
		isbn: string | null;
		initialB2bBuyerRequestedDate: string | null;
	}

	// Initial sample data so the page isn't empty on load
	let reportData: { recommendations: Recommendation[] } = {
		recommendations: [
			{
				itemName: 'Exclusive Home Cabana Indoor/Outdoor Grommet Top Curtain Panel Pair (Sample)',
				brand: 'EXCLUSIVE HOME',
				category: 'Furniture',
				ean: '6424721049560',
				initialB2bBuyerRequestedDate: '2020-11-14 00:00:00',
				initialB2bBuyerIndustry: 'Hospitality',
				partNumber: 'EH-CABANA-GROMMET',
				upc: null,
				modelNumber: null,
				isbn: null
			},
			{
				brand: 'Tate & Lyle',
				category: 'Grocery',
				partNumber: null,
				ean: '5028881073062',
				upc: null,
				modelNumber: null,
				isbn: null,
				itemName: 'Tate & Lyle White Sugar Stick Pack of 100 -approx 100 sticks',
				initialB2bBuyerIndustry: null,
				initialB2bBuyerRequestedDate: null
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
			const response = await fetch('/api/amazon/b2b-not-on-amazon', {
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
			const response = await fetch(`/api/amazon/b2b-not-on-amazon?reportId=${reportId}`);
			const data = await response.json();

			if (data.status === 'DONE') {
				status = 'Complete!';
				isLoading = false;
				fetched = true;
				if (data.data && data.data.recommendations) {
					reportData = data.data;
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

	let recommendations: Recommendation[] = [];
	$: recommendations = reportData.recommendations || [];
</script>

<div class="container mx-auto p-4 space-y-6">
	<div class="flex flex-col gap-6">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-2xl font-bold tracking-tight">B2B Opportunities Not Yet On Amazon</h1>
				<div class="text-sm text-muted-foreground flex items-center gap-2">
					<span>Type: GET_B2B_PRODUCT_OPPORTUNITIES_NOT_YET_ON_AMAZON</span>
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
							>Category</th
						>
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
							>Industry</th
						>
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
							>Part/Model</th
						>
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
							>Codes (EAN/UPC/ISBN)</th
						>
						<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
							>Requested Date</th
						>
					</tr>
				</thead>
				<tbody class="[&_tr:last-child]:border-0">
					{#if recommendations.length === 0}
						<tr>
							<td colspan="7" class="p-8 text-center text-muted-foreground">
								No recommendations found. Try fetching a live report.
							</td>
						</tr>
					{/if}
					{#each recommendations as item}
						<tr class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
							<td class="p-4 align-middle font-medium max-w-[300px]" title={item.itemName}>
								<div class="truncate">{item.itemName}</div>
							</td>
							<td class="p-4 align-middle">{item.brand}</td>
							<td class="p-4 align-middle">
								{#if item.category}
									<span
										class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80"
									>
										{item.category}
									</span>
								{/if}
							</td>
							<td class="p-4 align-middle">{item.initialB2bBuyerIndustry || '-'}</td>
							<td class="p-4 align-middle font-mono text-xs text-muted-foreground">
								{#if item.partNumber}<div>PN: {item.partNumber}</div>{/if}
								{#if item.modelNumber}<div>Model: {item.modelNumber}</div>{/if}
								{#if !item.partNumber && !item.modelNumber}-
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
