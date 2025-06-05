<script lang="ts">
	import { formatNumber } from '$lib/utils';

	// Default to last 7 days
	const today = new Date();
	const sevenDaysAgo = new Date();
	sevenDaysAgo.setDate(today.getDate() - 7);

	let startDate = sevenDaysAgo.toISOString().split('T')[0];
	let endDate = today.toISOString().split('T')[0];
	let loading = false;
	let error: string | null = null;
	let financialData: any = null;

	async function fetchFinancialData() {
		loading = true;
		error = null;
		try {
			const response = await fetch(
				`/api/linnworks/financialData?startDate=${startDate}&endDate=${endDate}`
			);

			if (!response.ok) {
				throw new Error(`API Error ${response.status}: ${await response.text()}`);
			}

			financialData = await response.json();
			console.log('Financial data:', financialData);
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			console.error('Failed to fetch financial data:', err);
		} finally {
			loading = false;
		}
	}
</script>

<div class="container">
	<h1>Financial Data Test</h1>

	<div class="controls">
		<div class="date-inputs">
			<label>
				Start Date:
				<input type="date" bind:value={startDate} max={today.toISOString().split('T')[0]} />
			</label>
			<label>
				End Date:
				<input type="date" bind:value={endDate} max={new Date().toISOString().split('T')[0]} />
			</label>
		</div>
		<button on:click={fetchFinancialData} disabled={loading}>
			{loading ? 'Loading...' : 'Fetch Financial Data'}
		</button>
	</div>

	{#if error}
		<div class="error">
			<p>Error: {error}</p>
		</div>
	{/if}

	{#if financialData}
		<div class="results">
			<h2>Summary</h2>
			<div class="summary-grid">
				<div class="summary-item">
					<h3>Total Sales</h3>
					<p>£{formatNumber(financialData.summary.totalSales)}</p>
				</div>
				<div class="summary-item">
					<h3>Total Profit</h3>
					<p>£{formatNumber(financialData.summary.totalProfit)}</p>
				</div>
				<div class="summary-item">
					<h3>Total Orders</h3>
					<p>{formatNumber(financialData.summary.totalOrders)}</p>
				</div>
				<div class="summary-item">
					<h3>Average Order Value</h3>
					<p>£{formatNumber(financialData.summary.averageOrderValue)}</p>
				</div>
				<div class="summary-item">
					<h3>Total Shipping</h3>
					<p>£{formatNumber(financialData.summary.totalShipping)}</p>
				</div>
				<div class="summary-item">
					<h3>Total Discounts</h3>
					<p>£{formatNumber(financialData.summary.totalDiscounts)}</p>
				</div>
			</div>

			<h2>Daily Breakdown</h2>
			<div class="table-container">
				<table>
					<thead>
						<tr>
							<th>Date</th>
							<th>Sales</th>
							<th>Profit</th>
							<th>Orders</th>
							<th>Avg Order</th>
							<th>Shipping</th>
							<th>Discounts</th>
						</tr>
					</thead>
					<tbody>
						{#each financialData.dailyData as day}
							<tr>
								<td>{day.formattedDate}</td>
								<td>£{formatNumber(day.salesData.totalSales)}</td>
								<td>£{formatNumber(day.salesData.totalProfit)}</td>
								<td>{formatNumber(day.salesData.orderCount)}</td>
								<td>£{formatNumber(day.salesData.averageOrderValue)}</td>
								<td>£{formatNumber(day.salesData.totalShipping)}</td>
								<td>£{formatNumber(day.salesData.totalDiscount)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

<style>
	.container {
		padding: 20px;
		max-width: 1200px;
		margin: 0 auto;
	}

	.controls {
		display: flex;
		gap: 20px;
		margin-bottom: 20px;
		align-items: center;
	}

	.date-inputs {
		display: flex;
		gap: 10px;
	}

	.date-inputs label {
		display: flex;
		gap: 5px;
		align-items: center;
	}

	button {
		padding: 8px 16px;
		background-color: #4f46e5;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	button:disabled {
		background-color: #9ca3af;
		cursor: not-allowed;
	}

	.error {
		padding: 12px;
		background-color: #fee2e2;
		border: 1px solid #ef4444;
		border-radius: 4px;
		color: #dc2626;
		margin: 20px 0;
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 20px;
		margin-bottom: 30px;
	}

	.summary-item {
		padding: 15px;
		background-color: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
	}

	.summary-item h3 {
		font-size: 0.9em;
		color: #64748b;
		margin: 0 0 8px 0;
	}

	.summary-item p {
		font-size: 1.5em;
		font-weight: 600;
		margin: 0;
		color: #0f172a;
	}

	.table-container {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 20px;
	}

	th,
	td {
		padding: 12px;
		text-align: right;
		border-bottom: 1px solid #e2e8f0;
	}

	th:first-child,
	td:first-child {
		text-align: left;
	}

	th {
		background-color: #f8fafc;
		font-weight: 600;
		color: #475569;
	}

	tr:hover {
		background-color: #f8fafc;
	}
</style>
