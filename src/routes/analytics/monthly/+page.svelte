<!-- Monthly Dashboard Page -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		Card,
		CardHeader,
		CardTitle,
		CardContent,
		Button,
		Table,
		TableHeader,
		TableBody,
		TableRow,
		TableHead,
		TableCell,
		Skeleton
	} from '$lib/shadcn/components';
	import MonthlyChart from '$lib/shadcn/components/ui/MonthlyChart.svelte';
	import MetricsDashboardChart from '$lib/MetricsDashboardChart.svelte';

	// ===========================================
	// Type Definitions
	// ===========================================

	interface DailyData {
		date: string;
		total_sales: number;
		amazon_sales: number;
		ebay_sales: number;
		shopify_sales: number;
		linnworks_total_orders: number;
		labor_efficiency: number;
		actual_hours_worked?: number;
	}

	interface MonthlyMetrics {
		totalSales: number;
		totalOrders: number;
		laborEfficiency: number;
		averageOrderValue: number;
	}

	// ===========================================
	// Component Props & State
	// ===========================================

	let { data } = $props();

	let isLoading = $state(false);
	let toastMessage = $state('');
	let toastType: 'success' | 'error' | '' = $state('');
	let toastVisible = $state(false);

	/** Available years for the year selector */
	let availableYears: number[] = $state([]);

	// Reactive state updates
	let selectedYear = $state(data.selectedYear);
	let selectedMonth = $state(data.selectedMonth);
	let monthlyData = $state(data.monthlyData ? [data.monthlyData] : []);
	let dailyData: DailyData[] = $state(data.dailyData || []);
	let error = $state(data.error);

	// Sorting state
	let sortColumn: keyof DailyData | null = $state(null);
	let sortDirection: 'asc' | 'desc' = $state('asc');

	// ===========================================
	// Lifecycle & Initialization
	// ===========================================

	onMount(() => {
		// Generate years from 2020 to current year + 1
		const currentYear = new Date().getFullYear();
		for (let year = 2020; year <= currentYear + 1; year++) {
			availableYears.push(year);
		}
	});

	// Update state when data prop changes
	$effect(() => {
		console.log('$effect triggered, new data received:', {
			selectedYear: data.selectedYear,
			selectedMonth: data.selectedMonth
		});
		selectedYear = data.selectedYear;
		selectedMonth = data.selectedMonth;
		monthlyData = data.monthlyData ? [data.monthlyData] : [];
		dailyData = data.dailyData || [];
		error = data.error;
		// Only reset loading state after a brief delay to ensure user sees the indicator
		if (isLoading) {
			console.log('Resetting isLoading to false after delay');
			setTimeout(() => {
				isLoading = false;
			}, 500); // Give user time to see the loading state
		}
	});

	// ===========================================
	// Event Handlers
	// ===========================================

	/**
	 * Show toast notification
	 */
	function showToast(message: string, type: 'success' | 'error') {
		toastMessage = message;
		toastType = type;
		toastVisible = true;

		// Auto-hide after 3 seconds
		setTimeout(() => {
			toastVisible = false;
		}, 3000);
	}

	/**
	 * Handle month/year selection changes
	 * Updates URL and triggers data reload
	 */
	async function handleMonthChange() {
		console.log('handleMonthChange called, setting isLoading to true');
		isLoading = true;

		// Add a minimum loading time to ensure user sees the indicator
		const minLoadingTime = new Promise((resolve) => setTimeout(resolve, 800));

		try {
			// Navigate to the same page with new query parameters
			const url = new URL($page.url);
			url.searchParams.set('year', selectedYear.toString());
			url.searchParams.set('month', selectedMonth.toString());

			const navigationPromise = goto(url.toString(), { invalidateAll: true });

			// Wait for both navigation and minimum loading time
			await Promise.all([navigationPromise, minLoadingTime]);

			showToast('Data updated successfully', 'success');
		} catch (err) {
			console.error('Error updating month:', err);
			showToast('Failed to update data', 'error');
		}
		// Note: isLoading will be set to false in the $effect when new data arrives
	}

	/**
	 * Force refresh the current month's data
	 * Adds a timestamp parameter to force cache invalidation
	 */
	async function handleRefresh() {
		console.log('handleRefresh called, setting isLoading to true');
		isLoading = true;

		// Add a minimum loading time to ensure user sees the indicator
		const minLoadingTime = new Promise((resolve) => setTimeout(resolve, 800));

		try {
			// Add a timestamp parameter to force cache invalidation
			const url = new URL($page.url);
			url.searchParams.set('year', selectedYear.toString());
			url.searchParams.set('month', selectedMonth.toString());
			url.searchParams.set('t', Date.now().toString());

			const navigationPromise = goto(url.toString(), { invalidateAll: true });

			// Wait for both navigation and minimum loading time
			await Promise.all([navigationPromise, minLoadingTime]);

			showToast('Data refreshed successfully', 'success');
		} catch (err) {
			console.error('Error refreshing data:', err);
			showToast('Failed to refresh data', 'error');
		}
		// Note: isLoading will be set to false in the $effect when new data arrives
	}

	// ===========================================
	// Utility Functions
	// ===========================================

	/**
	 * Format currency values in British pounds
	 */
	function formatCurrency(amount: number): string {
		return new Intl.NumberFormat('en-GB', {
			style: 'currency',
			currency: 'GBP',
			maximumFractionDigits: 0
		}).format(amount);
	}

	/**
	 * Format numeric values with thousand separators
	 */
	function formatNumber(num: number): string {
		return new Intl.NumberFormat('en-GB').format(Math.round(num));
	}

	/**
	 * Format dates in a readable format
	 */
	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-GB', {
			weekday: 'short',
			day: '2-digit',
			month: 'short'
		});
	}

	/**
	 * Sort daily data by the specified column
	 */
	function sortDailyData(column: keyof DailyData) {
		if (sortColumn === column) {
			// Toggle direction if same column
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			// Set new column and default to ascending
			sortColumn = column;
			sortDirection = 'asc';
		}

		// Sort the data
		dailyData = [...dailyData].sort((a, b) => {
			let aValue = a[column];
			let bValue = b[column];

			// Handle date sorting specially
			if (column === 'date') {
				aValue = new Date(aValue as string).getTime();
				bValue = new Date(bValue as string).getTime();
			}

			// Convert to numbers for numeric columns
			if (typeof aValue === 'string' && column !== 'date') {
				aValue = parseFloat(aValue as string) || 0;
			}
			if (typeof bValue === 'string' && column !== 'date') {
				bValue = parseFloat(bValue as string) || 0;
			}

			// Ensure we're comparing numbers
			const numA = Number(aValue) || 0;
			const numB = Number(bValue) || 0;

			if (sortDirection === 'asc') {
				return numA - numB;
			} else {
				return numB - numA;
			}
		});
	}

	/**
	 * Get formatted month name with year
	 */
	function getMonthName(month: number, year: number): string {
		return new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
			month: 'long',
			year: 'numeric'
		});
	}

	// ===========================================
	// Computed Values
	// ===========================================

	/** Check if we have any meaningful data to display */
	const hasData = $derived(
		dailyData.length > 0 || (monthlyData.length > 0 && monthlyData[0]?.totalSales > 0)
	);
