<script lang="ts">
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/shadcn/ui/button';
	import {
		Plus,
		Package,
		AlertCircle,
		Maximize,
		Search,
		PackageSearch,
		CalendarClock
	} from 'lucide-svelte';
	import UpdateCostModal from '$lib/components/UpdateCostModal.svelte';

	export let data: any = {
		supplies: [],
		unmappedOrders: [],
		reviewOrders: [],
		selectedDate: '',
		usageData: []
	};

	$: activeTab = $page.url.searchParams.get('tab') || 'unmapped'; // 'unmapped', 'sku-search', 'review'

	function setTab(tab: string) {
		const url = new URL($page.url);
		url.searchParams.set('tab', tab);
		goto(url, { replaceState: true, keepFocus: true, noScroll: true });
	}

	function handleDateChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const date = input.value;
		const url = new URL($page.url);
		url.searchParams.set('date', date);
		goto(url.toString());
	}

	// SKU Search State
	let skuSearchQuery = '';
	let skuSearchResults: any[] = [];
	let isSearchingSkus = false;

	async function searchSkus() {
		if (skuSearchQuery.length < 2) {
			skuSearchResults = [];
			return;
		}

		isSearchingSkus = true;
		try {
			const res = await fetch(
				`/api/tools/packing-supplies/search?q=${encodeURIComponent(skuSearchQuery)}`
			);
			const data = await res.json();
			skuSearchResults = data.results || [];
		} catch (e) {
			console.error('Search error:', e);
		} finally {
			isSearchingSkus = false;
		}
	}

	$: if (skuSearchQuery === '') {
		skuSearchResults = [];
	}

	// Local mapping tracking
	let searchMappingUpdates: Record<string, string> = {};
	let mappedActiveSkus: string[] = [];

	// Toast state
	let toastNotifications: any[] = [];
	function addToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
		const id = Math.random().toString(36).substring(2, 9);
		toastNotifications = [...toastNotifications, { id, message, type }];
		setTimeout(() => {
			toastNotifications = toastNotifications.filter((t) => t.id !== id);
		}, 3000);
	}

	async function quickAssignBox(sku: string, newBoxCode: string) {
		if (!newBoxCode) return;
		try {
			const res = await fetch('/api/tools/packing-supplies/reassign', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sku, newBoxCode })
			});
			const responseData = await res.json();
			if (res.ok) {
				mappedActiveSkus = [...mappedActiveSkus, sku];
				searchMappingUpdates[sku] = newBoxCode;
				searchMappingUpdates = { ...searchMappingUpdates };
				const supplyName =
					data.supplies.find((s: any) => s.code === newBoxCode)?.name || newBoxCode;
				addToast(`Assigned ${sku} to ${supplyName}`, 'success');
				invalidateAll();
			} else {
				addToast(responseData.error || 'Failed to assign box size', 'error');
			}
		} catch (e) {
			addToast('An error occurred during assignment', 'error');
		}
	}

	$: boxOptions = (data?.supplies || [])
		.filter((s: any) => ['box', 'envelope', 'bag'].includes(s.type))
		.map((s: any) => ({ code: s.code, name: s.name }))
		.sort((a: any, b: any) => a.name.localeCompare(b.name));

	$: if (!boxOptions.find((o: any) => o.code === '0x0x0')) {
		boxOptions = [{ code: '0x0x0', name: 'None / Own Box' }, ...boxOptions];
	}

	// Modal State
	let showCostModal = false;
	let currentSku = '';
	let currentAsin = '';
	let currentTitle = '';

	function openCostModal(sku: string, asin: string, title: string) {
		currentSku = sku;
		currentAsin = asin;
		currentTitle = title || '';
		showCostModal = true;
	}

	function handleModalSuccess() {
		mappedActiveSkus = [...mappedActiveSkus, currentSku];
		showCostModal = false;
		invalidateAll();
	}

	$: activeUnmappedOrdersCount =
		data?.unmappedOrders
			?.flatMap((o: any) => o.items || [])
			.filter(
				(i: any) =>
					i?.costs?.boxCode !== '0x0x0' &&
					i?.costs?.boxReason !== 'Mapped' &&
					!mappedActiveSkus.includes(i?.seller_sku)
			).length || 0;
</script>

