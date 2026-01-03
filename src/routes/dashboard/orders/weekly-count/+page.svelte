<script lang="ts">
	import { onMount } from 'svelte';
	import { format, addWeeks, subWeeks, parseISO } from 'date-fns';

	interface DailyOrderCount {
		date: string;
		count: number;
		formattedDate: string;
	}

	interface ProfitStats {
		bottom50PercentCount: number;
		bottom50PercentProfit: number;
		totalProfit: number;
		bottom50PercentProfitShare: number;
	}

	// State
	let dailyOrders: DailyOrderCount[] = [];
	let profitStats: ProfitStats | null = null;
	let showProfitStats = false;
	let loading = false;
	let error: string | null = null;
	let startDate: string;
	let endDate: string;

	// Chart data
	let maxCount = 0;

	// Function to fetch data
	async function fetchWeeklyData(start?: string, end?: string) {
		loading = true;
		error = null;

		try {
			// Build query parameters
			const params = new URLSearchParams();
			if (start) params.append('startDate', start);
			if (end) params.append('endDate', end);

			const url = `/api/linnworks/weeklyOrderCounts?${params.toString()}`;
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`API Error ${response.status}: ${await response.text()}`);
			}

			const data = await response.json();

			// Update state
			startDate = data.startDate;
			endDate = data.endDate;
			dailyOrders = data.dailyOrders;
			profitStats = data.summary?.profitStats || null;
			console.log('Profit Stats:', profitStats);

			// Calculate max for chart scaling
			maxCount = Math.max(...dailyOrders.map((day) => day.count), 10);
		} catch (err) {
			console.error('Failed to fetch weekly order counts:', err);
			error = err instanceof Error ? err.message : String(err);
		} finally {
			loading = false;
		}
	}

	// Navigate to previous week
	function previousWeek() {
		if (startDate) {
			const newStartDate = subWeeks(parseISO(startDate), 1);
			const newEndDate = subWeeks(parseISO(endDate), 1);
			fetchWeeklyData(format(newStartDate, 'yyyy-MM-dd'), format(newEndDate, 'yyyy-MM-dd'));
		}
	}

	// Navigate to next week
	function nextWeek() {
		if (endDate) {
			const newStartDate = addWeeks(parseISO(startDate), 1);
			const newEndDate = addWeeks(parseISO(endDate), 1);
			fetchWeeklyData(format(newStartDate, 'yyyy-MM-dd'), format(newEndDate, 'yyyy-MM-dd'));
		}
	}

	// Format date range for display
	function getDateRangeText() {
		if (!startDate || !endDate) return 'Current Week';

		return `${format(parseISO(startDate), 'MMM d')} - ${format(parseISO(endDate), 'MMM d, yyyy')}`;
	}

	// Load data on component mount
	onMount(() => {
		fetchWeeklyData();
	});
</script>

