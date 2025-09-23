<script lang="ts">
	import {
		basketItems,
		basketSummary,
		selectedItems,
		isProcessing,
		basketActions,
		historyItems,
		recentHistory,
		showHistory,
		activeItems
	} from '$lib/stores/pricingBasketStore';
	import { formatCurrency } from '$lib/utils/format';

	// Handle submit changes
	const handleSubmitChanges = async () => {
		if ($selectedItems.size === 0) return;
		await basketActions.submitChanges();
	};

	// Handle delete selected
	const handleDeleteSelected = () => {
		if ($selectedItems.size === 0) return;
		basketActions.deleteSelected();
	};

	// Handle retry failed item
	const handleRetry = (id: string) => {
		basketActions.retryItem(id);
	};

	// Get status color
	const getStatusColor = (status: string) => {
		switch (status) {
			case 'pending':
				return 'text-blue-600 bg-blue-50';
			case 'processing':
				return 'text-yellow-600 bg-yellow-50';
			case 'completed':
				return 'text-green-600 bg-green-50';
			case 'failed':
				return 'text-red-600 bg-red-50';
			case 'cancelled':
				return 'text-gray-600 bg-gray-50';
			default:
				return 'text-gray-600 bg-gray-50';
		}
	};

	// Get price change color
	const getPriceChangeColor = (amount: number) => {
		if (amount < 0) return 'text-red-600'; // Price decrease
		if (amount > 0) return 'text-green-600'; // Price increase
		return 'text-gray-600'; // No change
	};

	// Format price change with sign
	const formatPriceChange = (amount: number) => {
		if (amount === 0) return '£0.00';
		const sign = amount > 0 ? '+' : '';
		return `${sign}${formatCurrency(amount)}`;
	};
</script>

