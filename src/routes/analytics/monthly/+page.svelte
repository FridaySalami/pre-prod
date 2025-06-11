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
	/** Available years for the year selector */
	let availableYears: number[] = $state([]);

	// Reactive state updates
	let selectedYear = $state(data.selectedYear);
	let selectedMonth = $state(data.selectedMonth);
	let monthlyData = $state(data.monthlyData ? [data.monthlyData] : []);
	let dailyData: DailyData[] = $state(data.dailyData || []);
	let error = $state(data.error);

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
		selectedYear = data.selectedYear;
		selectedMonth = data.selectedMonth;
		monthlyData = data.monthlyData ? [data.monthlyData] : [];
		dailyData = data.dailyData || [];
		error = data.error;
		// Reset loading state when new data arrives
		if (isLoading) {
			isLoading = false;
		}
	});

	// ===========================================
	// Event Handlers
	// ===========================================

	/**
	 * Handle month/year selection changes
	 * Updates URL and triggers data reload
	 */
	async function handleMonthChange() {
		isLoading = true;
		try {
			// Navigate to the same page with new query parameters
			const url = new URL($page.url);
			url.searchParams.set('year', selectedYear.toString());
			url.searchParams.set('month', selectedMonth.toString());
			await goto(url.toString(), { invalidateAll: true });
		} catch (err) {
			console.error('Error updating month:', err);
		} finally {
			isLoading = false;
		}
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
</svelte:head>

<!-- Wrap the entire component in shadcn-scope to isolate styles -->
<div class="shadcn-scope">
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
				<CardTitle>Select Period</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="flex gap-4 items-end">
					<div class="flex flex-col gap-2">
						<label for="year-select" class="text-sm font-medium">Year:</label>
						<select
							id="year-select"
							bind:value={selectedYear}
							onchange={handleMonthChange}
							class="px-3 py-2 border border-input rounded-md bg-background"
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
							class="px-3 py-2 border border-input rounded-md bg-background"
						>
							{#each Array(12) as _, i}
								<option value={i + 1}>
									{new Date(2024, i, 1).toLocaleString('default', { month: 'long' })}
								</option>
							{/each}
						</select>
					</div>
					<Button 
						on:click={handleMonthChange} 
						disabled={isLoading}
						class="bg-blue-600 hover:bg-blue-700 text-white"
					>
						{isLoading ? 'Loading...' : 'Refresh'}
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
								<TableHead>Date</TableHead>
								<TableHead>Total Sales</TableHead>
								<TableHead>Amazon Sales</TableHead>
								<TableHead>eBay Sales</TableHead>
								<TableHead>Shopify Sales</TableHead>
								<TableHead>Total Orders</TableHead>
								<TableHead>Labor Efficiency</TableHead>
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
										<TableCell>{(day.labor_efficiency || 0).toFixed(2)}</TableCell>
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
</div>
