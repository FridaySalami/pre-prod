<script lang="ts">
	import {
		basketItems,
		basketOpen,
		basketSummary,
		selectedItems,
		isProcessing,
		shortEmail,
		basketActions,
		type BasketItem
	} from '$lib/stores/pricingBasketStore';

	let editingItem: string | null = null;
	let editValues: { targetPrice: number; reason: string } = { targetPrice: 0, reason: '' };

	$: pendingItems = $basketItems.filter((item) => item.status === 'pending');
	$: processingItems = $basketItems.filter((item) => item.status === 'processing');
	$: completedItems = $basketItems.filter((item) => item.status === 'completed');
	$: failedItems = $basketItems.filter((item) => item.status === 'failed');

	function toggleBasket() {
		basketActions.toggleBasket();
	}

	function startEdit(item: BasketItem) {
		editingItem = item.id;
		editValues = {
			targetPrice: item.targetPrice,
			reason: item.reason
		};
	}

	function saveEdit() {
		if (editingItem) {
			basketActions.updateItem(editingItem, editValues);
			editingItem = null;
		}
	}

	function cancelEdit() {
		editingItem = null;
		editValues = { targetPrice: 0, reason: '' };
	}

	function formatCurrency(amount: number): string {
		return `£${amount.toFixed(2)}`;
	}

	function getStatusBadge(status: BasketItem['status']) {
		const badges = {
			pending: { class: 'bg-yellow-100 text-yellow-800', text: '⏳ Pending', icon: '⏳' },
			processing: { class: 'bg-blue-100 text-blue-800', text: '⚡ Processing', icon: '⚡' },
			completed: { class: 'bg-green-100 text-green-800', text: '✅ Completed', icon: '✅' },
			failed: { class: 'bg-red-100 text-red-800', text: '❌ Failed', icon: '❌' },
			cancelled: { class: 'bg-gray-100 text-gray-800', text: '🚫 Cancelled', icon: '🚫' }
		};
		return badges[status];
	}

	function formatTimeAgo(date: Date): string {
		const now = new Date();
		const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

		if (diffInSeconds < 60) return 'Just now';
		if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
		if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
		return `${Math.floor(diffInSeconds / 86400)}d ago`;
	}
</script>

<!-- Pricing Basket Sidebar -->
<div
	class="fixed right-0 top-0 h-full w-96 bg-amber-50 border-l border-amber-200 shadow-xl z-40 transform transition-transform duration-300 flex flex-col"
	class:translate-x-0={$basketOpen}
	class:translate-x-full={!$basketOpen}