<!-- Persistent Pricing Basket Sidebar -->
<aside class="w-72 bg-white border-l border-gray-200 flex flex-col h-full flex-shrink-0">
	<!-- Header -->
	<div class="p-3 border-b border-gray-200 bg-blue-50">
		<div class="flex items-center justify-between mb-2">
			<h2 class="text-base font-semibold text-blue-900">Pricing Basket</h2>
			<div class="flex gap-1">
				<button
					on:click={() => showHistory.set(false)}
					class="px-2 py-1 text-xs rounded {!$showHistory ? 'bg-blue-600 text-white' : 'text-blue-600 hover:bg-blue-100'}"
				>
					Active
				</button>
				<button
					on:click={() => showHistory.set(true)}
					class="px-2 py-1 text-xs rounded {$showHistory ? 'bg-blue-600 text-white' : 'text-blue-600 hover:bg-blue-100'}"
				>
					History ({$historyItems.length})
				</button>
			</div>
		</div>
		
		{#if !$showHistory}
			<div class="text-xs text-blue-700 space-y-1">
				<div class="flex justify-between">
					<span>Items:</span>
					<span class="font-medium">{$basketSummary.totalItems}</span>
				</div>
				<div class="flex justify-between">
					<span>Pending:</span>
					<span class="font-medium">{$basketSummary.pendingItems}</span>
				</div>
				<div class="flex justify-between">
					<span>Total Change:</span>
					<span class="font-medium {getPriceChangeColor($basketSummary.totalPriceChange)}">
						{formatPriceChange($basketSummary.totalPriceChange)}
					</span>
				</div>
			</div>
		{:else}
			<div class="text-xs text-blue-700 space-y-1">
				<div class="flex justify-between">
					<span>Recent:</span>
					<span class="font-medium">{$recentHistory.length}</span>
				</div>
				<div class="flex justify-between">
					<span>Total History:</span>
					<span class="font-medium">{$historyItems.length}</span>
				</div>
				{#if $historyItems.length > 0}
					<button
						on:click={basketActions.clearHistory}
						class="w-full text-xs px-2 py-1 mt-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
					>
						Clear History
					</button>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Batch Controls - Positioned above pending items -->
	{#if $basketSummary.pendingItems > 0 && !$showHistory}
		<div class="p-3 border-b border-gray-200 bg-gray-50">
			<div class="flex gap-2">
				<button
					on:click={handleSubmitChanges}
					disabled={$selectedItems.size === 0 || $isProcessing}
					class="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{#if $isProcessing}
						Processing...
					{:else}
						Submit Changes ({$selectedItems.size})
					{/if}
				</button>

				<button
					on:click={handleDeleteSelected}
					disabled={$selectedItems.size === 0}
					class="flex-1 bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					Delete Selected ({$selectedItems.size})
				</button>
			</div>

			<!-- Selection Controls -->
			<div class="flex gap-2 mt-2">
				<button
					on:click={basketActions.selectAll}
					class="flex-1 text-blue-600 text-xs px-2 py-1 rounded border border-blue-200 hover:bg-blue-50"
				>
					Select All
				</button>
				<button
					on:click={basketActions.clearSelection}
					class="flex-1 text-gray-600 text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
				>
					Clear Selection
				</button>
			</div>
		</div>
	{/if}

	<!-- Items List -->
	<div class="flex-1 overflow-y-auto">
		{#if !$showHistory}
			<!-- Active Items -->
			{#if $activeItems.length === 0}
				<div class="p-4 text-center text-gray-500">
					<div class="text-2xl mb-2">🛒</div>
					<p class="text-sm">No pricing changes queued</p>
					<p class="text-xs text-gray-400 mt-1">Add items from the buy box analysis</p>
				</div>
			{:else}
				<div class="space-y-2 p-3">
					{#each $activeItems as item (item.id)}
						<div class="bg-gray-50 rounded-lg p-3 border border-gray-200">
							<!-- Item Header -->
							<div class="flex items-start justify-between mb-2">
								<div class="flex items-center gap-2">
									{#if item.status === 'pending'}
										<input
											type="checkbox"
											checked={$selectedItems.has(item.id)}
											on:change={() => basketActions.toggleSelection(item.id)}
											class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
										/>
									{/if}
									<span class="text-xs px-2 py-1 rounded-full {getStatusColor(item.status)}">
										{item.status}
									</span>
								</div>

								<!-- Actions -->
								<div class="flex gap-1">
									{#if item.status === 'failed'}
										<button
											on:click={() => handleRetry(item.id)}
											class="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
										>
											Retry
										</button>
									{/if}
									<button
										on:click={() => basketActions.removeItem(item.id)}
										class="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
									>
										Remove
									</button>
								</div>
							</div>

							<!-- Item Details -->
							<div class="space-y-1">
								<div class="font-medium text-sm text-gray-900 truncate" title={item.itemName}>
									{item.itemName || 'Unknown Item'}
								</div>
								<div class="text-xs text-gray-600">
									SKU: {item.sku} • ASIN: {item.asin}
								</div>

								<!-- Price Changes -->
								<div class="flex justify-between items-center text-sm">
									<span class="text-gray-600">Price:</span>
									<div class="text-right">
										<div class="line-through text-gray-400">{formatCurrency(item.currentPrice)}</div>
										<div class="font-medium">{formatCurrency(item.targetPrice)}</div>
									</div>
								</div>

								<div class="flex justify-between items-center text-sm">
									<span class="text-gray-600">Change:</span>
									<span class="font-medium {getPriceChangeColor(item.priceChangeAmount || 0)}">
										{formatPriceChange(item.priceChangeAmount || 0)}
									</span>
								</div>

								<div class="flex justify-between items-center text-sm">
									<span class="text-gray-600">Margin:</span>
									<span class="font-medium">{(item.marginAtTarget || 0).toFixed(1)}%</span>
								</div>

								<!-- Reason -->
								<div class="text-xs text-gray-500 mt-2 italic">
									{item.reason}
								</div>

								<!-- Error Message -->
								{#if item.errorMessage}
									<div class="text-xs text-red-600 mt-1 bg-red-50 p-2 rounded">
										{item.errorMessage}
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{:else}
			<!-- History Items -->
			{#if $recentHistory.length === 0}
				<div class="p-4 text-center text-gray-500">
					<div class="text-2xl mb-2">📋</div>
					<p class="text-sm">No completed price updates</p>
					<p class="text-xs text-gray-400 mt-1">History will appear here after submissions</p>
				</div>
			{:else}
				<div class="space-y-2 p-3">
					{#each $recentHistory as item (item.id)}
						<div class="bg-gray-50 rounded-lg p-3 border border-gray-200">
							<!-- Item Header -->
							<div class="flex items-start justify-between mb-2">
								<span class="text-xs px-2 py-1 rounded-full {getStatusColor(item.status)}">
									{item.status}
								</span>
								<div class="text-xs text-gray-500">
									{new Date(item.completedAt).toLocaleDateString()} {new Date(item.completedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
								</div>
							</div>

							<!-- Item Details -->
							<div class="space-y-1">
								<div class="font-medium text-sm text-gray-900 truncate" title={item.itemName}>
									{item.itemName || 'Unknown Item'}
								</div>
								<div class="text-xs text-gray-600">
									SKU: {item.sku} • ASIN: {item.asin}
								</div>

								<!-- Price Changes -->
								<div class="flex justify-between items-center text-sm">
									<span class="text-gray-600">Price:</span>
									<div class="text-right">
										<div class="line-through text-gray-400">{formatCurrency(item.currentPrice)}</div>
										<div class="font-medium">{formatCurrency(item.targetPrice)}</div>
									</div>
								</div>

								<div class="flex justify-between items-center text-sm">
									<span class="text-gray-600">Change:</span>
									<span class="font-medium {getPriceChangeColor(item.priceChangeAmount || 0)}">
										{formatPriceChange(item.priceChangeAmount || 0)}
									</span>
								</div>

								{#if item.feedId}
									<div class="text-xs text-gray-500 mt-1">
										Feed ID: {item.feedId}
									</div>
								{/if}

								<!-- Reason -->
								<div class="text-xs text-gray-500 mt-2 italic">
									{item.reason}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>

	<!-- Footer Summary -->
	<div class="p-4 border-t border-gray-200 bg-gray-50">
		{#if !$showHistory}
			<div class="text-xs text-gray-600 space-y-1">
				<div class="flex justify-between">
					<span>Avg Margin:</span>
					<span>{$basketSummary.avgMarginImprovement.toFixed(1)}%</span>
				</div>
				<div class="flex justify-between">
					<span>Est. Time:</span>
					<span>{$basketSummary.estimatedProcessingTime}s</span>
				</div>
			</div>
		{:else}
			<div class="text-xs text-gray-600 space-y-1">
				<div class="flex justify-between">
					<span>Completed:</span>
					<span>{$historyItems.filter(item => item.status === 'completed').length}</span>
				</div>
				<div class="flex justify-between">
					<span>Failed:</span>
					<span>{$historyItems.filter(item => item.status === 'failed').length}</span>
				</div>
			</div>
		{/if}
	</div>
</aside>
