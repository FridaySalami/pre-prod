<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	// Type definitions for dynamic counts
	interface CategoryCounts {
		winners?: number;
		secure_winners?: number;
		only_seller?: number;
		out_of_stock?: number;
		losers?: number;
		small_gap_losers?: number;
		opportunities?: number;
		opportunities_high_margin?: number;
		opportunities_low_margin?: number;
		not_profitable?: number;
		match_buybox?: number;
		no_buybox?: number;
		low_margin_sales?: number;
	}

	interface ShippingCounts {
		prime?: number;
		standard?: number;
		oneday?: number;
	}

	export let searchTerm = '';
	export let categoryFilter = 'all';
	export let shippingFilter = 'all';
	export let dateRange = 'all';
	export let minProfitFilter = 0;
	export let minMarginFilter = 0;
	export let showLatestOnly = true;
	export let sortBy = 'created_desc';
	export let hasActiveFilters = false;
	export let filteredCount = 0;
	export let totalCount = 0;
	export let categoryCounts: CategoryCounts = {}; // Dynamic counts from actual data
	export let shippingCounts: ShippingCounts = {}; // Dynamic counts from actual data

	const dispatch = createEventDispatcher();

	// Category options - reorganized for efficient workflow and logical grouping
	$: categories = [
		// === OVERVIEW ===
		{ value: 'all', label: 'All Categories', count: totalCount, group: 'overview' },

		// === WINNING SCENARIOS (what's working well) ===
		{
			value: 'winners',
			label: 'Buy Box Winners',
			count: categoryCounts.winners || 0,
			group: 'winning'
		},
		{
			value: 'secure_winners',
			label: 'Secure Winners (With Competitors)',
			count: categoryCounts.secure_winners || 0,
			group: 'winning'
		},
		{
			value: 'only_seller',
			label: 'Only Seller (No Competitors)',
			count: categoryCounts.only_seller || 0,
			group: 'winning'
		},

		// === STOCK & AVAILABILITY ISSUES (immediate attention needed) ===
		{
			value: 'out_of_stock',
			label: 'Out of Stock (With Pricing)',
			count: categoryCounts.out_of_stock || 0,
			group: 'stock'
		},
		{
			value: 'no_buybox',
			label: 'No Buy Box Available',
			count: categoryCounts.no_buybox || 0,
			group: 'stock'
		},

		// === OPPORTUNITIES (potential wins) ===
		{
			value: 'small_gap_losers',
			label: 'Small Gap Losers (<£0.10)',
			count: categoryCounts.small_gap_losers || 0,
			group: 'opportunities'
		},
		{
			value: 'opportunities_high_margin',
			label: 'Opportunities Margin +10%',
			count: categoryCounts.opportunities_high_margin || 0,
			group: 'opportunities'
		},
		{
			value: 'opportunities_low_margin',
			label: 'Opportunities Under 10% Margin',
			count: categoryCounts.opportunities_low_margin || 0,
			group: 'opportunities'
		},

		// === PROBLEM AREAS (needs investigation) ===
		{
			value: 'losers',
			label: 'Buy Box Losers',
			count: categoryCounts.losers || 0,
			group: 'problems'
		},
		{
			value: 'not_profitable',
			label: 'Not Profitable to match Buy Box',
			count: categoryCounts.not_profitable || 0,
			group: 'problems'
		},
		{
			value: 'low_margin_sales',
			label: 'Low Margin Sales (≤10%)',
			count: categoryCounts.low_margin_sales || 0,
			group: 'problems'
		},

		// === DEPRECATED (keeping for compatibility but hiding) ===
		{
			value: 'match_buybox',
			label: 'Out of Stock - Higher Buy Box Price',
			count: categoryCounts.match_buybox || 0,
			group: 'deprecated',
			hidden: true
		}
	];

	// Shipping options - use dynamic counts from actual data
	$: shippingOptions = [
		{ value: 'all', label: 'All Shipping', count: totalCount },
		{ value: 'prime', label: 'Prime Shipping', count: shippingCounts.prime || 0 },
		{ value: 'standard', label: 'Standard Shipping', count: shippingCounts.standard || 0 },
		{ value: 'oneday', label: 'One Day Shipping', count: shippingCounts.oneday || 0 }
	];

	// Date range options
	const dateRanges = [
		{ value: 'all', label: 'All Dates' },
		{ value: 'today', label: 'Today' },
		{ value: 'yesterday', label: 'Yesterday' },
		{ value: 'week', label: 'This Week' },
		{ value: 'month', label: 'This Month' }
	];

	// Sort options
	const sortOptions = [
		{ value: 'created_desc', label: 'Newest First' },
		{ value: 'created_asc', label: 'Oldest First' },
		{ value: 'profit_desc', label: 'Highest Profit' },
		{ value: 'profit_asc', label: 'Lowest Profit' },
		{ value: 'margin_desc', label: 'Highest Margin' },
		{ value: 'margin_asc', label: 'Lowest Margin' },
		{ value: 'price_gap_asc', label: 'Smallest Price Gap' },
		{ value: 'price_gap_desc', label: 'Largest Price Gap' },
		{ value: 'sku_asc', label: 'SKU A-Z' },
		{ value: 'sku_desc', label: 'SKU Z-A' }
	];

	function handleFilterChange(filterType: string, value: any) {
		dispatch('filterChange', { filterType, value });
	}

	function clearAllFilters() {
		dispatch('clearFilters');
	}

	function handleSearchInput(event: Event) {
		const target = event.target as HTMLInputElement;
		dispatch('filterChange', { filterType: 'searchTerm', value: target.value });
	}
