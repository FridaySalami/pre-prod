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

	let startDate = new Date().toISOString().split('T')[0];
	let endDate = startDate;
	let searchSku = '';
	let dailyOrders: ProcessedOrder[] = [];
	let isLoading = false;
	let error: string | null = null;

	async function fetchDuplicatedDailyOrders(start: string, end: string, sku?: string) {
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

			// TODO: Update this API endpoint if needed for the duplicated functionality
			const response = await fetch(`/api/linnworks/daily-orders?${params}`, {
				credentials: 'include'
			});
			if (!response.ok) {
				throw new Error(`API Error ${response.status}: ${await response.text()}`);
			}
			const data = await response.json();
			if (!data.success) {
				throw new Error(data.error || 'Failed to fetch orders');
			}
			dailyOrders = data.orders || [];
		} catch (err) {
			console.error('Error fetching duplicated daily orders:', err);
			error = err instanceof Error ? err.message : String(err);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		fetchDuplicatedDailyOrders(startDate, endDate);
	});

	function handleDateChange() {
		if (new Date(endDate) < new Date(startDate)) {
			endDate = startDate;
		}
		fetchDuplicatedDailyOrders(startDate, endDate, searchSku);
	}

	function handleSearch(event: Event) {
		event.preventDefault();
		fetchDuplicatedDailyOrders(startDate, endDate, searchSku);
	}

	function clearSearch() {
		searchSku = '';
		fetchDuplicatedDailyOrders(startDate, endDate);
	}
</script>

<div class="daily-orders-duplicated">
	<div class="controls">
		<div class="search-row">
			<div class="date-range">
				<div class="date-input">
					<label for="start-date-duplicated">From:</label>
					<input
						id="start-date-duplicated"
						type="date"
						bind:value={startDate}
						on:change={handleDateChange}
						max={new Date().toISOString().split('T')[0]}
					/>
				</div>
				<div class="date-input">
					<label for="end-date-duplicated">To:</label>
					<input
						id="end-date-duplicated"
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
					<label for="sku-search-duplicated">Search SKU:</label>
					<input
						id="sku-search-duplicated"
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

<style>
	/* Styles are copied from +page.svelte, adjust as needed */
	.daily-orders-duplicated {
		margin-top: 16px;
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
</style>
