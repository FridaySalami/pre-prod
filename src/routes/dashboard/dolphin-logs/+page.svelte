<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { slide } from 'svelte/transition';
	import {
		ChevronDown,
		ChevronRight,
		Package,
		AlertCircle,
		Search,
		X,
		Copy,
		Check,
		Maximize2,
		Minimize2
	} from 'lucide-svelte';

	export let data;

	// Reactive statement to update local variables when data prop changes
	$: ({ logs, totalCount, page: currentPage, pageSize, error, query } = data);
	$: totalPages = Math.ceil((totalCount || 0) / (pageSize || 50));

	// Search handling
	let searchQuery = '';
	let searchTimeout: NodeJS.Timeout;

	// Sync searchQuery with URL query param on mount and navigation
	$: {
		if (
			query !== undefined &&
			query !== searchQuery &&
			typeof document !== 'undefined' &&
			document.activeElement !== document.querySelector('input[name="search"]')
		) {
			searchQuery = query;
		}
	}

	function handleSearchInput(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		searchQuery = value;

		// @ts-ignore
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			const url = new URL($page.url);
			url.searchParams.set('page', '1'); // Reset pagination
			if (value) {
				url.searchParams.set('q', value);
			} else {
				url.searchParams.delete('q');
			}
			goto(url, { keepFocus: true, noScroll: true });
		}, 400);
	}

	function clearSearch() {
		searchQuery = '';
		const url = new URL($page.url);
		url.searchParams.set('page', '1');
		url.searchParams.delete('q');
		goto(url, { keepFocus: true, noScroll: true });
	}

	// State for grouping
	let groupByOrder = true;
	let expandedOrders: Record<string, boolean> = {};

	// Filter state
	let filterStatus: 'all' | 'errors' | 'warnings' | 'incomplete' = 'all';

	// Computed grouped logs
	$: allGroups = groupByOrder ? groupLogsByOrder(logs) : [];

	$: filteredGroups = allGroups.filter((group) => {
		if (filterStatus === 'all') return true;
		if (filterStatus === 'errors') return group.hasErrors;
		if (filterStatus === 'warnings') return group.hasWarnings;
		if (filterStatus === 'incomplete') return !group.isProcessed && group.orderId !== 'No Order ID';
		return true;
	});

	function groupLogsByOrder(logs: any[]) {
		if (!logs) return [];

		const groups: Record<string, any[]> = {};
		const noOrderLogs: any[] = [];

		logs.forEach((log) => {
			if (log.order_id) {
				if (!groups[log.order_id]) {
					groups[log.order_id] = [];
				}
				groups[log.order_id].push(log);
			} else {
				noOrderLogs.push(log);
			}
		});

		const result = Object.entries(groups).map(([orderId, groupLogs]) => {
			// Find latest timestamp in group to sort groups
			const latestTime = groupLogs.reduce((max, log) => {
				const time = new Date(log.created_at).getTime();
				return time > max ? time : max;
			}, 0);

			// Find any errors in the group
			const hasErrors = groupLogs.some((l) => l.level === 'ERROR' || l.level === 'CRITICAL');
			const hasWarnings = groupLogs.some((l) => l.level === 'WARN');

			// Check if completed (has ORDER_PROCESSED)
			const isProcessed = groupLogs.some((l) => l.event_type === 'ORDER_PROCESSED');

			// Calculate total duration
			const totalDuration = groupLogs.reduce((sum, log) => sum + (log.duration_seconds || 0), 0);

			return {
				orderId,
				logs: groupLogs.sort(
					(a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
				),
				latestTime,
				hasErrors,
				hasWarnings,
				isProcessed,
				totalDuration,
				user: groupLogs.find((l) => l.user_id)?.user_id || 'Unknown'
			};
		});

		// Sort groups by latest activity
		result.sort((a, b) => b.latestTime - a.latestTime);

		// Add "No Order ID" group if exists
		if (noOrderLogs.length > 0) {
			result.push({
				orderId: 'No Order ID',
				logs: noOrderLogs,
				latestTime: 0,
				hasErrors: noOrderLogs.some((l) => l.level === 'ERROR' || l.level === 'CRITICAL'),
				hasWarnings: noOrderLogs.some((l) => l.level === 'WARN'),
				isProcessed: true, // System logs don't need processing
				totalDuration: noOrderLogs.reduce((sum, log) => sum + (log.duration_seconds || 0), 0),
				user: '-'
			});
		}

		// Default expand all (user request)
		if (Object.keys(expandedOrders).length === 0 && result.length > 0) {
			result.forEach((g) => (expandedOrders[g.orderId] = true));
		}

		return result;
	}

	function expandAll() {
		const newExpanded = { ...expandedOrders };
		filteredGroups.forEach((g: any) => (newExpanded[g.orderId] = true));
		expandedOrders = newExpanded;
	}

	function collapseAll() {
		const newExpanded = { ...expandedOrders };
		filteredGroups.forEach((g: any) => (newExpanded[g.orderId] = false));
		expandedOrders = newExpanded;
	}
	
	function toggleOrder(orderId: string) {
		expandedOrders[orderId] = !expandedOrders[orderId];
	}

	function formatDate(dateString: string) {
		if (!dateString) return '';
		return new Date(dateString).toLocaleString('en-GB', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	function formatDuration(seconds: number) {
		if (!seconds) return '-';
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}m ${remainingSeconds}s`;
	}

	function formatTimeOnly(dateString: string) {
		if (!dateString) return '';
		return new Date(dateString).toLocaleTimeString('en-GB', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	function getLevelClass(level: string) {
		switch (level) {
			case 'ERROR':
				return 'bg-red-100 text-red-800 border-red-200';
			case 'CRITICAL':
				return 'bg-red-200 text-red-900 border-red-300 font-bold';
			case 'WARN':
				return 'bg-yellow-100 text-yellow-800 border-yellow-200';
			case 'INFO':
				return 'bg-blue-50 text-blue-700 border-blue-100';
			default:
				return 'bg-gray-50 text-gray-600 border-gray-100';
		}
	}

	function getDurationClass(seconds: number) {
		if (!seconds) return 'text-gray-500';
		if (seconds < 45) return 'text-green-600 font-medium';
		return 'text-red-600 font-bold';
	}

	function getDisplaySku(log: any) {
		// Priority 1: SCAN_MISMATCH special format
		if (log.event_type === 'SCAN_MISMATCH' && log.details) {
			try {
				const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
				if (details.scanned_barcode) {
					return `📱 Scanned: ${details.scanned_barcode}`;
				}
			} catch (e) {
				// continue
			}
		}

		if (log.sku && log.sku !== '-') return log.sku;

		// Attempt to extract from details
		if (!log.details) return '-';

		try {
			// Handle details being string or object
			const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;

			// Priority 2: ORDER_PROCESSED with item summary
			if (log.event_type === 'ORDER_PROCESSED' && details.items && Array.isArray(details.items)) {
				const count = details.items.length;
				if (count > 0) {
					const firstItem = details.items[0];
					// Try to get a friendly name, fallback to SKU
					const name = firstItem.Title || firstItem.item_name || firstItem.sku || 'Unknown Item';
					// Truncate name if too long
					const truncatedName = name.length > 30 ? name.substring(0, 30) + '...' : name;

					if (count === 1) {
						return `1 Item: ${truncatedName}`;
					} else {
						return `${count} Items: ${truncatedName} (+${count - 1} more)`;
					}
				}
			}

			if (details.sku) return details.sku;
			if (details.items && Array.isArray(details.items)) {
				if (details.items.length === 1) return details.items[0].sku;
				return `${details.items.length} Items`;
			}
			if (details.scanned_barcode) return details.scanned_barcode;
		} catch (e) {
			// silent fail
		}
		return '-';
	}

	function formatDetails(details: any) {
		if (!details) return '';
		try {
			if (typeof details === 'string') return details;
			return JSON.stringify(details, null, 2);
		} catch (e) {
			return String(details);
		}
	}

	// State for copied items
	let copiedOrders: Record<string, boolean> = {};

	function copyToClipboard(e: Event, text: string) {
		e.stopPropagation();
		navigator.clipboard.writeText(text);
		copiedOrders[text] = true;
		setTimeout(() => {
			copiedOrders[text] = false;
		}, 2000);
	}

	function changePage(newPage: number) {
		if (newPage < 1 || newPage > totalPages) return;
		const url = new URL($page.url);
		url.searchParams.set('page', String(newPage));
		goto(url);
	}
</script>

<div class="container mx-auto px-4 py-8">
	<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">Dolphin Scanner Logs</h1>
			<p class="text-sm text-gray-500 mt-1">Real-time logs from scanning and packing operations</p>
		</div>

		<div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
			<!-- Search Input -->
			<div class="relative w-full sm:w-64">
				<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
					<Search class="h-4 w-4 text-gray-400" />
				</div>
				<input
					type="text"
					name="search"
					placeholder="Search Order ID or SKU..."
					class="block w-full pl-10 pr-10 py-2 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm"
					value={searchQuery || ''}
					on:input={handleSearchInput}
				/>
				{#if searchQuery}
					<button
						class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
						on:click={clearSearch}
					>
						<X class="h-4 w-4" />
					</button>
				{/if}
			</div>

			<div class="flex items-center space-x-4 w-full sm:w-auto justify-between sm:justify-start">
				<div class="flex items-center bg-gray-100 p-1 rounded-lg shrink-0">
					<button
						class={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${groupByOrder ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
						on:click={() => (groupByOrder = true)}
					>
						Group by Order
					</button>
					<button
						class={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${!groupByOrder ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
						on:click={() => (groupByOrder = false)}
					>
						Flat List
					</button>
				</div>
				<div class="text-sm text-gray-500 border-l pl-4 hidden sm:block shrink-0">
					Total Records: <span class="font-medium text-gray-900">{totalCount}</span>
				</div>
			</div>
		</div>
	</div>

	{#if error}
		<div class="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
			<div class="flex">
				<div class="shrink-0">
					<AlertCircle class="h-5 w-5 text-red-400" />
				</div>
				<div class="ml-3">
					<p class="text-sm text-red-700">
						Error loading logs: {error}
					</p>
				</div>
			</div>
		</div>
	{/if}

	{#if groupByOrder}
		<!-- Status Filters and Actions -->
		<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
			<div class="flex flex-wrap gap-2">
				<button
					class={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors border ${filterStatus === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
					on:click={() => (filterStatus = 'all')}
				>
					All
				</button>
				<button
					class={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors border ${filterStatus === 'errors' ? 'bg-red-100 text-red-800 border-red-200 ring-1 ring-red-300' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
					on:click={() => (filterStatus = 'errors')}
				>
					Errors
				</button>
				<button
					class={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors border ${filterStatus === 'warnings' ? 'bg-yellow-100 text-yellow-800 border-yellow-200 ring-1 ring-yellow-300' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
					on:click={() => (filterStatus = 'warnings')}
				>
					Warnings
				</button>
				<button
					class={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors border ${filterStatus === 'incomplete' ? 'bg-orange-100 text-orange-800 border-orange-200 ring-1 ring-orange-300' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
					on:click={() => (filterStatus = 'incomplete')}
				>
					Incomplete
				</button>
			</div>

			<div class="flex items-center space-x-2">
				<button
					class="p-1.5 text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
					title="Expand All"
					on:click={expandAll}
				>
					<Maximize2 class="h-4 w-4" />
				</button>
				<button
					class="p-1.5 text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
					title="Collapse All"
					on:click={collapseAll}
				>
					<Minimize2 class="h-4 w-4" />
				</button>
			</div>
		</div>

		<div class="space-y-4">
			{#each filteredGroups as group (group.orderId)}
				<div class="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<div
						class="px-6 py-4 bg-gray-50 border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-between"
						on:click={() => toggleOrder(group.orderId)}
					>
						<div class="flex items-center space-x-4">
							{#if expandedOrders[group.orderId]}
								<ChevronDown class="h-5 w-5 text-gray-400" />
							{:else}
								<ChevronRight class="h-5 w-5 text-gray-400" />
							{/if}

							<div class="flex items-center space-x-3">
								<span class="text-lg font-medium text-gray-900">
									{group.orderId === 'No Order ID'
										? 'System Logs / No Order'
										: `Order #${group.orderId}`}
								</span>

								{#if group.orderId !== 'No Order ID'}
									<button
										class="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
										title="Copy Order ID"
										on:click={(e) => copyToClipboard(e, group.orderId)}
									>
										{#if copiedOrders[group.orderId]}
											<Check class="h-4 w-4 text-green-600" />
										{:else}
											<Copy class="h-4 w-4" />
										{/if}
									</button>
								{/if}

								{#if group.hasErrors}
									<span
										class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"
									>
										Has Errors
									</span>
								{:else if group.hasWarnings}
									<span
										class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"
									>
										Has Warnings
									</span>
								{/if}
								{#if !group.isProcessed && group.orderId !== 'No Order ID'}
									<span
										class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200"
									>
										Incomplete
									</span>
								{/if}
							</div>
						</div>

						<div class="flex items-center space-x-6 text-sm text-gray-500">
							<div>
								User: <span class="font-medium">{group.user}</span>
							</div>
							{#if group.totalDuration > 0}
								<div>
									Time: <span class={getDurationClass(group.totalDuration)}
										>{formatDuration(group.totalDuration)}</span
									>
								</div>
							{/if}
							<div>
								Logs: <span class="font-medium">{group.logs.length}</span>
							</div>
							<div>
								Latest: {formatDate(new Date(group.latestTime).toISOString())}
							</div>
						</div>
					</div>

					{#if expandedOrders[group.orderId]}
						<div transition:slide|local class="border-t border-gray-100">
							<div class="overflow-x-auto">
								<table class="min-w-full divide-y divide-gray-200">
									<thead class="bg-white">
										<tr>
											<th
												class="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>Time</th
											>
											<th
												class="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>Level</th
											>
											<th
												class="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>Event</th
											>
											<th
												class="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>Duration</th
											>
											<th
												class="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>SKU Information</th
											>
											<th
												class="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>Details</th
											>
										</tr>
									</thead>
									<tbody class="bg-white divide-y divide-gray-200">
										{#each group.logs as log}
											<tr class="hover:bg-gray-50">
												<td class="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
													{formatTimeOnly(log.created_at)}
												</td>
												<td class="px-6 py-3 whitespace-nowrap">
													<span
														class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${getLevelClass(log.level)}`}
													>
														{log.level}
													</span>
												</td>
												<td class="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
													{log.event_type}
												</td>
												<td class="px-6 py-3 whitespace-nowrap text-sm">
													<span class={getDurationClass(log.duration_seconds)}>
														{log.duration_seconds && log.duration_seconds > 0
															? formatDuration(log.duration_seconds)
															: '-'}
													</span>
												</td>
												<td class="px-6 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
													{getDisplaySku(log)}
												</td>
												<td
													class="px-6 py-3 text-sm text-gray-500 max-w-lg truncate"
													title={formatDetails(log.details)}
												>
													<span class="truncate block">
														{formatDetails(log.details)}
													</span>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/if}
				</div>
			{/each}

			{#if filteredGroups.length === 0}
				<div class="text-center py-12 bg-white rounded-lg shadow">
					<Package class="mx-auto h-12 w-12 text-gray-400" />
					<h3 class="mt-2 text-sm font-medium text-gray-900">No logs found</h3>
					<p class="mt-1 text-sm text-gray-500">
						{filterStatus !== 'all'
							? `No groups match the "${filterStatus}" filter on this page.`
							: searchQuery
								? `No logs match "${searchQuery}"`
								: 'Get scanning to see data here.'}
					</p>
					{#if filterStatus !== 'all'}
						<button
							class="mt-4 text-sm font-medium text-blue-600 hover:text-blue-500 hover:underline"
							on:click={() => (filterStatus = 'all')}
						>
							Clear filter
						</button>
					{/if}
				</div>
			{/if}
		</div>
	{:else}
		<!-- Flat List View (Original) -->
		<div class="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th
								scope="col"
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Timestamp</th
							>
							<th
								scope="col"
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Level</th
							>
							<th
								scope="col"
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Event</th
							>
							<th
								scope="col"
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Duration</th
							>
							<th
								scope="col"
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Order ID</th
							>
							<th
								scope="col"
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>SKU</th
							>
							<th
								scope="col"
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>User</th
							>
							<th
								scope="col"
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Details</th
							>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#if logs && logs.length > 0}
							{#each logs as log (log.id)}
								<tr class="hover:bg-gray-50 transition-colors duration-150">
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
										{formatDate(log.created_at)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										<span
											class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${getLevelClass(log.level)}`}
										>
											{log.level}
										</span>
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
										{log.event_type}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm">
										<span class={getDurationClass(log.duration_seconds)}>
											{log.duration_seconds && log.duration_seconds > 0
												? formatDuration(log.duration_seconds)
												: '-'}
										</span>
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
										{log.order_id || '-'}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
										{getDisplaySku(log)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
										{log.user_id || '-'}
									</td>
									<td
										class="px-6 py-4 text-sm text-gray-500 max-w-xs truncate"
										title={formatDetails(log.details)}
									>
										<div class="truncate">
											{formatDetails(log.details)}
										</div>
									</td>
								</tr>
							{/each}
						{:else}
							<tr>
								<td colspan="8" class="px-6 py-12 text-center text-gray-500">
									{searchQuery ? `No logs match "${searchQuery}"` : 'No logs found.'}
								</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- Pagination (Shared) -->
	{#if totalPages > 1}
		<div
			class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-4 rounded-lg shadow"
		>
			<div class="flex-1 flex justify-between sm:hidden">
				<button
					on:click={() => changePage(currentPage - 1)}
					disabled={currentPage === 1}
					class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
				>
					Previous
				</button>
				<button
					on:click={() => changePage(currentPage + 1)}
					disabled={currentPage === totalPages}
					class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
				>
					Next
				</button>
			</div>
			<div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
				<div>
					<p class="text-sm text-gray-700">
						Showing page <span class="font-medium">{currentPage}</span> of
						<span class="font-medium">{totalPages}</span>
					</p>
				</div>
				<div>
					<nav
						class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
						aria-label="Pagination"
					>
						<button
							on:click={() => changePage(currentPage - 1)}
							disabled={currentPage === 1}
							class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
						>
							<span class="sr-only">Previous</span>
							<!-- Left arrow equivalent -->
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="h-4 w-4"><polyline points="15 18 9 12 15 6"></polyline></svg
							>
						</button>

						<button
							on:click={() => changePage(currentPage + 1)}
							disabled={currentPage === totalPages}
							class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
						>
							<span class="sr-only">Next</span>
							<ChevronRight class="h-4 w-4" />
						</button>
					</nav>
				</div>
			</div>
		</div>
	{/if}
</div>