>
	<!-- Header -->
	<div class="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-4 shadow-lg">
		<div class="flex items-center justify-between mb-3">
			<div class="flex items-center gap-2">
				<div class="bg-white bg-opacity-20 rounded-full p-1.5">
					<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
						<path
							d="M7 4V2a1 1 0 0 1 2 0v2h6V2a1 1 0 0 1 2 0v2h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4zm13 4H4v10h16V8zM6 12h2v2H6v-2zm8 0h2v2h-2v-2zm-4 0h2v2h-2v-2z"
						/>
					</svg>
				</div>
				<div>
					<h2 class="text-lg font-bold">Pricing Basket</h2>
					<p class="text-amber-100 text-sm">Batch pricing updates</p>
				</div>
			</div>
			<button
				on:click={toggleBasket}
				class="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1.5 transition-colors"
				title="Toggle basket"
				aria-label="Close pricing basket"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Summary Stats -->
		<div class="bg-white bg-opacity-10 rounded-lg p-3">
			<div class="grid grid-cols-2 gap-3 text-center text-sm">
				<div>
					<div class="text-amber-100">Items</div>
					<div class="font-medium">{$basketSummary.totalItems}</div>
				</div>
				<div>
					<div class="text-amber-100">Potential</div>
					<div class="font-medium text-green-200">
						+{formatCurrency($basketSummary.totalPotentialProfit)}
					</div>
				</div>
			</div>
			<div class="text-center mt-2">
				<div class="text-amber-100 text-xs">User: {$shortEmail}</div>
			</div>
		</div>
	</div>

	<!-- Action Bar -->
	{#if pendingItems.length > 0}
		<div class="bg-amber-100 border-b border-amber-200 p-3">
			<div class="flex items-center justify-between text-sm">
				<span class="text-amber-800">
					{$selectedItems.size} of {pendingItems.length} selected
				</span>
				<div class="flex gap-2">
					<button
						on:click={basketActions.selectAll}
						class="text-amber-700 hover:text-amber-900 underline text-xs"
					>
						All
					</button>
					<button
						on:click={basketActions.clearSelection}
						class="text-amber-700 hover:text-amber-900 underline text-xs"
					>
						None
					</button>
				</div>
			</div>
			{#if $selectedItems.size > 0}
				<div class="flex gap-2 mt-2">
					<button
						on:click={basketActions.processSelected}
						disabled={$isProcessing}
						class="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1 flex-1"
					>
						{#if $isProcessing}
							<div
								class="animate-spin w-3 h-3 border border-white border-t-transparent rounded-full"
							></div>
							Processing...
						{:else}
							⚡ Process ({$selectedItems.size})
						{/if}
					</button>
					<button
						on:click={basketActions.clearBasket}
						class="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
						title="Clear all items"
					>
						🗑️
					</button>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Content -->
	<div class="flex-1 overflow-hidden flex flex-col">
		{#if $basketItems.length === 0}
			<!-- Empty State -->
			<div class="flex-1 flex items-center justify-center p-6">
				<div class="text-center">
					<div
						class="w-16 h-16 mx-auto mb-3 bg-amber-200 rounded-full flex items-center justify-center"
					>
						<svg
							class="w-8 h-8 text-amber-600"
							fill="none"
							stroke="currentColor"
							stroke-width="1.5"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119.993z"
							/>
						</svg>
					</div>
					<h3 class="text-base font-medium text-amber-800 mb-2">Basket Empty</h3>
					<p class="text-amber-600 text-sm">Add items from the product table</p>
				</div>
			</div>
		{:else}
			<!-- Items List -->
			<div class="flex-1 overflow-y-auto">
				<!-- Pending Items -->
				{#if pendingItems.length > 0}
					<div class="p-3 border-b border-amber-200">
						<h3 class="text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
							<span class="bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded text-xs"
								>⏳ Pending ({pendingItems.length})</span
							>
						</h3>
						<div class="space-y-2">
							{#each pendingItems as item (item.id)}
								<div
									class="bg-white border border-amber-200 rounded-lg p-3 hover:shadow-sm transition-shadow"
								>
									<div class="flex items-start gap-2">
										<!-- Checkbox -->
										<input
											type="checkbox"
											checked={$selectedItems.has(item.id)}
											on:change={() => basketActions.toggleSelection(item.id)}
											class="mt-1 rounded border-amber-300 text-amber-600 focus:ring-amber-500 scale-90"
										/>

										<!-- Content -->
										<div class="flex-1 min-w-0">
											{#if editingItem === item.id}
												<!-- Edit Mode -->
												<div class="space-y-2">
													<div>
														<label
															for="edit-target-price-{item.id}"
															class="block text-xs font-medium text-gray-700 mb-1"
														>Target Price</label>
														<input
															id="edit-target-price-{item.id}"
															type="number"
															step="0.01"
															bind:value={editValues.targetPrice}
															class="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
														/>
													</div>
													<div>
														<label
															for="edit-reason-{item.id}"
															class="block text-xs font-medium text-gray-700 mb-1"
														>Reason</label>
														<input
															id="edit-reason-{item.id}"
															type="text"
															bind:value={editValues.reason}
															class="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
														/>
													</div>
													<div class="flex gap-1">
														<button
															on:click={saveEdit}
															class="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs"
														>
															Save
														</button>
														<button
															on:click={cancelEdit}
															class="bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded text-xs"
														>
															Cancel
														</button>
													</div>
												</div>
											{:else}
												<!-- Display Mode -->
												{@const badge = getStatusBadge(item.status)}
												<div class="flex items-start justify-between">
													<div class="flex-1">
														<div class="flex items-center gap-2 mb-1">
															<h4 class="font-medium text-gray-900 text-sm">{item.sku}</h4>
															<span
																class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium {badge.class}"
															>
																{badge.icon}
															</span>
														</div>
														{#if item.itemName}
															<p class="text-xs text-gray-600 mb-1 leading-tight">
																{item.itemName}
															</p>
														{/if}
														<div class="grid grid-cols-2 gap-2 text-xs">
															<div>
																<span class="text-gray-500">Current:</span>
																<span class="font-medium">{formatCurrency(item.currentPrice)}</span>
															</div>
															<div>
																<span class="text-gray-500">Target:</span>
																<span class="font-medium text-blue-600"
																	>{formatCurrency(item.targetPrice)}</span
																>
															</div>
															{#if item.profitAtTarget}
																<div class="col-span-2">
																	<span class="text-gray-500">Profit:</span>
																	<span class="font-medium text-green-600"
																		>+{formatCurrency(item.profitAtTarget)}</span
																	>
																	{#if item.marginAtTarget}
																		<span class="text-gray-500 ml-2"
																			>({item.marginAtTarget.toFixed(1)}%)</span
																		>
																	{/if}
																</div>
															{/if}
														</div>
														<p class="text-xs text-gray-500 mt-1 leading-tight">
															{item.reason}
														</p>
														<p class="text-xs text-gray-400 mt-1">
															{formatTimeAgo(item.createdAt)}
														</p>
													</div>

													<!-- Actions -->
													<div class="flex flex-col gap-1 ml-2">
														<button
															on:click={() => startEdit(item)}
															class="text-blue-600 hover:text-blue-800 text-xs underline"
														>
															Edit
														</button>
														<button
															on:click={() => basketActions.removeItem(item.id)}
															class="text-red-600 hover:text-red-800 text-xs underline"
														>
															Remove
														</button>
													</div>
												</div>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Processing Items -->
				{#if processingItems.length > 0}
					<div class="p-3 border-b border-amber-200">
						<h3 class="text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
							<span class="bg-blue-200 text-blue-800 px-2 py-0.5 rounded text-xs"
								>⚡ Processing ({processingItems.length})</span
							>
						</h3>
						<div class="space-y-2">
							{#each processingItems as item (item.id)}
								<div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
									<div class="flex items-center gap-2">
										<div
											class="animate-spin w-3 h-3 border border-blue-600 border-t-transparent rounded-full"
										></div>
										<div class="flex-1">
											<div class="font-medium text-gray-900 text-sm">{item.sku}</div>
											<div class="text-xs text-blue-600">→ {formatCurrency(item.targetPrice)}</div>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Completed Items -->
				{#if completedItems.length > 0}
					<div class="p-3 border-b border-amber-200">
						<h3 class="text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
							<span class="bg-green-200 text-green-800 px-2 py-0.5 rounded text-xs"
								>✅ Completed ({completedItems.length})</span
							>
						</h3>
						<div class="space-y-1">
							{#each completedItems as item (item.id)}
								<div class="bg-green-50 border border-green-200 rounded-lg p-2">
									<div class="flex items-center justify-between">
										<div>
											<div class="font-medium text-gray-900 text-sm">{item.sku}</div>
											<div class="text-xs text-green-600">
												Updated to {formatCurrency(item.targetPrice)}
											</div>
										</div>
										<div class="text-green-600">
											<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
												<path
													fill-rule="evenodd"
													d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
													clip-rule="evenodd"
												/>
											</svg>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Failed Items -->
				{#if failedItems.length > 0}
					<div class="p-3">
						<h3 class="text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
							<span class="bg-red-200 text-red-800 px-2 py-0.5 rounded text-xs"
								>❌ Failed ({failedItems.length})</span
							>
						</h3>
						<div class="space-y-2">
							{#each failedItems as item (item.id)}
								<div class="bg-red-50 border border-red-200 rounded-lg p-3">
									<div class="flex items-start justify-between">
										<div class="flex-1">
											<div class="font-medium text-gray-900 text-sm">{item.sku}</div>
											<div class="text-xs text-red-600 mb-1">
												Failed: {formatCurrency(item.targetPrice)}
											</div>
											{#if item.errorMessage}
												<div class="text-xs text-red-500 bg-red-100 rounded p-1.5">
													{item.errorMessage}
												</div>
											{/if}
										</div>
										<div class="flex flex-col gap-1 ml-2">
											<button
												on:click={() => basketActions.updateItem(item.id, { status: 'pending' })}
												class="text-blue-600 hover:text-blue-800 text-xs underline"
											>
												Retry
											</button>
											<button
												on:click={() => basketActions.removeItem(item.id)}
												class="text-red-600 hover:text-red-800 text-xs underline"
											>
												Remove
											</button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
<!-- Modal Backdrop -->
{#if $basketOpen}
	<div
		class="fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity duration-300"
		on:click={toggleBasket}
		on:keydown={(e) => e.key === 'Escape' && toggleBasket()}
		role="button"
		tabindex="0"
	></div>

	<!-- Modal Content -->
	<div
		class="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 transform transition-transform duration-300 flex flex-col"
		on:click|stopPropagation
		on:keydown={(e) => e.key === 'Escape' && toggleBasket()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="basket-title"
		tabindex="-1"
	>
		<!-- Header -->
		<div class="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 shadow-lg">
			<div class="flex items-center justify-between mb-4">
				<div class="flex items-center gap-3">
					<div class="bg-white bg-opacity-20 rounded-full p-2">
						<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
							<path
								d="M7 4V2a1 1 0 0 1 2 0v2h6V2a1 1 0 0 1 2 0v2h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4zm13 4H4v10h16V8zM6 12h2v2H6v-2zm8 0h2v2h-2v-2zm-4 0h2v2h-2v-2z"
							/>
						</svg>
					</div>
					<div>
						<h2 id="basket-title" class="text-2xl font-bold">Pricing Basket</h2>
						<p class="text-blue-100">Queue pricing updates for batch processing</p>
					</div>
				</div>
				<button
					on:click={toggleBasket}
					class="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
					aria-label="Close basket"
				>
					<svg
						class="w-6 h-6"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- User & Summary Info -->
			<div class="bg-white bg-opacity-10 rounded-lg p-4">
				<div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
					<div>
						<div class="text-sm text-blue-100">User</div>
						<div class="font-medium">{$shortEmail}</div>
					</div>
					<div>
						<div class="text-sm text-blue-100">Items</div>
						<div class="font-medium">{$basketSummary.totalItems}</div>
					</div>
					<div>
						<div class="text-sm text-blue-100">Potential Profit</div>
						<div class="font-medium text-green-200">
							+{formatCurrency($basketSummary.totalPotentialProfit)}
						</div>
					</div>
					<div>
						<div class="text-sm text-blue-100">Est. Time</div>
						<div class="font-medium">{$basketSummary.estimatedProcessingTime}s</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Action Bar -->
		{#if pendingItems.length > 0}
			<div class="bg-gray-50 border-b border-gray-200 p-4">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-4">
						<span class="text-sm text-gray-600">
							{$selectedItems.size} of {pendingItems.length} selected
						</span>
						<div class="flex gap-2">
							<button
								on:click={basketActions.selectAll}
								class="text-blue-600 hover:text-blue-800 text-sm underline"
							>
								Select all pending
							</button>
							<button
								on:click={basketActions.clearSelection}
								class="text-gray-600 hover:text-gray-800 text-sm underline"
							>
								Clear selection
							</button>
						</div>
					</div>
					<div class="flex gap-2">
						{#if $selectedItems.size > 0}
							<button
								on:click={basketActions.processSelected}
								disabled={$isProcessing}
								class="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
							>
								{#if $isProcessing}
									<div
										class="animate-spin w-4 h-4 border border-white border-t-transparent rounded-full"
									></div>
									Processing...
								{:else}
									<span>⚡</span>
									Process Selected ({$selectedItems.size})
								{/if}
							</button>
						{/if}
						<button
							on:click={basketActions.clearBasket}
							class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
						>
							🗑️ Clear All
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Content -->
		<div class="flex-1 overflow-hidden flex flex-col">
			{#if $basketItems.length === 0}
				<!-- Empty State -->
				<div class="flex-1 flex items-center justify-center p-8">
					<div class="text-center">
						<div
							class="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center"
						>
							<svg
								class="w-12 h-12 text-gray-400"
								fill="none"
								stroke="currentColor"
								stroke-width="1.5"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119.993z"
								/>
							</svg>
						</div>
						<h3 class="text-lg font-medium text-gray-900 mb-2">Your basket is empty</h3>
						<p class="text-gray-500 mb-4">
							Add pricing updates from the Buy Box Manager to get started
						</p>
						<button
							on:click={toggleBasket}
							class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
						>
							Browse Products
						</button>
					</div>
				</div>
			{:else}
				<!-- Items List -->
				<div class="flex-1 overflow-y-auto">
					<!-- Pending Items -->
					{#if pendingItems.length > 0}
						<div class="p-4 border-b border-gray-200">
							<h3 class="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
								<span class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm"
									>⏳ Pending ({pendingItems.length})</span
								>
							</h3>
							<div class="space-y-3">
								{#each pendingItems as item (item.id)}
									<div
										class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
									>
										<div class="flex items-start gap-3">
											<!-- Checkbox -->
											<input
												type="checkbox"
												checked={$selectedItems.has(item.id)}
												on:change={() => basketActions.toggleSelection(item.id)}
												class="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
											/>

											<!-- Content -->
											<div class="flex-1 min-w-0">
												{#if editingItem === item.id}
													<!-- Edit Mode -->
													<div class="space-y-3">
														<div>
															<label
																for="modal-target-price-{item.id}"
																class="block text-sm font-medium text-gray-700 mb-1"
															>Target Price</label>
															<input
																id="modal-target-price-{item.id}"
																type="number"
																step="0.01"
																bind:value={editValues.targetPrice}
																class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
															/>
														</div>
														<div>
															<label
																for="modal-reason-{item.id}"
																class="block text-sm font-medium text-gray-700 mb-1"
															>Reason</label>
															<input
																id="modal-reason-{item.id}"
																type="text"
																bind:value={editValues.reason}
																class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
															/>
														</div>
														<div class="flex gap-2">
															<button
																on:click={saveEdit}
																class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
															>
																Save
															</button>
															<button
																on:click={cancelEdit}
																class="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm"
															>
																Cancel
															</button>
														</div>
													</div>
												{:else}
													<!-- Display Mode -->
													{@const badge = getStatusBadge(item.status)}
													<div class="flex items-start justify-between">
														<div class="flex-1">
															<div class="flex items-center gap-2 mb-1">
																<h4 class="font-medium text-gray-900">{item.sku}</h4>
																<span class="text-xs text-gray-500">({item.asin})</span>
																<span
																	class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {badge.class}"
																>
																	{badge.text}
																</span>
															</div>
															{#if item.itemName}
																<p class="text-sm text-gray-600 mb-2">{item.itemName}</p>
															{/if}
															<div class="grid grid-cols-2 gap-4 text-sm">
																<div>
																	<span class="text-gray-500">Current:</span>
																	<span class="font-medium"
																		>{formatCurrency(item.currentPrice)}</span
																	>
																</div>
																<div>
																	<span class="text-gray-500">Target:</span>
																	<span class="font-medium text-blue-600"
																		>{formatCurrency(item.targetPrice)}</span
																	>
																</div>
																{#if item.profitAtTarget}
																	<div>
																		<span class="text-gray-500">Profit:</span>
																		<span class="font-medium text-green-600"
																			>+{formatCurrency(item.profitAtTarget)}</span
																		>
																	</div>
																{/if}
																{#if item.marginAtTarget}
																	<div>
																		<span class="text-gray-500">Margin:</span>
																		<span class="font-medium"
																			>{item.marginAtTarget.toFixed(1)}%</span
																		>
																	</div>
																{/if}
															</div>
															<p class="text-xs text-gray-500 mt-2">
																<strong>Reason:</strong>
																{item.reason}
															</p>
															<p class="text-xs text-gray-400 mt-1">
																Added {formatTimeAgo(item.createdAt)}
															</p>
														</div>

														<!-- Actions -->
														<div class="flex flex-col gap-1">
															<button
																on:click={() => startEdit(item)}
																class="text-blue-600 hover:text-blue-800 text-xs underline"
															>
																Edit
															</button>
															<button
																on:click={() => basketActions.removeItem(item.id)}
																class="text-red-600 hover:text-red-800 text-xs underline"
															>
																Remove
															</button>
														</div>
													</div>
												{/if}
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Processing Items -->
					{#if processingItems.length > 0}
						<div class="p-4 border-b border-gray-200">
							<h3 class="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
								<span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm"
									>⚡ Processing ({processingItems.length})</span
								>
							</h3>
							<!-- Similar structure but read-only -->
							<div class="space-y-3">
								{#each processingItems as item (item.id)}
									<div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
										<div class="flex items-center gap-3">
											<div
												class="animate-spin w-4 h-4 border border-blue-600 border-t-transparent rounded-full"
											></div>
											<div class="flex-1">
												<div class="font-medium text-gray-900">
													{item.sku} → {formatCurrency(item.targetPrice)}
												</div>
												<div class="text-sm text-gray-600">{item.reason}</div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Completed Items -->
					{#if completedItems.length > 0}
						<div class="p-4 border-b border-gray-200">
							<h3 class="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
								<span class="bg-green-100 text-green-800 px-2 py-1 rounded text-sm"
									>✅ Completed ({completedItems.length})</span
								>
							</h3>
							<div class="space-y-2">
								{#each completedItems as item (item.id)}
									<div class="bg-green-50 border border-green-200 rounded-lg p-3">
										<div class="flex items-center justify-between">
											<div>
												<div class="font-medium text-gray-900">{item.sku}</div>
												<div class="text-sm text-green-600">
													Updated to {formatCurrency(item.targetPrice)}
												</div>
											</div>
											<div class="text-green-600">
												<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
													<path
														fill-rule="evenodd"
														d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
														clip-rule="evenodd"
													/>
												</svg>
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Failed Items -->
					{#if failedItems.length > 0}
						<div class="p-4">
							<h3 class="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
								<span class="bg-red-100 text-red-800 px-2 py-1 rounded text-sm"
									>❌ Failed ({failedItems.length})</span
								>
							</h3>
							<div class="space-y-3">
								{#each failedItems as item (item.id)}
									<div class="bg-red-50 border border-red-200 rounded-lg p-4">
										<div class="flex items-start justify-between">
											<div class="flex-1">
												<div class="font-medium text-gray-900">{item.sku}</div>
												<div class="text-sm text-red-600 mb-1">
													Failed to update to {formatCurrency(item.targetPrice)}
												</div>
												{#if item.errorMessage}
													<div class="text-xs text-red-500 bg-red-100 rounded p-2">
														{item.errorMessage}
													</div>
												{/if}
											</div>
											<div class="flex flex-col gap-1">
												<button
													on:click={() => basketActions.updateItem(item.id, { status: 'pending' })}
													class="text-blue-600 hover:text-blue-800 text-xs underline"
												>
													Retry
												</button>
												<button
													on:click={() => basketActions.removeItem(item.id)}
													class="text-red-600 hover:text-red-800 text-xs underline"
												>
													Remove
												</button>
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}
