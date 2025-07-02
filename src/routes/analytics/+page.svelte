<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { userSession } from '$lib/sessionStore';
	import OrdersList from '$lib/OrdersList.svelte';
	import DuplicatedDailyProducts from '$lib/DuplicatedDailyProducts.svelte';
	import DocumentationLink from '$lib/components/DocumentationLink.svelte';

	// Authentication check
	let session: any = undefined;
	const unsubscribe = userSession.subscribe((s) => {
		session = s;
	});

	onDestroy(() => {
		unsubscribe();
	});

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
	let endDate = startDate;
	let searchSku = '';
	let dailyOrders: ProcessedOrder[] = [];
	let isLoading = false;
	let error: string | null = null;

	// Daily sales data
	let selectedMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
	let dailySalesData: any[] = [];
	let salesSummary: any = {};
	let isSalesLoading = false;
	let salesError: string | null = null;
	let isUpdatingMetrics = false;
	let updateMessage: string | null = null;
	let isUpdatingYear = false;
	let yearUpdateMessage: string | null = null;

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

	async function fetchDailySalesData(month: string) {
		isSalesLoading = true;
		salesError = null;
		try {
			// Calculate start and end dates for the month
			const startOfMonth = new Date(month + '-01');
			const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);

			const params = new URLSearchParams({
				startDate: startOfMonth.toISOString().split('T')[0],
				endDate: endOfMonth.toISOString().split('T')[0]
			});

			const response = await fetch(`/api/linnworks/financialData?${params}`);
			if (!response.ok) {
				throw new Error(`API Error ${response.status}: ${await response.text()}`);
			}
			const data = await response.json();
			if (data.error) {
				throw new Error(data.error);
			}

			dailySalesData = data.dailyData || [];
			salesSummary = data.summary || {};
		} catch (err) {
			console.error('Error fetching daily sales data:', err);
			salesError = err instanceof Error ? err.message : String(err);
		} finally {
			isSalesLoading = false;
		}
	}

	// Authentication and data loading
	onMount(async () => {
		// Wait for session to be determined
		const sessionTimeout = new Promise((resolve) => setTimeout(() => resolve(null), 5000));

		let currentSession;
		try {
			const unsubscribePromise = new Promise<any>((resolve) => {
				const unsub = userSession.subscribe((s) => {
					if (s !== undefined) {
						currentSession = s;
						resolve(s);
						unsub();
					}
				});
			});

			await Promise.race([unsubscribePromise, sessionTimeout]);

			if (currentSession === null) {
				console.log('No session found, redirecting to login');
				goto('/login');
				return;
			}

			if (currentSession) {
				// Fetch initial data
				if (selectedTab === 'daily') {
					fetchDailyOrders(startDate, endDate);
				} else if (selectedTab === 'dailySales') {
					fetchDailySalesData(selectedMonth);
				}
			}
		} catch (error) {
			console.error('Error during initialization:', error);
			goto('/login');
		}
	});

	function handleDateChange() {
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

	function handleMonthChange() {
		fetchDailySalesData(selectedMonth);
	}

	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-GB', {
			style: 'currency',
			currency: 'GBP'
		}).format(amount);
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-GB', {
			weekday: 'short',
			day: 'numeric',
			month: 'short'
		});
	}

	async function updateDailyMetricReview() {
		if (!dailySalesData || dailySalesData.length === 0) {
			updateMessage = 'No sales data available to update';
			setTimeout(() => (updateMessage = null), 3000);
			return;
		}

		console.log('🚀 Starting daily metric review update');
		console.log('📊 Daily sales data:', dailySalesData);
		console.log('📊 Sales summary:', salesSummary);

		isUpdatingMetrics = true;
		updateMessage = null;

		try {
			const requestBody = {
				dailySalesData
			};

			console.log('📤 Sending request:', requestBody);

			const response = await fetch('/api/daily-metric-review/update', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			console.log('📥 Response status:', response.status);
			console.log('📥 Response ok:', response.ok);

			const result = await response.json();
			console.log('📥 Response result:', result);

			if (result.success) {
				updateMessage = `✅ ${result.message}`;
				console.log('✅ Update successful:', result);
			} else {
				console.error('❌ Full result object:', result);
				console.error('❌ Error type:', typeof result.error);
				console.error('❌ Error value:', result.error);

				// Handle different error types
				let errorMessage = 'Unknown error';
				if (typeof result.error === 'string') {
					errorMessage = result.error;
				} else if (result.error && typeof result.error === 'object') {
					errorMessage = JSON.stringify(result.error);
				}

				updateMessage = `❌ Update failed: ${errorMessage}`;
				console.error('❌ Update failed:', result);
				if (result.results?.errors?.length > 0) {
					console.error('❌ Update errors details:', result.results.errors);
					console.error('❌ First error sample:', result.results.errors[0]);
				}
			}
		} catch (error) {
			console.error('❌ Error updating daily metric review:', error);
			updateMessage = `❌ Error: ${error instanceof Error ? error.message : String(error)}`;
		} finally {
			isUpdatingMetrics = false;
			// Clear message after 5 seconds
			setTimeout(() => (updateMessage = null), 5000);
		}
	}
</script>

<svelte:head>
	<title>Analytics | Parker's Foodservice</title>
</svelte:head>

<!-- Authentication check wrapper -->
{#if session === undefined}
	<div class="loading-container">
		<div class="loading-spinner"></div>
		<p>Loading...</p>
	</div>
{:else if session}
	<div class="analytics-container">
		<div class="page-header">
			<div class="header-content">
				<div class="header-text">
					<h2>Analytics</h2>
					<p class="subtitle">Performance metrics and business insights</p>
				</div>
				<DocumentationLink section="analytics" />
			</div>
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
					class:active={selectedTab === 'dailySales'}
					on:click={() => {
						selectedTab = 'dailySales';
						fetchDailySalesData(selectedMonth);
					}}
				>
					Daily Sales
				</button>
				<button
					class="tab-button"
					class:active={selectedTab === 'monthly'}
					on:click={() => (window.location.href = '/analytics/monthly')}
				>
					Monthly Dashboard
				</button>
				<button
					class="tab-button"
					class:active={selectedTab === 'overview'}
					on:click={() => (selectedTab = 'overview')}
				>
					Overview
				</button>
				<button
					class="tab-button"
					class:active={selectedTab === 'duplicatedDaily'}
					on:click={() => (selectedTab = 'duplicatedDaily')}
				>
					Duplicated Daily Products
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
										<button type="button" class="clear-button" on:click={clearSearch}>
											Clear
										</button>
									{/if}
								</div>
							</form>
						</div>
					</div>

					<OrdersList orders={dailyOrders} loading={isLoading} {error} />
				</div>
			{:else if selectedTab === 'dailySales'}
				<div class="daily-sales">
					<div class="controls">
						<div class="controls-row">
							<div class="month-selector">
								<label for="month-input">Select Month:</label>
								<input
									id="month-input"
									type="month"
									bind:value={selectedMonth}
									on:change={handleMonthChange}
								/>
							</div>

							{#if dailySalesData.length > 0}
								<div class="update-controls">
									<button
										class="update-button"
										on:click={updateDailyMetricReview}
										disabled={isUpdatingMetrics}
									>
										{isUpdatingMetrics ? 'Updating...' : 'Update Daily Metrics'}
									</button>
								</div>
							{/if}
						</div>

						{#if updateMessage}
							<div
								class="update-message"
								class:success={updateMessage.includes('✅')}
								class:error={updateMessage.includes('❌')}
							>
								{updateMessage}
							</div>
						{/if}
					</div>

					{#if isSalesLoading}
						<div class="loading-state">
							<div class="loading-spinner"></div>
							<p>Loading sales data...</p>
						</div>
					{:else if salesError}
						<div class="error-state">
							<p>Error loading sales data: {salesError}</p>
						</div>
					{:else if dailySalesData.length > 0}
						<!-- Summary Cards -->
						<div class="summary-cards">
							<div class="summary-card">
								<h3>Total Sales</h3>
								<p class="amount">{formatCurrency(salesSummary.totalSales || 0)}</p>
							</div>
							<div class="summary-card">
								<h3>Total Orders</h3>
								<p class="amount">{salesSummary.totalOrders || 0}</p>
							</div>
							<div class="summary-card">
								<h3>Avg Order Value</h3>
								<p class="amount">{formatCurrency(salesSummary.averageOrderValue || 0)}</p>
							</div>
							<div class="summary-card">
								<h3>Total Profit</h3>
								<p class="amount">{formatCurrency(salesSummary.totalProfit || 0)}</p>
							</div>
						</div>

						<!-- Daily Sales Table -->
						<div class="sales-table-container">
							<table class="sales-table">
								<thead>
									<tr>
										<th>Date</th>
										<th>Amazon</th>
										<th>eBay</th>
										<th>Shopify</th>
										<th>Other</th>
										<th>Total Sales</th>
										<th>Orders</th>
										<th>Avg Order</th>
										<th>Profit</th>
									</tr>
								</thead>
								<tbody>
									{#each dailySalesData as dayData}
										<tr>
											<td class="date-cell">{formatDate(dayData.date)}</td>
											<td class="amount-cell"
												>{formatCurrency(dayData.salesData.amazonSales || 0)}</td
											>
											<td class="amount-cell">{formatCurrency(dayData.salesData.ebaySales || 0)}</td
											>
											<td class="amount-cell"
												>{formatCurrency(dayData.salesData.shopifySales || 0)}</td
											>
											<td class="amount-cell"
												>{formatCurrency(dayData.salesData.otherSales || 0)}</td
											>
											<td class="amount-cell total"
												>{formatCurrency(dayData.salesData.totalSales || 0)}</td
											>
											<td class="number-cell">{dayData.salesData.orderCount || 0}</td>
											<td class="amount-cell"
												>{formatCurrency(dayData.salesData.averageOrderValue || 0)}</td
											>
											<td class="amount-cell profit"
												>{formatCurrency(dayData.salesData.totalProfit || 0)}</td
											>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}
						<div class="empty-state">
							<p>No sales data available for this month.</p>
						</div>
					{/if}
				</div>
			{:else if selectedTab === 'duplicatedDaily'}
				<DuplicatedDailyProducts />
			{:else}
				<div class="overview">
					<p>Analytics overview coming soon...</p>
				</div>
			{/if}
		</div>
	</div>
{:else}
	<!-- When session is null, onMount should have redirected already -->
	<div class="loading-container">
		<p>Redirecting to login...</p>
	</div>
{/if}

<style>
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		color: #1d1d1f;
	}

	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(0, 122, 255, 0.1);
		border-radius: 50%;
		border-top-color: #007aff;
		animation: spin 1s ease-in-out infinite;
		margin-bottom: 16px;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.analytics-container {
		padding: 24px;
		max-width: 1400px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: 32px;
	}

	.header-content {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}

	.header-text h2 {
		margin: 0 0 4px 0;
		color: #1f2937;
		font-size: 2rem;
		font-weight: 600;
	}

	.header-text .subtitle {
		margin: 0;
		color: #6b7280;
		font-size: 1.1rem;
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

	/* Daily Sales Styles */
	.daily-sales {
		margin-top: 16px;
	}

	.controls-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
		flex-wrap: wrap;
		gap: 16px;
	}

	@media (max-width: 768px) {
		.controls-row {
			flex-direction: column;
			align-items: flex-start;
		}
	}

	.month-selector {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.month-selector label {
		color: #6b7280;
		font-size: 0.9em;
		font-weight: 500;
	}

	input[type='month'] {
		padding: 8px 12px;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		font-size: 0.9em;
		background: white;
	}

	.update-controls {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.update-button {
		padding: 10px 20px;
		background: #004225;
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.9em;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.2s;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.update-button:hover:not(:disabled) {
		background: #003019;
	}

	.update-button:disabled {
		background: #9ca3af;
		cursor: not-allowed;
	}

	.update-message {
		padding: 8px 12px;
		border-radius: 6px;
		font-size: 0.9em;
		font-weight: 500;
	}

	.update-message.success {
		background: #d1fae5;
		color: #065f46;
		border: 1px solid #a7f3d0;
	}

	.update-message.error {
		background: #fee2e2;
		color: #991b1b;
		border: 1px solid #fca5a5;
	}

	.summary-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 16px;
		margin-bottom: 32px;
	}

	.summary-card {
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 20px;
		text-align: center;
	}

	.summary-card h3 {
		margin: 0 0 8px 0;
		font-size: 0.9em;
		font-weight: 500;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.summary-card .amount {
		margin: 0;
		font-size: 1.5em;
		font-weight: 600;
		color: #1f2937;
	}

	.sales-table-container {
		overflow-x: auto;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
	}

	.sales-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9em;
	}

	.sales-table th {
		background: #f9fafb;
		padding: 12px 8px;
		text-align: left;
		font-weight: 600;
		color: #374151;
		border-bottom: 1px solid #e5e7eb;
		white-space: nowrap;
	}

	.sales-table td {
		padding: 12px 8px;
		border-bottom: 1px solid #f3f4f6;
	}

	.sales-table tbody tr:hover {
		background: #f9fafb;
	}

	.date-cell {
		font-weight: 500;
		color: #1f2937;
		white-space: nowrap;
	}

	.amount-cell {
		text-align: right;
		font-family:
			'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
		white-space: nowrap;
	}

	.amount-cell.total {
		font-weight: 600;
		color: #059669;
	}

	.amount-cell.profit {
		color: #dc2626;
	}

	.number-cell {
		text-align: right;
		font-weight: 500;
	}

	.loading-state,
	.error-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 48px 24px;
		color: #6b7280;
	}

	.error-state {
		color: #dc2626;
	}

	.loading-state .loading-spinner {
		margin-bottom: 16px;
	}
</style>