<div class="flex flex-col gap-6 p-6 max-w-[1600px] mx-auto w-full">
	<div class="flex justify-between items-center">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">SKU Management</h1>
			<p class="text-muted-foreground mt-2">
				Manage box mappings, review historical assignments, and fix unmapped orders.
			</p>
		</div>
		<Button variant="outline" onclick={() => goto('/dashboard/tools/packing-supplies')}>
			Back to Inventory
		</Button>
	</div>

	<!-- Navigation Tabs -->
	<div class="flex space-x-1 border-b pb-4">
		<button
			class="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors {activeTab ===
			'unmapped'
				? 'bg-primary/10 text-primary'
				: 'text-muted-foreground hover:bg-muted'}"
			onclick={() => setTab('unmapped')}
		>
			<AlertCircle class="h-4 w-4" /> Unmapped ({activeUnmappedOrdersCount})
		</button>
		<button
			class="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors {activeTab ===
			'sku-search'
				? 'bg-primary/10 text-primary'
				: 'text-muted-foreground hover:bg-muted'}"
			onclick={() => setTab('sku-search')}
		>
			<Search class="h-4 w-4" /> SKU Search
		</button>
		<button
			class="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors {activeTab ===
			'review'
				? 'bg-primary/10 text-primary'
				: 'text-muted-foreground hover:bg-muted'}"
			onclick={() => setTab('review')}
		>
			<PackageSearch class="h-4 w-4" /> Daily Review
		</button>
		<button
			class="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors {activeTab ===
			'usage'
				? 'bg-primary/10 text-primary'
				: 'text-muted-foreground hover:bg-muted'}"
			onclick={() => setTab('usage')}
		>
			<CalendarClock class="h-4 w-4" /> 7 Day Usage
		</button>
	</div>

	<div class="mt-4">
		{#if activeTab === 'unmapped'}
			<div class="bg-card text-card-foreground rounded-xl border shadow-sm p-6 w-full">
				<div class="overflow-x-auto rounded-lg border">
					<table class="w-full text-sm">
						<thead class="bg-muted/50 border-b">
							<tr>
								<th class="px-4 py-3 text-left font-medium">Order Details</th>
								<th class="px-4 py-3 text-left font-medium">Items to Map</th>
							</tr>
						</thead>
						<tbody class="divide-y text-xs">
							{#each data.unmappedOrders || [] as order}
								{@const activeItems = (order.items || []).filter(
									(i: any) =>
										i?.costs?.boxCode !== '0x0x0' &&
										i?.costs?.boxReason !== 'Mapped' &&
										!mappedActiveSkus.includes(i?.seller_sku)
								)}
								{#if activeItems.length > 0}
									<tr class="hover:bg-muted/30 transition-colors">
										<td class="px-4 py-4">
											<div class="font-bold text-sm">{order.amazon_order_id}</div>
											<div class="text-[10px] text-muted-foreground mt-1">
												{new Date(order.calculated_at).toLocaleString()}
											</div>
										</td>
										<td class="px-4 py-4">
											<div class="flex flex-col gap-3">
												{#each activeItems as item}
													<div
														class="flex items-start justify-between gap-4 border-l-2 border-amber-300 pl-3"
													>
														<div class="min-w-0">
															<p class="font-medium line-clamp-1">{item.title}</p>
															<p class="text-[10px] text-muted-foreground font-mono">
																{item.seller_sku} | {item.asin}
															</p>
														</div>
														<div class="flex flex-col gap-2 shrink-0">
															<select
																class="h-7 border rounded text-[10px] px-1 focus:ring-1 focus:ring-primary outline-none"
																onchange={(e) =>
																	quickAssignBox(item.seller_sku, e.currentTarget.value)}
															>
																<option value="">Quick Assign...</option>
																{#each boxOptions as box}
																	<option value={box.code}>{box.name}</option>
																{/each}
															</select>
															<button
																class="text-[10px] text-primary hover:underline font-bold text-right"
																onclick={() =>
																	openCostModal(item.seller_sku, item.asin, item.title)}
															>
																Advanced Mapping
															</button>
														</div>
													</div>
												{/each}
											</div>
										</td>
									</tr>
								{/if}
							{:else}
								<tr>
									<td colspan="2" class="px-4 py-12 text-center text-muted-foreground italic">
										All orders are currently mapped correctly.
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{:else if activeTab === 'sku-search'}
			<div class="bg-card text-card-foreground rounded-xl border shadow-sm p-6 w-full">
				<div class="flex flex-col gap-4 mb-6">
					<div class="flex gap-2 max-w-xl">
						<div class="relative flex-1">
							<Search
								class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
							/>
							<input
								type="text"
								placeholder="Search by SKU, ASIN or Product Name..."
								class="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-primary outline-none"
								bind:value={skuSearchQuery}
								onkeyup={(e) => e.key === 'Enter' && searchSkus()}
							/>
						</div>
						<Button onclick={searchSkus} disabled={isSearchingSkus}>
							{isSearchingSkus ? 'Searching...' : 'Search'}
						</Button>
					</div>
				</div>

				{#if skuSearchResults.length > 0}
					<div class="overflow-x-auto rounded-lg border">
						<table class="w-full text-sm">
							<thead class="bg-muted/50 border-b">
								<tr>
									<th class="px-4 py-3 text-left font-medium">Product</th>
									<th class="px-4 py-3 text-left font-medium">SKU / ASIN</th>
									<th class="px-4 py-3 text-left font-medium">Current Status</th>
									<th class="px-4 py-3 text-left font-medium w-64">Update Mapping</th>
								</tr>
							</thead>
							<tbody class="divide-y text-xs">
								{#each skuSearchResults as result}
									<tr class="hover:bg-muted/30 transition-colors">
										<td class="px-4 py-4">
											<div class="font-medium line-clamp-2">{result.name}</div>
										</td>
										<td class="px-4 py-4 text-center">
											<div class="text-foreground font-semibold">{result.sku}</div>
											<div class="text-muted-foreground">{result.asin}</div>
										</td>
										<td class="px-4 py-4">
											{#if searchMappingUpdates[result.sku] || result.box_code}
												<div class="flex items-center gap-2">
													<span
														class="inline-flex items-center rounded-full bg-blue-100 text-blue-800 border-blue-300 px-2.5 py-0.5 text-[11px] font-bold border"
													>
														{searchMappingUpdates[result.sku] || result.box_code}
													</span>
												</div>
											{:else}
												<span class="text-muted-foreground italic">Not Mapped</span>
											{/if}
										</td>
										<td class="px-4 py-4">
											<div class="flex items-center gap-2">
												<select
													class="w-full h-8 border rounded-md px-2 text-[11px] outline-none"
													value={searchMappingUpdates[result.sku] || result.box_code}
													onchange={(e) => quickAssignBox(result.sku, e.currentTarget.value)}
												>
													<option value="">Select Box...</option>
													{#each boxOptions as box}
														<option value={box.code}>{box.name} ({box.code})</option>
													{/each}
												</select>
												<Button
													variant="ghost"
													size="sm"
													class="h-8 w-8 p-0"
													onclick={() => openCostModal(result.sku, result.asin, result.name)}
												>
													<Maximize class="h-3.5 w-3.5" />
												</Button>
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		{:else if activeTab === 'review'}
			<div class="bg-card text-card-foreground rounded-xl border shadow-sm p-6 w-full">
				<div class="flex justify-between items-center mb-6">
					<h2 class="text-xl font-semibold">Daily Dispatch Review</h2>
					<input
						type="date"
						class="bg-background border rounded px-3 py-1.5 text-sm outline-none"
						value={data.selectedDate}
						onchange={handleDateChange}
					/>
				</div>
				<div class="overflow-x-auto rounded-lg border">
					<table class="w-full text-left">
						<thead class="bg-muted/50 text-[11px] uppercase">
							<tr>
								<th class="px-6 py-3 font-bold border-b">Order</th>
								<th class="px-6 py-3 font-bold border-b">Items</th>
								<th class="px-6 py-3 font-bold border-b text-center">Allocated</th>
							</tr>
						</thead>
						<tbody class="divide-y text-xs">
							{#each data.reviewOrders || [] as order}
								<tr
									class="hover:bg-muted/20 border-l-4 {order.box_code === '0x0x0'
										? 'border-l-blue-500'
										: 'border-l-green-500'}"
								>
									<td class="px-6 py-4 align-top">
										<div class="font-bold">{order.amazon_order_id}</div>
										<div class="text-muted-foreground text-[10px] mt-1">
											{new Date(order.purchase_date).toLocaleDateString()}
										</div>
									</td>
									<td class="px-6 py-4">
										<div class="space-y-3">
											{#each order.items || [] as item}
												<div class="p-2 bg-white/50 rounded border text-[10px]">
													<div class="font-bold">{item.title}</div>
													<div class="text-muted-foreground mt-1">
														{item.seller_sku} | Qty: {item.quantity_ordered}
													</div>
													{#if item.costs}
														<div class="mt-2">
															<span
																class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border {order.box_code ===
																'0x0x0'
																	? 'bg-blue-50 text-blue-800 border-blue-200'
																	: 'bg-green-50 text-green-800 border-green-200'}"
															>
																{order.box_code === '0x0x0'
																	? 'OWN BOX'
																	: (
																			data.supplies.find((s: any) => s.id === order.box_supply_id)
																				?.name ||
																			order.box_code ||
																			'N/A'
																		).toUpperCase()}
															</span>
														</div>
													{/if}
												</div>
											{/each}
										</div>
									</td>
									<td class="px-6 py-4 text-center">
										<select
											class="text-[10px] border rounded px-1 py-0.5 outline-none w-24"
											onchange={(e) => {
												if (e.currentTarget.value && order.items?.[0]?.seller_sku) {
													quickAssignBox(order.items[0].seller_sku, e.currentTarget.value);
												}
											}}
										>
											<option value="">Update...</option>
											{#each boxOptions as box}
												<option value={box.code}>{box.name}</option>
											{/each}
										</select>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		{#if activeTab === 'usage'}
			<div class="bg-card text-card-foreground rounded-xl border shadow-sm p-6 w-full">
				<div class="mb-6">
					<h2 class="text-lg font-semibold tracking-tight">Last 7 Days Consumption</h2>
					<p class="text-sm text-muted-foreground">
						Showing stock deductions (usage) from packing inventory ledger.
					</p>
				</div>

				{#if data.usageByDay && data.usageByDay.length > 0}
					<div class="mb-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
						{#each data.usageByDay as day}
							<div class="bg-muted/30 border rounded-lg p-3 text-center">
								<div
									class="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1"
								>
									{day.date}
								</div>
								<div class="text-2xl font-bold text-primary">{day.total}</div>
							</div>
						{/each}
					</div>
				{/if}

				<div class="overflow-x-auto rounded-lg border">
					<table class="w-full text-sm">
						<thead class="bg-muted/50 border-b">
							<tr>
								<th class="px-4 py-3 text-left font-medium">Supply Name</th>
								<th class="px-4 py-3 text-left font-medium">Box Size / Code</th>
								<th class="px-4 py-3 text-right font-medium">Total Qty Used</th>
							</tr>
						</thead>
						<tbody class="divide-y text-xs">
							{#each data.usageData || [] as entry}
								<tr class="hover:bg-muted/30 transition-colors">
									<td class="px-4 py-3 font-medium">
										{entry.name}
									</td>
									<td class="px-4 py-3 text-muted-foreground font-mono">
										{entry.code}
									</td>
									<td class="px-4 py-3 text-right font-bold text-red-600 text-sm">
										{entry.total}
									</td>
								</tr>
							{:else}
								<tr>
									<td colspan="3" class="p-8 text-center text-muted-foreground">
										No usage data found in the last 7 days.
									</td>
								</tr>
							{/each}
						</tbody>
						<tfoot class="bg-muted/50 border-t font-semibold">
							<tr>
								<td class="px-4 py-3 text-left">Total</td>
								<td class="px-4 py-3"></td>
								<td class="px-4 py-3 text-right">
									{(data.usageData || []).reduce(
										(sum: number, item: any) => sum + (item.total || 0),
										0
									)}
								</td>
							</tr>
						</tfoot>
					</table>
				</div>
			</div>
		{/if}
	</div>
</div>

<UpdateCostModal
	bind:open={showCostModal}
	sku={currentSku}
	asin={currentAsin}
	title={currentTitle}
	supplies={data.supplies || []}
	on:success={handleModalSuccess}
/>

{#if toastNotifications.length > 0}
	<div class="fixed top-4 right-4 z-9999 flex flex-col gap-2">
		{#each toastNotifications as toast (toast.id)}
			<div
				class="min-w-[200px] border bg-white p-3 shadow-lg rounded-lg border-l-4 {toast.type ===
				'success'
					? 'border-l-green-500'
					: 'border-l-blue-500'}"
			>
				<p class="text-xs font-medium">{toast.message}</p>
			</div>
		{/each}
	</div>
{/if}