<div class="container mx-auto px-4 py-8">
	<div class="flex justify-between items-center mb-6">
		<h1 class="text-2xl font-bold">Weekly Order Dashboard</h1>

		<div class="flex items-center space-x-2">
			<button
				on:click={previousWeek}
				class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
				disabled={loading}
			>
				&larr; Previous Week
			</button>

			<span class="px-4 font-medium">{getDateRangeText()}</span>

			<button
				on:click={nextWeek}
				class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
				disabled={loading || new Date(endDate) >= new Date()}
			>
				Next Week &rarr;
			</button>
		</div>
	</div>

	<!-- Loading spinner -->
	{#if loading}
		<div class="flex justify-center py-8">
			<div class="text-center">
				<div
					class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"
				></div>
				<p class="mt-3">Loading data...</p>
			</div>
		</div>
	{:else if error}
		<!-- Error message -->
		<div class="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg mb-6">
			<p class="font-bold">Error:</p>
			<p>{error}</p>
		</div>
	{:else if dailyOrders.length > 0}
		<!-- Order count dashboard -->
		<div class="bg-white rounded-lg shadow-md p-6 mb-6">
			<h2 class="text-xl font-semibold mb-4">Daily Order Counts</h2>

			<!-- Bar chart -->
			<div class="h-64 flex items-end space-x-4 mb-6">
				{#each dailyOrders as day}
					<div class="flex flex-col items-center flex-1">
						<div class="w-full flex items-end justify-center">
							<div
								class="bg-blue-500 hover:bg-blue-600 transition-all rounded-t-md w-full max-w-10"
								style="height: {(day.count / maxCount) * 100}%"
							>
								<div class="text-white text-sm font-medium text-center mt-2">
									{day.count}
								</div>
							</div>
						</div>
						<div class="mt-2 text-xs text-center">
							{day.formattedDate.split(',')[0]}
						</div>
					</div>
				{/each}
			</div>

			<!-- Data table -->
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Day</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Date</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Orders Processed</th
							>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each dailyOrders as day}
							<tr>
								<td class="px-6 py-4 whitespace-nowrap">{day.formattedDate.split(',')[0]}</td>
								<td class="px-6 py-4 whitespace-nowrap">{day.formattedDate.split(',')[1]}</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<span
										class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800"
									>
										{day.count}
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Summary statistics -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<div class="bg-white rounded-lg shadow-md p-4">
				<h3 class="text-sm uppercase text-gray-500 mb-1">Total Orders</h3>
				<p class="text-2xl font-bold">{dailyOrders.reduce((sum, day) => sum + day.count, 0)}</p>
			</div>

			<div class="bg-white rounded-lg shadow-md p-4">
				<h3 class="text-sm uppercase text-gray-500 mb-1">Average Per Day</h3>
				<p class="text-2xl font-bold">
					{Math.round(dailyOrders.reduce((sum, day) => sum + day.count, 0) / dailyOrders.length)}
				</p>
			</div>

			<div class="bg-white rounded-lg shadow-md p-4">
				<h3 class="text-sm uppercase text-gray-500 mb-1">Busiest Day</h3>
				{#if dailyOrders.length}
					{@const busiestDay = dailyOrders.reduce(
						(max, day) => (day.count > max.count ? day : max),
						dailyOrders[0]
					)}
					<p class="text-2xl font-bold">
						{busiestDay.formattedDate.split(',')[0]} ({busiestDay.count})
					</p>
				{:else}
					<p class="text-2xl font-bold">-</p>
				{/if}
			</div>
		</div>

		<!-- Profit Stats Collapsible -->
		<div class="mt-6 border rounded-lg overflow-hidden bg-white shadow-md">
			<button
				class="w-full px-6 py-4 bg-gray-50 flex justify-between items-center hover:bg-gray-100 transition-colors"
				on:click={() => (showProfitStats = !showProfitStats)}
			>
				<span class="font-semibold text-gray-700">Profit Analysis (Bottom 50% Performers)</span>
				<span
					class="text-gray-500 transform transition-transform {showProfitStats ? 'rotate-180' : ''}"
				>
					▼
				</span>
			</button>

			{#if showProfitStats}
				<div class="p-6 bg-white border-t">
					{#if profitStats}
						<div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
							<div class="p-4 bg-red-50 rounded-lg">
								<p class="text-sm text-gray-500 uppercase tracking-wide">Orders</p>
								<p class="text-2xl font-bold text-red-700">
									{profitStats.bottom50PercentCount} orders
								</p>
								<p class="text-xs text-gray-500">50% of total volume</p>
							</div>

							<div class="p-4 bg-yellow-50 rounded-lg">
								<p class="text-sm text-gray-500 uppercase tracking-wide">Profit Generated</p>
								<p class="text-2xl font-bold text-yellow-700">
									£{profitStats.bottom50PercentProfit.toFixed(2)}
								</p>
								<p class="text-xs text-gray-500">From bottom 50%</p>
							</div>

							<div class="p-4 bg-blue-50 rounded-lg">
								<p class="text-sm text-gray-500 uppercase tracking-wide">Profit Share</p>
								<p class="text-2xl font-bold text-blue-700">
									{profitStats.bottom50PercentProfitShare.toFixed(1)}%
								</p>
								<p class="text-xs text-gray-500">of total profit</p>
							</div>
						</div>
					{:else}
						<div class="text-center py-4 text-gray-500">
							<p>No profit data available.</p>
							<p class="text-xs mt-2">Debug info: profitStats is null</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{:else}
		<p class="text-center py-8 text-gray-500">No order data available for this date range.</p>
	{/if}
</div>
