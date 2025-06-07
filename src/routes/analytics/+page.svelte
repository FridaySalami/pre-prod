<script lang="ts">
	import { onMount } from 'svelte';
	import OrdersList from '$lib/OrdersList.svelte';

	interface ProcessedOrder {
		nOrderId: number;
		Source: string;
		OrderId?: string;
		Items?: {
			ItemNumber?: string;
			ItemName?: string;
			SKU?: string;
			Quantity?: number;
			ItemValue?: number;
		}[];
		fTotalCharge?: number;
		fPostageCost?: number;
		Status?: number;
		PostalServiceName?: string;
	}

	let selectedTab = 'daily';
	let startDate = new Date().toISOString().split('T')[0];
	let endDate = startDate; // Default end date same as start date
	let searchSku = ''; // Add SKU search state
	let dailyOrders: ProcessedOrder[] = [];
	let isLoading = false;
	let error: string | null = null;

	async function fetchDailyOrders(start: string, end: string, sku?: string) {
		isLoading = true;
		error = null;
		try {
			const params = new URLSearchParams({
				startDate: start,
				endDate: end
			});
			if (sku) {
				params.append('sku', sku);
			}

			const response = await fetch(`/api/linnworks/daily-orders?${params}`);
			if (!response.ok) {
				throw new Error(`API Error ${response.status}: ${await response.text()}`);
			}
			const data = await response.json();
			if (!data.success) {
				throw new Error(data.error || 'Failed to fetch orders');
			}
			dailyOrders = data.orders || [];
		} catch (err) {
			console.error('Error fetching daily orders:', err);
			error = err instanceof Error ? err.message : String(err);
		} finally {
			isLoading = false;
		}
	}

	// Fetch initial data
	onMount(() => {
		fetchDailyOrders(startDate, endDate);
	});

	function handleDateChange() {
		// Ensure endDate is not before startDate
		if (new Date(endDate) < new Date(startDate)) {
			endDate = startDate;
		}
		fetchDailyOrders(startDate, endDate, searchSku);
	}

	function handleSearch(event: Event) {
		event.preventDefault();
		fetchDailyOrders(startDate, endDate, searchSku);
	}

	function clearSearch() {
		searchSku = '';
		fetchDailyOrders(startDate, endDate);
	}
</script>

<div class="analytics-container">
	<div class="page-header">
		<h2>Analytics</h2>
		<p class="subtitle">Performance metrics and business insights</p>
	</div>

	<div class="analytics-content">
		<div class="tabs">
			<button
				class="tab-button"
				class:active={selectedTab === 'daily'}
				on:click={() => (selectedTab = 'daily')}
			>
				Daily Products
			</button>
			<button
				class="tab-button"
				class:active={selectedTab === 'overview'}
				on:click={() => (selectedTab = 'overview')}
			>
				Overview
			</button>
		</div>

		{#if selectedTab === 'daily'}
			<div class="daily-orders">
				<div class="controls">
					<div class="search-row">
						<div class="date-range">
							<div class="date-input">
								<label for="start-date">From:</label>
								<input
									id="start-date"
									type="date"
									bind:value={startDate}
									on:change={handleDateChange}
									max={new Date().toISOString().split('T')[0]}
								/>
							</div>
							<div class="date-input">
								<label for="end-date">To:</label>
								<input
									id="end-date"
									type="date"
									bind:value={endDate}
									min={startDate}
									on:change={handleDateChange}
									max={new Date().toISOString().split('T')[0]}
								/>
							</div>
						</div>
						<form class="search-form" on:submit={handleSearch}>
							<div class="search-input">
								<label for="sku-search">Search SKU:</label>
								<input
									id="sku-search"
									type="text"
									bind:value={searchSku}
									placeholder="Enter SKU to search..."
								/>
							</div>
							<div class="search-actions">
								<button type="submit" class="search-button" disabled={!searchSku || isLoading}>
									{isLoading ? 'Searching...' : 'Search'}
								</button>
								{#if searchSku}
									<button type="button" class="clear-button" on:click={clearSearch}> Clear </button>
								{/if}
							</div>
						</form>
					</div>
				</div>

				<OrdersList orders={dailyOrders} loading={isLoading} {error} />
			</div>
		{:else}
			<div class="overview">
				<p>Analytics overview coming soon...</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.analytics-container {
		padding: 24px;
		max-width: 1400px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 32px;
	}

	.page-header h2 {
		font-size: 1.8em;
		font-weight: 600;
		color: #1f2937;
		margin: 0 0 8px 0;
	}

	.subtitle {
		color: #6b7280;
		font-size: 1.1em;
		margin: 0;
	}

	.analytics-content {
		background: white;
		border-radius: 8px;
		padding: 24px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.tabs {
		display: flex;
		gap: 1px;
		background: #e5e7eb;
		padding: 1px;
		border-radius: 8px;
		margin-bottom: 24px;
	}

	.tab-button {
		flex: 1;
		padding: 12px 24px;
		background: white;
		border: none;
		cursor: pointer;
		font-size: 0.9em;
		font-weight: 500;
		color: #6b7280;
		transition: all 0.2s ease;
	}

	.tab-button:first-child {
		border-top-left-radius: 8px;
		border-bottom-left-radius: 8px;
	}

	.tab-button:last-child {
		border-top-right-radius: 8px;
		border-bottom-right-radius: 8px;
	}

	.tab-button.active {
		background: #004225;
		color: white;
	}

	.controls {
		margin-bottom: 24px;
	}

	.search-row {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	@media (min-width: 768px) {
		.search-row {
			flex-direction: row;
			justify-content: space-between;
			align-items: flex-start;
		}
	}

	.date-range {
		display: flex;
		gap: 16px;
		align-items: center;
	}

	.date-input {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.date-input label {
		color: #6b7280;
		font-size: 0.9em;
	}

	input[type='date'] {
		padding: 8px 12px;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		font-size: 0.9em;
	}

	.search-form {
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}

	.search-input {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.search-input label {
		color: #6b7280;
		font-size: 0.9em;
	}

	.search-input input {
		padding: 8px 12px;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		font-size: 0.9em;
		width: 200px;
	}

	.search-actions {
		display: flex;
		gap: 8px;
		align-items: flex-end;
	}

	.search-button {
		padding: 8px 16px;
		background: #004225;
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.9em;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.search-button:disabled {
		background: #9ca3af;
		cursor: not-allowed;
	}

	.clear-button {
		padding: 8px 16px;
		background: #f3f4f6;
		color: #4b5563;
		border: none;
		border-radius: 6px;
		font-size: 0.9em;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.clear-button:hover {
		background: #e5e7eb;
	}

	.daily-orders {
		margin-top: 16px;
	}
</style>