</script>

<!-- Filter Sidebar -->
<div class="w-72 bg-white border-r border-gray-200 h-full overflow-y-auto flex-shrink-0">
	<!-- Header -->
	<div class="p-4 border-b border-gray-200">
		<h2 class="text-lg font-semibold text-gray-900 mb-3">Refine by:</h2>

		<!-- Results Counter -->
		<div
			class="text-sm text-gray-600 mb-3"
			title="Current number of products matching your active filters"
		>
			{filteredCount.toLocaleString()} of {totalCount.toLocaleString()} products
		</div>

		<!-- Search Box -->
		<div class="relative">
			<input
				type="text"
				placeholder="Search products..."
				value={searchTerm}
				on:input={handleSearchInput}
				class="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				title="Search by product name, SKU, ASIN, or any text in the product details"
			/>
			<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
				<svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					/>
				</svg>
			</div>
		</div>

		<!-- Clear All Filters -->
		{#if hasActiveFilters}
			<button
				on:click={clearAllFilters}
				class="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-3 rounded-md transition-colors"
				title="Reset all filters to their default values and show all products"
			>
				Clear All Filters
			</button>
		{/if}
	</div>

	<!-- Category Filter -->
	<div class="p-4 border-b border-gray-200">
		<h3
			class="text-sm font-medium text-gray-900 mb-3"
			title="Filter products by their buy box status and profitability"
		>
			Category
		</h3>
		<div class="space-y-3">
			<!-- Overview -->
			{#each categories.filter((c) => c.group === 'overview') as category}
				<label
					class="flex items-center justify-between py-1 cursor-pointer hover:bg-gray-50 px-2 rounded"
					title="Show all products regardless of category"
				>
					<div class="flex items-center">
						<input
							type="radio"
							name="category"
							value={category.value}
							checked={categoryFilter === category.value}
							on:change={() => handleFilterChange('categoryFilter', category.value)}
							class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
						/>
						<span class="ml-2 text-sm font-medium text-gray-900">{category.label}</span>
					</div>
					<span class="text-xs text-gray-500 font-medium">({category.count})</span>
				</label>
			{/each}

			<!-- Winning Scenarios -->
			<div class="pt-2">
				<div class="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2 px-2">
					Winning Scenarios
				</div>
				{#each categories.filter((c) => c.group === 'winning') as category}
					<label
						class="flex items-center justify-between py-1 cursor-pointer hover:bg-gray-50 px-2 rounded ml-2"
						title={category.value === 'winners'
							? 'Products currently winning the buy box'
							: category.value === 'secure_winners'
								? 'Winning with competitors present - potential to raise prices'
								: category.value === 'only_seller'
									? 'Products with no competing buy box - you have the market to yourself'
									: 'Filter products by this category'}
					>
						<div class="flex items-center">
							<input
								type="radio"
								name="category"
								value={category.value}
								checked={categoryFilter === category.value}
								on:change={() => handleFilterChange('categoryFilter', category.value)}
								class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
							/>
							<span class="ml-2 text-sm text-gray-700">{category.label}</span>
						</div>
						<span class="text-xs text-gray-500">({category.count})</span>
					</label>
				{/each}
			</div>

			<!-- Stock & Availability Issues -->
			<div class="pt-2">
				<div class="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-2 px-2">
					Stock & Availability
				</div>
				{#each categories.filter((c) => c.group === 'stock') as category}
					<label
						class="flex items-center justify-between py-1 cursor-pointer hover:bg-gray-50 px-2 rounded ml-2"
						title={category.value === 'out_of_stock'
							? 'Products out of stock but with pricing data available'
							: category.value === 'no_buybox'
								? 'Products with no competing buy box - you have the market to yourself'
								: 'Filter products by this category'}
					>
						<div class="flex items-center">
							<input
								type="radio"
								name="category"
								value={category.value}
								checked={categoryFilter === category.value}
								on:change={() => handleFilterChange('categoryFilter', category.value)}
								class="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
							/>
							<span class="ml-2 text-sm text-gray-700">{category.label}</span>
						</div>
						<span class="text-xs text-gray-500">({category.count})</span>
					</label>
				{/each}
			</div>

			<!-- Opportunities -->
			<div class="pt-2">
				<div class="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2 px-2">
					Opportunities
				</div>
				{#each categories.filter((c) => c.group === 'opportunities') as category}
					<label
						class="flex items-center justify-between py-1 cursor-pointer hover:bg-gray-50 px-2 rounded ml-2"
						title={category.value === 'small_gap_losers'
							? 'High-priority opportunities - losing by less than £0.10, quick wins with small price adjustments'
							: category.value === 'opportunities_high_margin'
								? 'Profitable opportunities with 10%+ margin if matched'
								: category.value === 'opportunities_low_margin'
									? 'Opportunities with under 10% margin - proceed with caution'
									: 'Filter products by this category'}
					>
						<div class="flex items-center">
							<input
								type="radio"
								name="category"
								value={category.value}
								checked={categoryFilter === category.value}
								on:change={() => handleFilterChange('categoryFilter', category.value)}
								class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
							/>
							<span class="ml-2 text-sm text-gray-700">{category.label}</span>
						</div>
						<span class="text-xs text-gray-500">({category.count})</span>
					</label>
				{/each}
			</div>

			<!-- Problem Areas -->
			<div class="pt-2">
				<div class="text-xs font-semibold text-red-700 uppercase tracking-wider mb-2 px-2">
					Problem Areas
				</div>
				{#each categories.filter((c) => c.group === 'problems') as category}
					<label
						class="flex items-center justify-between py-1 cursor-pointer hover:bg-gray-50 px-2 rounded ml-2"
						title={category.value === 'losers'
							? 'Products not winning the buy box'
							: category.value === 'not_profitable'
								? 'Products that would lose money if matched to buy box price'
								: category.value === 'low_margin_sales'
									? 'Products currently selling with profit margins of 10% or less'
									: 'Filter products by this category'}
					>
						<div class="flex items-center">
							<input
								type="radio"
								name="category"
								value={category.value}
								checked={categoryFilter === category.value}
								on:change={() => handleFilterChange('categoryFilter', category.value)}
								class="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
							/>
							<span class="ml-2 text-sm text-gray-700">{category.label}</span>
						</div>
						<span class="text-xs text-gray-500">({category.count})</span>
					</label>
				{/each}
			</div>
		</div>
	</div>

	<!-- Shipping Filter -->
	<div class="p-4 border-b border-gray-200">
		<h3
			class="text-sm font-medium text-gray-900 mb-3"
			title="Filter by Amazon shipping service type"
		>
			Shipping Service
		</h3>
		<div class="space-y-1">
			{#each shippingOptions as option}
				<label
					class="flex items-center justify-between py-1 cursor-pointer hover:bg-gray-50 px-2 rounded"
					title={option.value === 'all'
						? 'Show products with any shipping service'
						: option.value === 'prime'
							? 'Products with Amazon Prime shipping (faster delivery)'
							: option.value === 'standard'
								? 'Products with standard shipping service'
								: 'Filter by this shipping service'}
				>
					<div class="flex items-center">
						<input
							type="radio"
							name="shipping"
							value={option.value}
							checked={shippingFilter === option.value}
							on:change={() => handleFilterChange('shippingFilter', option.value)}
							class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
						/>
						<span class="ml-2 text-sm text-gray-700">{option.label}</span>
					</div>
					<span class="text-xs text-gray-500">({option.count})</span>
				</label>
			{/each}
		</div>
	</div>

	<!-- Date Range Filter -->
	<div class="p-4 border-b border-gray-200">
		<h3
			class="text-sm font-medium text-gray-900 mb-3"
			title="Filter products by when the pricing data was captured"
		>
			Date Range
		</h3>
		<div class="space-y-1">
			{#each dateRanges as range}
				<label
					class="flex items-center py-1 cursor-pointer hover:bg-gray-50 px-2 rounded"
					title={range.value === 'all'
						? 'Show products from any date'
						: range.value === 'today'
							? 'Show only products captured today'
							: range.value === 'yesterday'
								? 'Show only products captured yesterday'
								: range.value === 'week'
									? 'Show products captured within the last 7 days'
									: range.value === 'month'
										? 'Show products captured within the last 30 days'
										: 'Filter by this date range'}
				>
					<input
						type="radio"
						name="dateRange"
						value={range.value}
						checked={dateRange === range.value}
						on:change={() => handleFilterChange('dateRange', range.value)}
						class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
					/>
					<span class="ml-2 text-sm text-gray-700">{range.label}</span>
				</label>
			{/each}
		</div>
	</div>

	<!-- Profit Filter -->
	<div class="p-4 border-b border-gray-200">
		<h3
			class="text-sm font-medium text-gray-900 mb-3"
			title="Set minimum profit threshold - only show products with potential profit above this amount"
		>
			Minimum Profit
		</h3>
		<div class="space-y-3">
			<div
				title="Drag to set the minimum profit amount you want to see. Products below this threshold will be hidden."
			>
				<input
					type="range"
					min="0"
					max="20"
					step="0.5"
					value={minProfitFilter}
					on:input={(e) =>
						handleFilterChange('minProfitFilter', parseFloat((e.target as HTMLInputElement).value))}
					class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
					title="Set minimum profit threshold: £{minProfitFilter}"
				/>
				<div class="flex justify-between text-xs text-gray-500 mt-1">
					<span>£0</span>
					<span class="font-medium">£{minProfitFilter}</span>
					<span>£20+</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Margin Filter -->
	<div class="p-4 border-b border-gray-200">
		<h3
			class="text-sm font-medium text-gray-900 mb-3"
			title="Set minimum margin percentage - only show products with profit margins above this percentage"
		>
			Minimum Margin
		</h3>
		<div class="space-y-3">
			<div
				title="Drag to set the minimum margin percentage. Products with lower margins will be hidden. Higher margins = more profitable."
			>
				<input
					type="range"
					min="0"
					max="50"
					step="1"
					value={minMarginFilter}
					on:input={(e) =>
						handleFilterChange('minMarginFilter', parseFloat((e.target as HTMLInputElement).value))}
					class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
					title="Set minimum margin percentage: {minMarginFilter}%"
				/>
				<div class="flex justify-between text-xs text-gray-500 mt-1">
					<span>0%</span>
					<span class="font-medium">{minMarginFilter}%</span>
					<span>50%+</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Show Latest Only -->
	<div class="p-4 border-b border-gray-200">
		<label
			class="flex items-center cursor-pointer"
			title="When enabled, only shows the most recent pricing data for each product. When disabled, shows all historical data including older captures."
		>
			<input
				type="checkbox"
				checked={showLatestOnly}
				on:change={(e) =>
					handleFilterChange('showLatestOnly', (e.target as HTMLInputElement).checked)}
				class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
			/>
			<span class="ml-2 text-sm text-gray-700">Show latest data only</span>
		</label>
	</div>

	<!-- Sort Options -->
	<div class="p-4">
		<h3
			class="text-sm font-medium text-gray-900 mb-3"
			title="Choose how to order the product results"
		>
			Sort by
		</h3>
		<select
			value={sortBy}
			on:change={(e) => handleFilterChange('sortBy', (e.target as HTMLSelectElement).value)}
			class="w-full text-sm border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
			title="Select how you want the products to be ordered in the results"
		>
			{#each sortOptions as option}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	</div>
</div>

<style>
	/* Custom range slider styling */
	input[type='range']::-webkit-slider-thumb {
		appearance: none;
		height: 16px;
		width: 16px;
		border-radius: 50%;
		background: #3b82f6;
		cursor: pointer;
		border: 2px solid #ffffff;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	input[type='range']::-moz-range-thumb {
		height: 16px;
		width: 16px;
		border-radius: 50%;
		background: #3b82f6;
		cursor: pointer;
		border: 2px solid #ffffff;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}
</style>
