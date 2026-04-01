<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;

	const { chartData, summary } = data;

	// Format currency
	const formatCurrency = (value: number) => {
		return new Intl.NumberFormat('en-GB', {
			style: 'currency',
			currency: 'GBP'
		}).format(value);
	};

	// Format number with commas
	const formatNumber = (value: number) => {
		return new Intl.NumberFormat('en-GB').format(Math.round(value));
	};

	// Find max values for chart scaling
	const maxRevenue = Math.max(...chartData.map((d: any) => d.totalRevenue));
	const maxUnits = Math.max(...chartData.map((d: any) => d.totalUnits));
</script>

<div class="container">
	<!-- Header -->
	<div class="header">
		<div>
			<h1 class="header-title">📊 Amazon Sales Overview</h1>
			<p class="header-subtitle">
				Last {summary.daysWithData} days · {summary.productCount} products
			</p>
		</div>
		<div class="badge">📈 30-Day Summary</div>
	</div>

	{#if chartData.length === 0}
		<!-- No Data Message -->
		<div class="card">
			<div class="text-center" style="padding: 3rem;">
				<h2 style="font-size: 1.5rem; margin-bottom: 1rem;">📭 No Sales Data Yet</h2>
				<p style="color: #6b7280; margin-bottom: 1.5rem;">
					Sales data will appear here once the backfill process completes.<br />
					This typically takes 15-20 minutes.
				</p>
				<p style="color: #9ca3af; font-size: 0.875rem;">
					Make sure you've run: <code
						style="background: #f3f4f6; padding: 0.25rem 0.5rem; border-radius: 4px;"
						>node backfill-sales-data.js 3</code
					>
				</p>
			</div>
		</div>
	{:else}
		<!-- Summary Cards -->
		<div class="grid">
			<div class="stat-card">
				<div class="stat-label">💰 Total Revenue</div>
				<div class="stat-value">{formatCurrency(summary.totalRevenue)}</div>
				<div class="stat-subtext">Avg: {formatCurrency(summary.avgDailyRevenue)}/day</div>
			</div>

			<div class="stat-card">
				<div class="stat-label">🛒 Units Sold</div>
				<div class="stat-value">{formatNumber(summary.totalUnits)}</div>
				<div class="stat-subtext">
					Avg: {formatNumber(summary.totalUnits / summary.daysWithData)}/day
				</div>
			</div>

			<div class="stat-card">
				<div class="stat-label">👥 Total Sessions</div>
				<div class="stat-value">{formatNumber(summary.totalSessions)}</div>
				<div class="stat-subtext">
					Avg: {formatNumber(summary.totalSessions / summary.daysWithData)}/day
				</div>
			</div>

			<div class="stat-card">
				<div class="stat-label">📦 Active Products</div>
				<div class="stat-value">{summary.productCount}</div>
				<div class="stat-subtext">With sales data</div>
			</div>
		</div>

		<!-- Revenue Chart -->
		<div class="card">
			<div class="card-header">
				<h2 class="card-title">📊 Daily Revenue Trend</h2>
				<p class="card-description">Total revenue across all products by date</p>
			</div>
			<div class="chart-container">
				<svg class="w-full h-full" viewBox="0 0 1000 300" preserveAspectRatio="none">
					<!-- Grid lines -->
					{#each [0, 25, 50, 75, 100] as percent}
						<line
							x1="50"
							y1={260 - (percent * 200) / 100}
							x2="980"
							y2={260 - (percent * 200) / 100}
							stroke="#e5e7eb"
							stroke-width="1"
						/>
						<text
							x="10"
							y={265 - (percent * 200) / 100}
							font-size="12"
							fill="#6b7280"
							text-anchor="start"
						>
							{formatCurrency((maxRevenue * percent) / 100)}
						</text>
					{/each}

					<!-- Area Chart -->
					<path
						d={chartData.reduce((path: string, point: any, i: number) => {
							const x = 50 + i * (930 / (chartData.length - 1));
							const y = 260 - (point.totalRevenue / maxRevenue) * 200;
							return path + (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
						}, '') + ` L ${50 + 930} 260 L 50 260 Z`}
						fill="rgb(59, 130, 246)"
						fill-opacity="0.2"
						stroke="rgb(59, 130, 246)"
						stroke-width="2"
					/>

					<!-- Date labels -->
					{#each chartData.filter((_: any, i: number) => i % Math.ceil(chartData.length / 10) === 0) as point}
						{@const x = 50 + chartData.indexOf(point) * (930 / (chartData.length - 1))}
						<text {x} y="285" font-size="10" fill="#6b7280" text-anchor="middle">
							{new Date(point.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
						</text>
					{/each}
				</svg>
			</div>
		</div>

		<!-- Units Sold Chart -->
		<div class="card">
			<div class="card-header">
				<h2 class="card-title">🛒 Daily Units Sold</h2>
				<p class="card-description">Total units sold across all products by date</p>
			</div>
			<div class="chart-container">
				<svg class="w-full h-full" viewBox="0 0 1000 300" preserveAspectRatio="none">
					<!-- Grid lines -->
					{#each [0, 25, 50, 75, 100] as percent}
						<line
							x1="50"
							y1={260 - (percent * 200) / 100}
							x2="980"
							y2={260 - (percent * 200) / 100}
							stroke="#e5e7eb"
							stroke-width="1"
						/>
						<text
							x="10"
							y={265 - (percent * 200) / 100}
							font-size="12"
							fill="#6b7280"
							text-anchor="start"
						>
							{formatNumber((maxUnits * percent) / 100)}
						</text>
					{/each}

					<!-- Bar Chart -->
					{#each chartData as point, i}
						{@const x = 50 + i * (930 / chartData.length)}
						{@const barWidth = 930 / chartData.length - 2}
						{@const height = (point.totalUnits / maxUnits) * 200}
						<rect
							{x}
							y={260 - height}
							width={barWidth}
							{height}
							fill="rgb(34, 197, 94)"
							fill-opacity="0.8"
						/>
					{/each}

					<!-- Date labels -->
					{#each chartData.filter((_: any, i: number) => i % Math.ceil(chartData.length / 10) === 0) as point}
						{@const x = 50 + chartData.indexOf(point) * (930 / chartData.length)}
						<text
							x={x + 930 / chartData.length / 2}
							y="285"
							font-size="10"
							fill="#6b7280"
							text-anchor="middle"
						>
							{new Date(point.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
						</text>
					{/each}
				</svg>
			</div>
		</div>

		<!-- Link to detailed dashboard -->
		<div class="card">
			<div class="text-center">
				<p class="card-description" style="margin-bottom: 1rem;">
					For detailed per-product analysis and filtering
				</p>
				<a href="/sales-dashboard" class="btn"> 📦 View Detailed Sales Dashboard </a>
			</div>
		</div>
	{/if}
</div>

<style>
	.card {
		background: white;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		padding: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.card-header {
		margin-bottom: 1rem;
	}

	.card-title {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0 0 0.25rem 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.card-description {
		color: #6b7280;
		font-size: 0.875rem;
	}

	.stat-card {
		background: white;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		padding: 1.25rem;
	}

	.stat-label {
		font-size: 0.875rem;
		color: #6b7280;
		margin-bottom: 0.5rem;
	}

	.stat-value {
		font-size: 1.875rem;
		font-weight: 700;
		margin-bottom: 0.25rem;
	}

	.stat-subtext {
		font-size: 0.75rem;
		color: #9ca3af;
	}

	.grid {
		display: grid;
		gap: 1.5rem;
		margin-bottom: 1.5rem;
	}

	@media (min-width: 768px) {
		.grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (min-width: 1024px) {
		.grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: #f3f4f6;
		border-radius: 6px;
		font-size: 1rem;
		font-weight: 500;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.625rem 1rem;
		background: #3b82f6;
		color: white;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		text-decoration: none;
		transition: background 0.2s;
	}

	.btn:hover {
		background: #2563eb;
	}

	.container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem 1.5rem;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	.header-title {
		font-size: 2rem;
		font-weight: 700;
		margin: 0 0 0.25rem 0;
	}

	.header-subtitle {
		color: #6b7280;
		font-size: 0.875rem;
	}

	.chart-container {
		height: 300px;
		width: 100%;
	}

	.text-center {
		text-align: center;
	}
</style>
