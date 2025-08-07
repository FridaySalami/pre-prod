<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	// Type definitions for dynamic counts
	interface CategoryCounts {
		winners?: number;
		losers?: number;
		small_gap_losers?: number;
		opportunities?: number;
		not_profitable?: number;
		match_buybox?: number;
		investigate?: number;
	}

	interface ShippingCounts {
		prime?: number;
		standard?: number;
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
	export let activePresetFilter = '';
	export let filteredCount = 0;
	export let totalCount = 0;
	export let categoryCounts: CategoryCounts = {}; // Dynamic counts from actual data
	export let shippingCounts: ShippingCounts = {}; // Dynamic counts from actual data

	const dispatch = createEventDispatcher();

	// Filter presets matching Amazon's style - use dynamic counts
	$: filterPresets = [
		{
			name: 'High Profit Opportunities',
			count: categoryCounts.opportunities || 0,
			filters: { categoryFilter: 'opportunities', minProfitFilter: 2, sortBy: 'profit_desc' }
		},
		{
			name: 'Small Price Gap Losers',
			count: categoryCounts.small_gap_losers || 0,
			filters: { categoryFilter: 'small_gap_losers', sortBy: 'price_gap_asc' }
		},
		{
			name: 'Urgent Price Updates',
			count: categoryCounts.match_buybox || 0,
			filters: { categoryFilter: 'match_buybox', sortBy: 'profit_desc' }
		}
	];

	// Category options - use dynamic counts from actual data
	$: categories = [
		{ value: 'all', label: 'All Categories', count: totalCount },
		{ value: 'winners', label: 'Buy Box Winners', count: categoryCounts.winners || 0 },
		{ value: 'losers', label: 'Buy Box Losers', count: categoryCounts.losers || 0 },
		{
			value: 'small_gap_losers',
			label: 'Small Gap Losers (<£0.10)',
			count: categoryCounts.small_gap_losers || 0
		},
		{ value: 'opportunities', label: 'Opportunities', count: categoryCounts.opportunities || 0 },
		{ value: 'not_profitable', label: 'Not Profitable', count: categoryCounts.not_profitable || 0 },
		{ value: 'match_buybox', label: 'Match Buy Box', count: categoryCounts.match_buybox || 0 },
		{ value: 'investigate', label: 'Investigate', count: categoryCounts.investigate || 0 }
	];

	// Shipping options - use dynamic counts from actual data
	$: shippingOptions = [
		{ value: 'all', label: 'All Shipping', count: totalCount },
		{ value: 'prime', label: 'Prime Shipping', count: shippingCounts.prime || 0 },
		{ value: 'standard', label: 'Standard Shipping', count: shippingCounts.standard || 0 }
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

	function applyPreset(preset: any) {
		dispatch('applyPreset', preset);
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
		<div class="text-sm text-gray-600 mb-3">
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
			>
				Clear All Filters
			</button>
		{/if}
	</div>

	<!-- Quick Actions (Filter Presets) -->
	<div class="p-4 border-b border-gray-200">
		<h3 class="text-sm font-medium text-gray-900 mb-3">Quick Actions</h3>
		<div class="space-y-1">
			{#each filterPresets as preset}
				<label
					class="flex items-center justify-between py-1 cursor-pointer hover:bg-gray-50 px-2 rounded"
				>
					<div class="flex items-center">
						<input
							type="radio"
							name="quickAction"
							value={preset.name}
							checked={activePresetFilter === preset.name}
							on:change={() => applyPreset(preset)}
							class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
						/>
						<span class="ml-2 text-sm text-gray-700">{preset.name}</span>
					</div>
					<span class="text-xs text-gray-500">({preset.count})</span>
				</label>
			{/each}
		</div>
	</div>

	<!-- Category Filter -->
	<div class="p-4 border-b border-gray-200">
		<h3 class="text-sm font-medium text-gray-900 mb-3">Category</h3>
		<div class="space-y-1">
			{#each categories as category}
				<label
					class="flex items-center justify-between py-1 cursor-pointer hover:bg-gray-50 px-2 rounded"
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
	</div>

	<!-- Shipping Filter -->
	<div class="p-4 border-b border-gray-200">
		<h3 class="text-sm font-medium text-gray-900 mb-3">Shipping Service</h3>
		<div class="space-y-1">
			{#each shippingOptions as option}
				<label
					class="flex items-center justify-between py-1 cursor-pointer hover:bg-gray-50 px-2 rounded"
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
		<h3 class="text-sm font-medium text-gray-900 mb-3">Date Range</h3>
		<div class="space-y-1">
			{#each dateRanges as range}
				<label class="flex items-center py-1 cursor-pointer hover:bg-gray-50 px-2 rounded">
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
		<h3 class="text-sm font-medium text-gray-900 mb-3">Minimum Profit</h3>
		<div class="space-y-3">
			<div>
				<input
					type="range"
					min="0"
					max="20"
					step="0.5"
					value={minProfitFilter}
					on:input={(e) =>
						handleFilterChange('minProfitFilter', parseFloat((e.target as HTMLInputElement).value))}
					class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
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
		<h3 class="text-sm font-medium text-gray-900 mb-3">Minimum Margin</h3>
		<div class="space-y-3">
			<div>
				<input
					type="range"
					min="0"
					max="50"
					step="1"
					value={minMarginFilter}
					on:input={(e) =>
						handleFilterChange('minMarginFilter', parseFloat((e.target as HTMLInputElement).value))}
					class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
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
		<label class="flex items-center cursor-pointer">
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
		<h3 class="text-sm font-medium text-gray-900 mb-3">Sort by</h3>
		<select
			value={sortBy}
			on:change={(e) => handleFilterChange('sortBy', (e.target as HTMLSelectElement).value)}
			class="w-full text-sm border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