</script>

<svelte:head>
	<title>Monthly Analytics Dashboard</title>
	<style>
		@keyframes loading-bar {
			0% {
				width: 0%;
			}
			50% {
				width: 70%;
			}
			100% {
				width: 100%;
			}
		}
	</style>
</svelte:head>

<!-- Wrap the entire component in shadcn-scope to isolate styles -->
<div class="shadcn-scope">
	<!-- Progress Bar -->
	{#if isLoading}
		<div class="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-200">
			<div
				class="h-full bg-blue-600 animate-pulse duration-1000"
				style="animation: loading-bar 2s infinite;"
			></div>
		</div>
	{/if}

	<!-- Global Loading Overlay for improved UX -->
	{#if isLoading}
		<div
			class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center"
		>
			<div class="flex flex-col items-center gap-3 bg-card p-6 rounded-lg shadow-lg border">
				<svg
					class="animate-spin h-8 w-8 text-blue-600"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
				>
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
				<div class="text-sm font-medium text-foreground">Loading analytics data...</div>
				<div class="text-xs text-muted-foreground">Please wait while we fetch your data</div>
			</div>
		</div>
	{/if}

	<div class="container mx-auto p-6 space-y-6">
		<!-- Header -->
		<div class="flex justify-between items-center">
			<div>
				<h1 class="text-3xl font-bold tracking-tight">Monthly Analytics</h1>
				<p class="text-muted-foreground">Monthly performance metrics and business insights</p>
			</div>
		</div>

		<!-- Month/Year Selector -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					Select Period
					{#if isLoading}
						<svg
							class="animate-spin h-4 w-4 text-blue-600"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						<span class="text-sm font-normal text-blue-600">Loading data...</span>
					{/if}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="flex gap-4 items-end">
					<div class="flex flex-col gap-2">
						<label for="year-select" class="text-sm font-medium">Year:</label>
						<select
							id="year-select"
							bind:value={selectedYear}
							onchange={handleMonthChange}
							disabled={isLoading}
							class="px-3 py-2 border border-input rounded-md bg-background disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{#each availableYears as year}
								<option value={year}>{year}</option>
							{/each}
						</select>
					</div>
					<div class="flex flex-col gap-2">
						<label for="month-select" class="text-sm font-medium">Month:</label>
						<select
							id="month-select"
							bind:value={selectedMonth}
							onchange={handleMonthChange}
							disabled={isLoading}
							class="px-3 py-2 border border-input rounded-md bg-background disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{#each Array(12) as _, i}
								<option value={i + 1}>
									{new Date(2024, i, 1).toLocaleString('default', { month: 'long' })}
								</option>
							{/each}
						</select>
					</div>
					<Button
						onclick={handleRefresh}
						disabled={isLoading}
						class="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
					>
						{#if isLoading}
							<svg
								class="animate-spin h-4 w-4"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
							>
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
							Loading...
						{:else}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
								/>
							</svg>
							Refresh
						{/if}
					</Button>
				</div>
			</CardContent>
		</Card>

		{#if error}
			<Card class="border-destructive">
				<CardContent class="pt-6">
					<p class="text-destructive">Error: {error}</p>
				</CardContent>
			</Card>
		{/if}

		{#if isLoading}
			<!-- Loading Skeletons -->
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{#each Array(4) as _}
					<Card>
						<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
							<Skeleton class="h-4 w-[100px]" />
							<Skeleton class="h-4 w-4" />
						</CardHeader>
						<CardContent>
							<Skeleton class="h-8 w-[120px] mb-2" />
							<Skeleton class="h-3 w-[80px]" />
						</CardContent>
					</Card>
				{/each}
			</div>

			<div class="grid gap-4 md:grid-cols-2">
				<Card>
					<CardHeader>
						<Skeleton class="h-6 w-[150px]" />
					</CardHeader>
					<CardContent>
						<div class="space-y-4">
							{#each Array(3) as _}
								<div class="flex items-center justify-between">
									<div class="flex items-center space-x-2">
										<Skeleton class="w-3 h-3 rounded-full" />
										<Skeleton class="h-4 w-[60px]" />
									</div>
									<Skeleton class="h-4 w-[80px]" />
								</div>
							{/each}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<Skeleton class="h-6 w-[180px]" />
					</CardHeader>
					<CardContent>
						<div class="space-y-4">
							{#each Array(3) as _}
								<div class="space-y-2">
									<div class="flex justify-between text-sm">
										<Skeleton class="h-4 w-[60px]" />
										<Skeleton class="h-4 w-[40px]" />
									</div>
									<Skeleton class="w-full h-2 rounded-full" />
								</div>
							{/each}
						</div>
					</CardContent>
				</Card>
			</div>
		{:else if monthlyData.length === 0}
			<Card>
				<CardContent class="pt-6">
					<p class="text-muted-foreground text-center py-8">
						No data available for {new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString(
							'en-GB',
							{ month: 'long', year: 'numeric' }
						)}
					</p>
				</CardContent>
			</Card>
		{:else}
			<!-- KPI Cards -->
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{#each monthlyData as data}
					<Card>
						<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle class="text-sm font-medium">Total Sales</CardTitle>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								class="h-4 w-4 text-muted-foreground"
							>
								<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
							</svg>
						</CardHeader>
						<CardContent>
							<div class="text-2xl font-bold">{formatCurrency(data.totalSales)}</div>
							<p class="text-xs text-muted-foreground">Monthly revenue</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle class="text-sm font-medium">Total Orders</CardTitle>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								class="h-4 w-4 text-muted-foreground"
							>
								<rect width="20" height="14" x="2" y="5" rx="2" />
								<path d="M2 10h20" />
							</svg>
						</CardHeader>
						<CardContent>
							<div class="text-2xl font-bold">{formatNumber(data.totalOrders)}</div>
							<p class="text-xs text-muted-foreground">Orders processed</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle class="text-sm font-medium">Labor Efficiency</CardTitle>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								class="h-4 w-4 text-muted-foreground"
							>
								<path d="M22 12h-4l-3 9L9 3l-3 9H2" />
							</svg>
						</CardHeader>
						<CardContent>
							<div class="text-2xl font-bold">{data.laborEfficiency.toFixed(2)}</div>
							<p class="text-xs text-muted-foreground">Avg shipments/hour</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle class="text-sm font-medium">Average Order Value</CardTitle>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								class="h-4 w-4 text-muted-foreground"
							>
								<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
								<circle cx="9" cy="7" r="4" />
								<path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
							</svg>
						</CardHeader>
						<CardContent>
							<div class="text-2xl font-bold">
								{formatCurrency(data.totalOrders > 0 ? data.totalSales / data.totalOrders : 0)}
							</div>
							<p class="text-xs text-muted-foreground">Per order</p>
						</CardContent>
					</Card>
				{/each}
			</div>

			<!-- Daily Sales Chart -->
			{#if dailyData.length > 0}
				<MetricsDashboardChart data={dailyData} title="Daily Sales Visualization" class="w-full" />
			{/if}

			<!-- Daily Breakdown Table -->
			<Card>
				<CardHeader>
					<CardTitle>Daily Breakdown</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead class="p-0">
									<button 
										class="flex items-center w-full p-3 cursor-pointer hover:bg-muted/50 transition-colors border-none bg-transparent text-left"
										onclick={() => sortDailyData('date')}
									>
										Date
										{#if sortColumn === 'date'}
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-4 w-4 inline-block ml-1"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												{#if sortDirection === 'asc'}
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
												{:else}
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
												{/if}
											</svg>
										{/if}
									</button>
								</TableHead>
								<TableHead class="p-0">
									<button 
										class="flex items-center w-full p-3 cursor-pointer hover:bg-muted/50 transition-colors border-none bg-transparent text-left"
										onclick={() => sortDailyData('total_sales')}
									>
										Total Sales
										{#if sortColumn === 'total_sales'}
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-4 w-4 inline-block ml-1"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												{#if sortDirection === 'asc'}
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
												{:else}
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
												{/if}
											</svg>
										{/if}
									</button>
								</TableHead>
								<TableHead class="p-0">
									<button 
										class="flex items-center w-full p-3 cursor-pointer hover:bg-muted/50 transition-colors border-none bg-transparent text-left"
										onclick={() => sortDailyData('amazon_sales')}
									>
										Amazon Sales
										{#if sortColumn === 'amazon_sales'}
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-4 w-4 inline-block ml-1"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												{#if sortDirection === 'asc'}
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
												{:else}
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
												{/if}
											</svg>
										{/if}
									</button>
								</TableHead>
								<TableHead class="p-0">
									<button 
										class="flex items-center w-full p-3 cursor-pointer hover:bg-muted/50 transition-colors border-none bg-transparent text-left"
										onclick={() => sortDailyData('ebay_sales')}
									>
										eBay Sales
										{#if sortColumn === 'ebay_sales'}
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-4 w-4 inline-block ml-1"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												{#if sortDirection === 'asc'}
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
												{:else}
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
												{/if}
											</svg>
										{/if}
									</button>
								</TableHead>
								<TableHead class="p-0">
									<button 
										class="flex items-center w-full p-3 cursor-pointer hover:bg-muted/50 transition-colors border-none bg-transparent text-left"
										onclick={() => sortDailyData('shopify_sales')}
									>
										Shopify Sales
										{#if sortColumn === 'shopify_sales'}
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-4 w-4 inline-block ml-1"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												{#if sortDirection === 'asc'}
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
												{:else}
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
												{/if}
											</svg>
										{/if}
									</button>
								</TableHead>
								<TableHead class="p-0">
									<button 
										class="flex items-center w-full p-3 cursor-pointer hover:bg-muted/50 transition-colors border-none bg-transparent text-left"
										onclick={() => sortDailyData('linnworks_total_orders')}
									>
										Total Orders
										{#if sortColumn === 'linnworks_total_orders'}
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-4 w-4 inline-block ml-1"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												{#if sortDirection === 'asc'}
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
												{:else}
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
												{/if}
											</svg>
										{/if}
									</button>
								</TableHead>
								<TableHead class="p-0">
									<button 
										class="flex items-center w-full p-3 cursor-pointer hover:bg-muted/50 transition-colors border-none bg-transparent text-left"
										onclick={() => sortDailyData('labor_efficiency')}
									>
										Labor Efficiency
										{#if sortColumn === 'labor_efficiency'}
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="h-4 w-4 inline-block ml-1"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												{#if sortDirection === 'asc'}
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
												{:else}
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
												{/if}
											</svg>
										{/if}
									</button>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#if dailyData.length > 0}
								{#each dailyData as day}
									<TableRow>
										<TableCell>{formatDate(day.date)}</TableCell>
										<TableCell>{formatCurrency(day.total_sales || 0)}</TableCell>
										<TableCell>{formatCurrency(day.amazon_sales || 0)}</TableCell>
										<TableCell>{formatCurrency(day.ebay_sales || 0)}</TableCell>
										<TableCell>{formatCurrency(day.shopify_sales || 0)}</TableCell>
										<TableCell>{formatNumber(day.linnworks_total_orders || 0)}</TableCell>
										<TableCell>{(day.labor_efficiency || 0).toFixed(1)}</TableCell>
									</TableRow>
								{/each}
							{:else}
								<TableRow>
									<TableCell colspan="7" class="text-center text-muted-foreground py-8">
										No daily data available for this month
									</TableCell>
								</TableRow>
							{/if}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		{/if}
	</div>

	<!-- Toast Notification -->
	{#if toastVisible}
		<div
			class="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 duration-300"
			class:bg-green-50={toastType === 'success'}
			class:border-green-200={toastType === 'success'}
			class:text-green-800={toastType === 'success'}
			class:bg-red-50={toastType === 'error'}
			class:border-red-200={toastType === 'error'}
			class:text-red-800={toastType === 'error'}
		>
			<div class="flex items-center gap-3 p-4 border rounded-lg shadow-lg bg-card">
				{#if toastType === 'success'}
					<svg class="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 13l4 4L19 7"
						/>
					</svg>
				{:else}
					<svg class="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				{/if}
				<span class="text-sm font-medium">{toastMessage}</span>
				<button
					onclick={() => (toastVisible = false)}
					class="ml-2 text-gray-400 hover:text-gray-600"
					aria-label="Close notification"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>
		</div>
	{/if}
</div>
