<script lang="ts">
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/shadcn/ui/button';
	import { Plus, Package, FileText, ClipboardList, AlertCircle, Maximize } from 'lucide-svelte';
	import UpdateCostModal from '$lib/components/UpdateCostModal.svelte';

	export let data;

	$: activeTab = $page.url.searchParams.get('tab') || 'log'; // 'log', 'inventory', 'history', 'unmapped'

	function setTab(tab: string) {
		const url = new URL($page.url);
		url.searchParams.set('tab', tab);
		goto(url, { replaceState: true, keepFocus: true, noScroll: true });
	}

	// These will become our dynamic form fields
	let selectedSupplier = '';
	let invoiceDate = new Date().toISOString().split('T')[0];
	let invoiceNumber = '';
	let notes = '';

	// State for the grouped forms: Map of supply_id -> { quantity, line_total }
	let quantities: Record<string, number | null> = {};
	let lineTotals: Record<string, number | null> = {};
	let isSubmitting = false;

	// Catalog Management State
	let showSupplyForm = false;
	let isSavingSupply = false;
	let editSupplyId = '';
	let editSupplyName = '';
	let editSupplyCode = '';
	let editSupplyType = 'box';

	// Track if the user has manually edited the code
	let hasManuallyEditedCode = false;

	// Invoice Edit State
	let showInvoiceEditModal = false;
	let editInvoiceId = '';
	let editInvoiceNumber = '';
	let editInvoiceDate = '';
	let editInvoiceNotes = '';
	let isSavingInvoiceEdit = false;

	// Line Item Edit State
	let editingLineInvoiceId: string | null = null;
	let editingLineSupplyId: string | null = null;
	let editLineQty: number = 0;
	let editLineTotal: number = 0;
	let isSavingLineEdit = false;

	// Stock Adjustment State
	let showAdjustModal = false;
	let adjustSupplyId = '';
	let adjustSupplyName = '';
	let adjustCurrentStock = 0;
	let adjustNewStock = 0;
	let adjustReason = 'stock take correction';
	let isSavingAdjustment = false;

	$: adjustChangeAmount = adjustNewStock - adjustCurrentStock;

	// Unmapped Order Modal State
	let showCostModal = false;
	let currentSku = '';
	let currentAsin = '';
	let currentTitle = '';
	let initiallyUnmappedCount = 0;
	let mappedActiveSkus: string[] = [];

	$: activeUnmappedOrdersCount =
		data?.unmappedOrders
			?.flatMap((o) => o.items)
			.filter((i) => !mappedActiveSkus.includes(i.seller_sku)).length || 0;

	function openCostModal(sku: string, asin: string, title: string) {
		currentSku = sku;
		currentAsin = asin;
		currentTitle = title || '';
		showCostModal = true;
	}

	function handleModalSuccess() {
		mappedActiveSkus = [...mappedActiveSkus, currentSku];
		showCostModal = false;
	}

	// Auto-fill SKU/Code based on name when adding a new supply
	$: if (!editSupplyId && editSupplyName && !hasManuallyEditedCode) {
		editSupplyCode = editSupplyName.toLowerCase().replace(/\s+/g, '-');
	}

	function handleNameInput(e: Event) {
		// Just relying on the reactive statement above now
	}

	function handleCodeInput(e: Event) {
		hasManuallyEditedCode = true;
	}

	function openAddSupply() {
		editSupplyId = '';
		editSupplyName = '';
		editSupplyCode = '';
		editSupplyType = 'box';
		hasManuallyEditedCode = false;
		showSupplyForm = true;
	}

	function openEditSupply(supply: any) {
		editSupplyId = supply.id;
		editSupplyName = supply.name;
		editSupplyCode = supply.code;
		editSupplyType = supply.type;
		hasManuallyEditedCode = true; // Don't auto-update code when editing existing
		showSupplyForm = true;
	}

	async function saveSupply() {
		if (!editSupplyName || !editSupplyCode) {
			alert('Name and Code are required.');
			return;
		}

		isSavingSupply = true;
		try {
			const res = await fetch('/api/tools/packing-supplies/catalog', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: editSupplyId || undefined,
					name: editSupplyName,
					code: editSupplyCode,
					type: editSupplyType
				})
			});

			if (!res.ok) throw new Error('Failed to save supply');

			showSupplyForm = false;
			await invalidateAll();
		} catch (e) {
			console.error('Error saving supply', e);
			alert('Failed to save supply');
		} finally {
			isSavingSupply = false;
		}
	}

	async function deleteSupply(id: string) {
		if (
			!confirm(
				'Are you sure you want to archive this supply item? It will be hidden from current views but preserved in historical records.'
			)
		) {
			return;
		}

		try {
			const res = await fetch(`/api/tools/packing-supplies/catalog?id=${id}`, {
				method: 'DELETE'
			});
			if (!res.ok) throw new Error('Failed to archive supply');
			await invalidateAll();
		} catch (e) {
			console.error(e);
			alert('Error archiving supply');
		}
	}

	function openAdjustStock(supply: any) {
		adjustSupplyId = supply.id;
		adjustSupplyName = supply.name;
		adjustCurrentStock = supply.current_stock || 0;
		adjustNewStock = supply.current_stock || 0;
		adjustReason = 'stock take correction';
		showAdjustModal = true;
	}

	async function saveAdjustment() {
		if (!adjustReason) {
			alert('Please provide a reason for the adjustment.');
			return;
		}
		if (adjustChangeAmount === 0) {
			alert('No change in stock detected.');
			return;
		}

		isSavingAdjustment = true;
		try {
			const res = await fetch('/api/tools/packing-supplies/adjust', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					supply_id: adjustSupplyId,
					new_stock: adjustNewStock,
					change_amount: adjustChangeAmount,
					reason: adjustReason
				})
			});

			if (!res.ok) throw new Error('Failed to adjust stock');

			showAdjustModal = false;
			await invalidateAll();
		} catch (e) {
			console.error('Error adjusting stock', e);
			alert('Failed to adjust stock');
		} finally {
			isSavingAdjustment = false;
		}
	}

	function openEditInvoice(invoice: any) {
		editInvoiceId = invoice.id;
		editInvoiceNumber = invoice.invoice_number || '';
		editInvoiceDate = invoice.invoice_date || '';
		editInvoiceNotes = invoice.notes || '';
		showInvoiceEditModal = true;
	}

	async function saveInvoiceEdit() {
		isSavingInvoiceEdit = true;
		try {
			const res = await fetch('/api/tools/packing-supplies/invoice', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: editInvoiceId,
					invoice_number: editInvoiceNumber,
					invoice_date: editInvoiceDate,
					notes: editInvoiceNotes
				})
			});

			if (!res.ok) throw new Error('Failed to update invoice');

			showInvoiceEditModal = false;
			await invalidateAll();
		} catch (e) {
			console.error('Error updating invoice', e);
			alert('Failed to update invoice');
		} finally {
			isSavingInvoiceEdit = false;
		}
	}

	async function deleteInvoice(id: string) {
		if (
			!confirm(
				'Are you sure you want to delete this invoice? This action is permanent and will remove the added quantities from your current stock inventory.'
			)
		) {
			return;
		}

		try {
			const res = await fetch(`/api/tools/packing-supplies/invoice?id=${id}`, {
				method: 'DELETE'
			});
			if (!res.ok) throw new Error('Failed to delete invoice');
			await invalidateAll();
		} catch (e) {
			console.error(e);
			alert('Error deleting invoice');
		}
	}

	function openEditLine(invoiceId: string, line: any) {
		if (!line.supply_id) {
			alert(
				'Data is stale. Please do a hard refresh (Cmd+Shift+R) of the page to fetch the latest line IDs from the server before editing.'
			);
			return;
		}
		editingLineInvoiceId = invoiceId;
		editingLineSupplyId = line.supply_id;
		editLineQty = line.quantity;
		editLineTotal = Number((line.quantity * (line.unit_price || 0)).toFixed(2));
	}

	function cancelEditLine() {
		editingLineInvoiceId = null;
		editingLineSupplyId = null;
	}

	async function saveLineEdit() {
		if (editLineQty < 0) return;
		isSavingLineEdit = true;

		const unitPrice = editLineQty > 0 ? Number((editLineTotal / editLineQty).toFixed(4)) : 0;

		try {
			const res = await fetch('/api/tools/packing-supplies/invoice-line', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					invoice_id: editingLineInvoiceId,
					supply_id: editingLineSupplyId,
					quantity: editLineQty,
					unit_price: unitPrice
				})
			});

			if (!res.ok) throw new Error('Failed to update line item');

			cancelEditLine();
			await invalidateAll();
		} catch (e) {
			console.error('Error updating line item', e);
			alert('Failed to update line item');
		} finally {
			isSavingLineEdit = false;
		}
	}

	// Automatically update standard prices when supplier changes or quantity changes
	function handleQuantityChange(supplyId: string) {
		if (!selectedSupplier) return;
		const supply = data.supplies.find((s: any) => s.id === supplyId);
		if (!supply) return;

		const supplierPrice = supply.packing_supplier_prices?.find(
			(p: any) => p.supplier_id === selectedSupplier
		);
		const unitPrice = supplierPrice ? Number(supplierPrice.default_price) : 0;

		// Only auto-fill the line total if it's currently empty/null or if we are changing back to 0
		if (quantities[supplyId]) {
			// Check if the current user input is undefined, null, empty string, or exactly 0
			// (Be careful not to overwrite if they just typed £45.00)
			const currentVal = lineTotals[supplyId] as any;
			if (
				currentVal === undefined ||
				currentVal === null ||
				currentVal === 0 ||
				currentVal === ''
			) {
				lineTotals[supplyId] = Number((quantities[supplyId]! * unitPrice).toFixed(2));
			}
		} else {
			lineTotals[supplyId] = null;
		}
	}

	function handleSupplierChange(supplierId: string) {
		selectedSupplier = supplierId;
		// Reset line totals so new default prices are grabbed
		data.supplies.forEach((supply: any) => {
			if (quantities[supply.id]) {
				lineTotals[supply.id] = null;
				handleQuantityChange(supply.id);
			}
		});
	}

	// Group supplies by type
	$: groupedSupplies = {
		box: data.supplies.filter((s) => s.type === 'box'),
		tape: data.supplies.filter((s) => s.type === 'tape'),
		wrap: data.supplies.filter((s) => s.type === 'wrap'),
		bag: data.supplies.filter((s) => s.type === 'bag'),
		envelope: data.supplies.filter((s) => s.type === 'envelope')
	};

	$: invoiceTotalRaw = data.supplies.reduce((acc, supply) => {
		return acc + (Number(lineTotals[supply.id]) || 0);
	}, 0);

	$: invoiceVAT = Number((invoiceTotalRaw * 0.2).toFixed(2));
	$: invoiceTotal = Number((invoiceTotalRaw + invoiceVAT).toFixed(2));

	function getEstimatedUnitCost(supply: any) {
		// 1. Prefer Weighted Average Cost (WAC) from actual invoice history
		if (data.history && data.history.length > 0) {
			let totalQty = 0;
			let totalCost = 0;

			data.history.forEach((invoice: any) => {
				const lines = invoice.packing_invoice_lines || [];
				lines.forEach((line: any) => {
					if (line.supply_id === supply.id && line.quantity > 0) {
						totalQty += line.quantity;
						totalCost += line.quantity * Number(line.unit_price || 0);
					}
				});
			});

			if (totalQty > 0) {
				return totalCost / totalQty; // Returns accurate Weighted Average Cost
			}
		}

		// 2. Fallback: Average of configured default supplier prices
		const prices = supply.packing_supplier_prices || [];
		if (prices.length === 0) return 0;
		const sum = prices.reduce((acc: number, p: any) => acc + Number(p.default_price || 0), 0);
		return sum / prices.length;
	}

	$: totalInventoryValue = data.supplies.reduce((acc: number, supply: any) => {
		const stock = supply.current_stock || 0;
		return acc + stock * getEstimatedUnitCost(supply);
	}, 0);

	async function submitInvoice() {
		if (!selectedSupplier) {
			alert('Please select a supplier');
			return;
		}

		isSubmitting = true;

		// Filter to ONLY items that actually have a quantity inputted
		const lineItems = data.supplies
			.filter((s: any) => quantities[s.id] && quantities[s.id]! > 0)
			.map((s: any) => {
				const qty = quantities[s.id]!;
				const total = Number(lineTotals[s.id]) || 0;
				return {
					supply_id: s.id,
					quantity: qty,
					// Send unit_price to db up to 4 decimal places
					// e.g. If cost is £15.25 for 110 items, unit price is 0.1386
					unit_price: total > 0 ? Number((total / qty).toFixed(4)) : 0
				};
			});

		if (lineItems.length === 0) {
			alert('You must add a quantity to at least one item to save an invoice.');
			isSubmitting = false;
			return;
		}

		try {
			const response = await fetch('/api/tools/packing-supplies/log-invoice', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					supplier_id: selectedSupplier,
					invoice_date: invoiceDate,
					invoice_number: invoiceNumber,
					total_cost_raw: invoiceTotalRaw,
					total_vat: invoiceVAT,
					total_cost: invoiceTotal,
					notes: notes,
					items: lineItems
				})
			});

			if (!response.ok) throw new Error('Failed to save invoice');

			// Success! Reset form
			quantities = {};
			invoiceNumber = '';
			notes = '';
			alert('Invoice saved successfully!');
			// Refresh data while preserving state
			await invalidateAll();
		} catch (e) {
			console.error(e);
			alert('Error saving invoice');
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Packing Supplies</h1>
		<p class="text-muted-foreground mt-2">
			Manage box inventory, track costs, and log incoming supplier invoices.
		</p>
	</div>

	<!-- Navigation Tabs -->
	<div class="flex space-x-1 border-b pb-4">
		<button
			class="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors {activeTab ===
			'log'
				? 'bg-primary/10 text-primary'
				: 'text-muted-foreground hover:bg-muted'}"
			onclick={() => setTab('log')}
		>
			<Plus class="h-4 w-4" /> Log Arrival / Invoice
		</button>
		<button
			class="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors {activeTab ===
			'inventory'
				? 'bg-primary/10 text-primary'
				: 'text-muted-foreground hover:bg-muted'}"
			onclick={() => setTab('inventory')}
		>
			<Package class="h-4 w-4" /> Current Inventory
		</button>
		<button
			class="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors {activeTab ===
			'history'
				? 'bg-primary/10 text-primary'
				: 'text-muted-foreground hover:bg-muted'}"
			onclick={() => setTab('history')}
		>
			<ClipboardList class="h-4 w-4" /> Order History
		</button>
		<button
			class="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors {activeTab ===
			'unmapped'
				? 'bg-primary/10 text-primary'
				: 'text-muted-foreground hover:bg-muted'}"
			onclick={() => setTab('unmapped')}
		>
			<AlertCircle class="h-4 w-4" /> Unmapped ({activeUnmappedOrdersCount})
		</button>
	</div>

	<!-- Tab Panels -->
	<div class="mt-4">
		{#if activeTab === 'log'}
			<div class="bg-card text-card-foreground rounded-xl border shadow-sm p-6 w-full">
				<h2 class="text-xl font-semibold mb-4">Log New Invoice</h2>

				<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
					<div class="space-y-2 md:col-span-3">
						<label class="text-sm font-medium block" for="supplier">Supplier</label>
						<div class="flex flex-wrap gap-2">
							{#each data.suppliers as supplier}
								<button
									type="button"
									class="px-6 py-2 border rounded-md text-sm font-semibold transition-colors {selectedSupplier ===
									supplier.id
										? 'bg-primary text-primary-foreground border-primary focus:ring-2 focus:ring-primary focus:ring-offset-2'
										: 'bg-background text-foreground hover:bg-muted'}"
									onclick={() => handleSupplierChange(supplier.id)}
								>
									{supplier.name}
								</button>
							{/each}
						</div>
					</div>
					<div class="space-y-2 col-span-1 md:col-span-1 border-t xl:border-none pt-4 xl:pt-0">
						<label class="text-sm font-medium" for="invoiceDate">Invoice Date</label>
						<input
							type="date"
							id="invoiceDate"
							class="w-full border rounded-md p-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
							bind:value={invoiceDate}
						/>
					</div>
					<div class="space-y-2 col-span-1 md:col-span-2 border-t xl:border-none pt-4 xl:pt-0">
						<label class="text-sm font-medium" for="invoiceNumber">Invoice Number</label>
						<input
							type="text"
							id="invoiceNumber"
							class="w-full border rounded-md p-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
							placeholder="e.g. INV-12345"
							bind:value={invoiceNumber}
						/>
					</div>
				</div>

				<div class="space-y-4">
					<div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
						<!-- Left Column: Boxes -->
						<div class="flex flex-col gap-6">
							{#each ['box'] as type}
								{@const typeSupplies = groupedSupplies[type as keyof typeof groupedSupplies]}
								{#if typeSupplies && typeSupplies.length > 0}
									<div class="border rounded-xl shadow-sm overflow-hidden bg-background h-fit">
										<div class="bg-muted/50 px-3 py-1.5 border-b font-medium capitalize text-sm">
											Boxes
										</div>
										<div class="divide-y">
											{#each typeSupplies as supply (supply.id)}
												<div
													class="p-2 flex items-center justify-between hover:bg-muted/30 transition-colors gap-2"
												>
													<div class="min-w-0 flex-1">
														<p class="font-medium text-sm truncate" title={supply.name}>
															{supply.name}
														</p>
														<p
															class="text-[10px] text-muted-foreground truncate"
															title={supply.code}
														>
															{supply.code}
														</p>
													</div>

													<div class="flex items-center gap-2 md:gap-4 shrink-0">
														<!-- Quantity Input -->
														<div class="flex flex-col items-center">
															<span class="text-[10px] font-semibold text-muted-foreground mb-0.5"
																>Qty</span
															>
															<input
																type="number"
																min="0"
																placeholder="0"
																class="w-16 h-7 border rounded text-xs text-center focus:border-primary focus:ring-1 focus:ring-primary outline-none"
																bind:value={quantities[supply.id]}
																oninput={() => handleQuantityChange(supply.id)}
															/>
														</div>

														<!-- Price Edit -->
														<div class="flex flex-col items-center">
															<span class="text-[10px] font-semibold text-muted-foreground mb-0.5"
																>Total (£)</span
															>
															<input
																type="number"
																step="0.01"
																min="0"
																class="w-16 h-7 border rounded text-xs text-center focus:border-primary focus:ring-1 focus:ring-primary outline-none"
																bind:value={lineTotals[supply.id]}
																onblur={() => {
																	// If they tab out and left it blank, recalculate the default
																	const currentVal = lineTotals[supply.id] as any;
																	if (
																		currentVal === null ||
																		currentVal === undefined ||
																		currentVal === ''
																	) {
																		handleQuantityChange(supply.id);
																	}
																}}
															/>
														</div>

														<!-- Line Subtotal -->
														<div class="flex flex-col items-end w-14">
															<span class="text-[10px] font-semibold text-muted-foreground mb-0.5"
																>Cost / Unit</span
															>
															<div class="text-xs font-semibold h-7 flex items-center">
																£{quantities[supply.id] && Number(lineTotals[supply.id]) > 0
																	? (
																			Number(lineTotals[supply.id]) / quantities[supply.id]!
																		).toFixed(2)
																	: '0.00'}
															</div>
														</div>
													</div>
												</div>
											{/each}
										</div>
									</div>
								{/if}
							{/each}
						</div>

						<!-- Right Column: Everything Else -->
						<div class="flex flex-col gap-6">
							{#each ['tape', 'wrap', 'bag', 'envelope'] as type}
								{@const typeSupplies = groupedSupplies[type as keyof typeof groupedSupplies]}
								{#if typeSupplies && typeSupplies.length > 0}
									<div class="border rounded-xl shadow-sm overflow-hidden bg-background h-fit">
										<div class="bg-muted/50 px-3 py-1.5 border-b font-medium capitalize text-sm">
											{type}s
										</div>
										<div class="divide-y">
											{#each typeSupplies as supply (supply.id)}
												<div
													class="p-2 flex items-center justify-between hover:bg-muted/30 transition-colors gap-2"
												>
													<div class="min-w-0 flex-1">
														<p class="font-medium text-sm truncate" title={supply.name}>
															{supply.name}
														</p>
														<p
															class="text-[10px] text-muted-foreground truncate"
															title={supply.code}
														>
															{supply.code}
														</p>
													</div>

													<div class="flex items-center gap-2 md:gap-4 shrink-0">
														<!-- Quantity Input -->
														<div class="flex flex-col items-center">
															<span class="text-[10px] font-semibold text-muted-foreground mb-0.5"
																>Qty</span
															>
															<input
																type="number"
																min="0"
																placeholder="0"
																class="w-16 h-7 border rounded text-xs text-center focus:border-primary focus:ring-1 focus:ring-primary outline-none"
																bind:value={quantities[supply.id]}
																oninput={() => handleQuantityChange(supply.id)}
															/>
														</div>

														<!-- Price Edit -->
														<div class="flex flex-col items-center">
															<span class="text-[10px] font-semibold text-muted-foreground mb-0.5"
																>Total (£)</span
															>
															<input
																type="number"
																step="0.01"
																min="0"
																class="w-16 h-7 border rounded text-xs text-center focus:border-primary focus:ring-1 focus:ring-primary outline-none"
																bind:value={lineTotals[supply.id]}
																onblur={() => {
																	// If they tab out and left it blank, recalculate the default
																	const currentVal = lineTotals[supply.id] as any;
																	if (
																		currentVal === null ||
																		currentVal === undefined ||
																		currentVal === ''
																	) {
																		handleQuantityChange(supply.id);
																	}
																}}
															/>
														</div>

														<!-- Line Subtotal -->
														<div class="flex flex-col items-end w-14">
															<span class="text-[10px] font-semibold text-muted-foreground mb-0.5"
																>Cost / Unit</span
															>
															<div class="text-xs font-semibold h-7 flex items-center">
																£{quantities[supply.id] && Number(lineTotals[supply.id]) > 0
																	? (
																			Number(lineTotals[supply.id]) / quantities[supply.id]!
																		).toFixed(2)
																	: '0.00'}
															</div>
														</div>
													</div>
												</div>
											{/each}
										</div>
									</div>
								{/if}
							{/each}
						</div>
					</div>

					<!-- Footer Save Area -->
					<div
						class="mt-8 pt-6 border-t flex flex-col md:flex-row justify-between items-center gap-4"
					>
						<div class="space-y-2 w-full md:w-1/2">
							<label class="text-sm font-medium" for="notes">Notes (Optional)</label>
							<input
								type="text"
								id="notes"
								class="w-full border rounded-md p-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
								placeholder="e.g. Delivery box damaged, or special promotion applied"
								bind:value={notes}
							/>
						</div>
						<div class="flex flex-col items-end gap-1 w-full md:w-auto">
							<div class="text-sm">
								<span class="text-muted-foreground font-medium mr-2">Ex. VAT:</span>
								<span class="font-semibold">£{invoiceTotalRaw.toFixed(2)}</span>
							</div>
							<div class="text-sm">
								<span class="text-muted-foreground font-medium mr-2">VAT (20%):</span>
								<span class="font-semibold text-red-600/80">+£{invoiceVAT.toFixed(2)}</span>
							</div>
							<div class="text-lg mt-1 border-t pt-2 w-full text-right">
								<span class="text-muted-foreground font-medium mr-2">Total:</span>
								<span class="font-bold text-2xl">£{invoiceTotal.toFixed(2)}</span>
							</div>
							<Button
								class="w-full md:w-auto min-w-[200px] mt-2"
								onclick={submitInvoice}
								disabled={isSubmitting || !selectedSupplier || invoiceTotal === 0}
							>
								{isSubmitting ? 'Saving...' : 'Save Complete Invoice'}
							</Button>
						</div>
					</div>
				</div>
			</div>
		{:else if activeTab === 'inventory'}
			<div class="flex justify-between items-center mb-4">
				<div>
					<h2 class="text-xl font-semibold">Current Inventory & Catalog</h2>
					<p class="text-sm text-muted-foreground mt-1">
						Estimated Total Stock Value: <span class="font-bold text-foreground"
							>£{totalInventoryValue.toLocaleString('en-GB', {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2
							})}</span
						>
					</p>
				</div>
				<Button size="sm" onclick={openAddSupply}>
					<Plus class="h-4 w-4 mr-2" /> Add Supply
				</Button>
			</div>

			{#if showSupplyForm}
				<div class="bg-card border rounded-lg shadow-sm p-4 mb-6 relative">
					<h3 class="font-medium mb-4">{editSupplyId ? 'Edit Supply' : 'Add New Supply'}</h3>
					<div class="grid grid-cols-1 sm:grid-cols-5 gap-4 items-end">
						<div class="space-y-1 sm:col-span-1">
							<label class="text-xs font-medium" for="sName">Name</label>
							<input
								id="sName"
								type="text"
								class="w-full border rounded p-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
								bind:value={editSupplyName}
								oninput={handleNameInput}
								placeholder="e.g. 10x10x10"
							/>
						</div>
						<div class="space-y-1 sm:col-span-1">
							<label class="text-xs font-medium" for="sCode">Code/SKU</label>
							<input
								id="sCode"
								type="text"
								class="w-full border rounded p-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
								bind:value={editSupplyCode}
								oninput={handleCodeInput}
								placeholder="e.g. 10.25x10.25x10.25"
							/>
						</div>
						<div class="space-y-1 sm:col-span-1">
							<label class="text-xs font-medium" for="sType">Type</label>
							<select
								id="sType"
								class="w-full border rounded p-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
								bind:value={editSupplyType}
							>
								<option value="box">Box</option>
								<option value="tape">Tape</option>
								<option value="wrap">Wrap</option>
								<option value="bag">Bag</option>
								<option value="envelope">Envelope</option>
							</select>
						</div>
						<div class="flex gap-2 sm:col-span-2">
							<Button class="w-full" onclick={saveSupply} disabled={isSavingSupply}
								>{isSavingSupply ? 'Saving...' : 'Save'}</Button
							>
							<Button
								variant="outline"
								class="w-full"
								onclick={() => (showSupplyForm = false)}
								disabled={isSavingSupply}>Cancel</Button
							>
						</div>
					</div>
				</div>
			{/if}

			{#if showAdjustModal}
				<div
					class="bg-card border rounded-lg shadow-sm p-4 mb-6 relative border-l-4 border-l-primary"
				>
					<h3 class="font-medium mb-4">
						Adjust Stock: <span class="font-bold">{adjustSupplyName}</span>
					</h3>
					<div class="grid grid-cols-1 sm:grid-cols-6 gap-4 items-end">
						<div class="space-y-1 sm:col-span-1">
							<span class="text-xs font-medium text-muted-foreground block">Current</span>
							<div class="p-2 text-sm bg-muted rounded border border-transparent font-medium">
								{adjustCurrentStock}
							</div>
						</div>
						<div class="space-y-1 sm:col-span-1">
							<label class="text-xs font-medium" for="aNew">New Stock Count</label>
							<input
								id="aNew"
								type="number"
								min="0"
								class="w-full border rounded p-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
								bind:value={adjustNewStock}
							/>
						</div>
						<div class="space-y-1 sm:col-span-1">
							<span class="text-xs font-medium text-muted-foreground block">Adjustment</span>
							<div
								class="p-2 text-sm font-bold {adjustChangeAmount > 0
									? 'text-green-600'
									: adjustChangeAmount < 0
										? 'text-red-600'
										: 'text-muted-foreground'}"
							>
								{adjustChangeAmount > 0 ? '+' : ''}{adjustChangeAmount}
							</div>
						</div>
						<div class="space-y-1 sm:col-span-2">
							<label class="text-xs font-medium" for="aReason">Reason</label>
							<input
								id="aReason"
								type="text"
								class="w-full border rounded p-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
								bind:value={adjustReason}
								placeholder="e.g. stock take, damaged"
							/>
						</div>
						<div class="flex flex-col gap-2 sm:col-span-1">
							<Button
								size="sm"
								class="w-full"
								onclick={saveAdjustment}
								disabled={isSavingAdjustment || adjustChangeAmount === 0}
							>
								{isSavingAdjustment ? 'Saving...' : 'Save'}
							</Button>
							<Button
								size="sm"
								variant="outline"
								class="w-full"
								onclick={() => (showAdjustModal = false)}
								disabled={isSavingAdjustment}
							>
								Cancel
							</Button>
						</div>
					</div>
				</div>
			{/if}

			<div class="bg-card border rounded-lg shadow-sm overflow-hidden">
				<table class="w-full text-sm text-left">
					<thead class="bg-muted">
						<tr>
							<th class="px-4 py-3 font-semibold">Supply Name</th>
							<th class="px-4 py-3 font-semibold">SKU / Code</th>
							<th class="px-4 py-3 font-semibold">Type</th>
							<th class="px-4 py-3 font-semibold text-right">Avg Unit Cost</th>
							<th class="px-4 py-3 font-semibold text-right">Current Stock</th>
							<th class="px-4 py-3 font-semibold text-right">30d Usage</th>
							<th class="px-4 py-3 font-semibold text-right">Weeks Left</th>
							<th class="px-4 py-3 font-semibold text-right">Total Est Value</th>
							<th class="px-4 py-3 font-semibold text-right">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y">
						{#each data.supplies as supply}
							<tr class="hover:bg-muted/50">
								<td class="px-4 py-3 font-medium">{supply.name}</td>
								<td class="px-4 py-3 text-muted-foreground">{supply.code}</td>
								<td class="px-4 py-3">
									<span
										class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
									>
										{supply.type}
									</span>
								</td>
								<td class="px-4 py-3 text-right">£{getEstimatedUnitCost(supply).toFixed(4)}</td>
								<td class="px-4 py-3 text-right font-bold"
									>{Math.max(0, supply.current_stock || 0)}</td
								>
								<td class="px-4 py-3 text-right font-bold">
									{data.usageStats[supply.id] || 0}
								</td>
								<td class="px-4 py-3 text-right font-bold text-muted-foreground">
									{#if data.usageStats[supply.id] > 0}
										{(
											Math.max(0, supply.current_stock || 0) /
											(data.usageStats[supply.id] / 4.33)
										).toFixed(1)} wks
									{:else}
										-
									{/if}
								</td>
								<td class="px-4 py-3 text-right font-bold text-foreground">
									£{(
										Math.max(0, supply.current_stock || 0) * getEstimatedUnitCost(supply)
									).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
								</td>
								<td class="px-4 py-3 text-right">
									<div class="flex justify-end gap-2">
										<button
											class="text-primary hover:underline font-medium text-xs"
											onclick={() => openEditSupply(supply)}>Edit</button
										>
										<button
											class="text-primary hover:underline font-medium text-xs"
											onclick={() => openAdjustStock(supply)}>Adjust</button
										>
										<button
											class="text-red-500 hover:underline font-medium text-xs"
											onclick={() => deleteSupply(supply.id)}>Delete</button
										>
									</div>
								</td>
							</tr>
						{/each}
						{#if data.supplies.length === 0}
							<tr
								><td colspan="5" class="px-4 py-8 text-center text-muted-foreground"
									>No supplies found in database.</td
								></tr
							>
						{/if}
					</tbody>
				</table>
			</div>
		{:else if activeTab === 'history'}
			<div class="flex justify-between items-center mb-4">
				<h2 class="text-xl font-semibold">Recent Order History</h2>
			</div>

			<div class="bg-card border rounded-lg shadow-sm overflow-hidden">
				{#if showInvoiceEditModal}
					<div class="border-b p-4 relative bg-muted/30">
						<h3 class="font-medium mb-4">Edit Invoice Details</h3>
						<div class="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
							<div class="space-y-1 sm:col-span-1">
								<label class="text-xs font-medium" for="invNum">Invoice Number</label>
								<input
									id="invNum"
									type="text"
									class="w-full border rounded p-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
									bind:value={editInvoiceNumber}
								/>
							</div>
							<div class="space-y-1 sm:col-span-1">
								<label class="text-xs font-medium" for="invDate">Date</label>
								<input
									id="invDate"
									type="date"
									class="w-full border rounded p-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
									bind:value={editInvoiceDate}
								/>
							</div>
							<div class="space-y-1 sm:col-span-1">
								<label class="text-xs font-medium" for="invNotes">Notes</label>
								<input
									id="invNotes"
									type="text"
									class="w-full border rounded p-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
									bind:value={editInvoiceNotes}
								/>
							</div>
							<div class="flex gap-2 sm:col-span-1">
								<Button
									size="sm"
									class="w-full"
									onclick={saveInvoiceEdit}
									disabled={isSavingInvoiceEdit}
									>{isSavingInvoiceEdit ? 'Saving...' : 'Save'}</Button
								>
								<Button
									variant="outline"
									size="sm"
									class="w-full"
									onclick={() => (showInvoiceEditModal = false)}
									disabled={isSavingInvoiceEdit}>Cancel</Button
								>
							</div>
						</div>
					</div>
				{/if}

				{#if data.history && data.history.length > 0}
					<div class="divide-y">
						{#each data.history as invoice}
							<div class="p-4 hover:bg-muted/30 transition-colors group">
								<div class="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
									<div class="flex-1">
										<div class="flex flex-col sm:flex-row justify-between sm:items-center w-full">
											<div>
												<div class="flex items-center gap-3">
													<h4 class="font-semibold text-base">
														{invoice.packing_suppliers?.name || 'Unknown Supplier'}
													</h4>
													<div
														class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
													>
														<button
															class="text-xs text-primary hover:underline font-medium"
															onclick={() => openEditInvoice(invoice)}
														>
															Edit Header
														</button>
														<button
															class="text-xs text-red-500 hover:underline font-medium"
															onclick={() => deleteInvoice(invoice.id)}
														>
															Delete
														</button>
													</div>
												</div>
												<p class="text-xs text-muted-foreground">
													Invoice #{invoice.invoice_number || 'N/A'} • {new Date(
														invoice.invoice_date
													).toLocaleDateString()}
												</p>
											</div>
											<div class="text-left sm:text-right mt-2 sm:mt-0">
												<div class="font-bold text-lg">£{(invoice.total_cost || 0).toFixed(2)}</div>
												{#if invoice.total_vat}
													<div class="text-[10px] text-muted-foreground">
														Incl. £{invoice.total_vat.toFixed(2)} VAT
													</div>
												{/if}
											</div>
										</div>
									</div>
								</div>

								{#if invoice.notes}
									<p class="text-xs text-muted-foreground mb-3 italic">Notes: {invoice.notes}</p>
								{/if}

								<div class="bg-muted/50 rounded-md p-2 mt-4">
									<table class="w-full text-xs text-left">
										<thead class="text-muted-foreground border-b">
											<tr>
												<th class="pb-1 font-medium">Item</th>
												<th class="pb-1 font-medium text-right">Qty</th>
												<th class="pb-1 font-medium text-right">Unit Price</th>
												<th class="pb-1 font-medium text-right">Line Total</th>
												<th class="pb-1 font-medium text-right w-10"></th>
											</tr>
										</thead>
										<tbody class="divide-y divide-border/50">
											{#each invoice.packing_invoice_lines as line}
												{#if editingLineInvoiceId === invoice.id && editingLineSupplyId !== null && editingLineSupplyId === line.supply_id}
													<tr>
														<td class="py-1.5 font-medium"
															>{line.packing_supplies?.name || 'Unknown Item'}</td
														>
														<td class="py-1.5 text-right w-20">
															<input
																type="number"
																min="0"
																class="w-full border rounded text-xs p-1 text-right focus:border-primary focus:ring-1 focus:ring-primary outline-none"
																bind:value={editLineQty}
															/>
														</td>
														<td class="py-1.5 text-right">
															<span
																>£{editLineQty > 0
																	? (editLineTotal / editLineQty).toFixed(4)
																	: '0.0000'}</span
															>
														</td>
														<td class="py-1.5 text-right font-semibold w-24">
															<input
																type="number"
																step="0.01"
																min="0"
																class="w-full border rounded text-xs p-1 text-right focus:border-primary focus:ring-1 focus:ring-primary outline-none"
																bind:value={editLineTotal}
															/>
														</td>
														<td class="py-1.5 pl-3 text-right">
															<div class="flex items-center justify-end gap-2">
																<button
																	class="text-xs text-primary font-medium hover:underline"
																	onclick={saveLineEdit}
																	disabled={isSavingLineEdit}>Save</button
																>
																<button
																	class="text-xs text-muted-foreground hover:underline"
																	onclick={cancelEditLine}
																	disabled={isSavingLineEdit}>Cancel</button
																>
															</div>
														</td>
													</tr>
												{:else}
													<tr class="relative hover:bg-muted/50 transition-colors">
														<td class="py-1 font-medium"
															>{line.packing_supplies?.name || 'Unknown Item'}</td
														>
														<td class="py-1 text-right">{line.quantity}</td>
														<td class="py-1 text-right"
															>£{Number(line.unit_price || 0).toFixed(4)}</td
														>
														<td class="py-1 text-right font-semibold"
															>£{(line.quantity * (line.unit_price || 0)).toFixed(2)}</td
														>
														<td class="py-1 pl-2 text-right">
															<button
																class="text-[10px] text-muted-foreground hover:text-primary transition-colors hover:underline"
																onclick={() => openEditLine(invoice.id, line)}
															>
																Edit
															</button>
														</td>
													</tr>
												{/if}
											{/each}
										</tbody>
									</table>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="p-8 text-center text-muted-foreground">No invoice history found.</div>
				{/if}
			</div>
		{/if}

		{#if activeTab === 'unmapped'}
			<div class="bg-card text-card-foreground rounded-xl border shadow-sm p-6 w-full">
				<div class="flex justify-between items-center mb-6">
					<div>
						<h2 class="text-xl font-semibold">Missing Box Mappings</h2>
						<p class="text-sm text-muted-foreground">
							Orders created recently that failed packaging deduction because their SKUs are missing
							dimensions.
						</p>
					</div>
				</div>

				{#if data.unmappedOrders && data.unmappedOrders.length > 0}
					<div class="overflow-x-auto border rounded-xl">
						<table class="w-full text-sm text-left">
							<thead class="bg-muted text-muted-foreground">
								<tr>
									<th class="px-4 py-3 font-semibold">Order ID</th>
									<th class="px-4 py-3 font-semibold">SKU / ASIN</th>
									<th class="px-4 py-3 font-semibold">Product Title</th>
									<th class="px-4 py-3 font-semibold text-right">Actions</th>
								</tr>
							</thead>
							<tbody class="divide-y relative bg-card">
								{#each data.unmappedOrders as order}
									{#each order.items as item}
										{#if !mappedActiveSkus.includes(item.seller_sku)}
											<tr class="hover:bg-muted/30">
												<td class="px-4 py-3 font-mono">{order.amazon_order_id}</td>
												<td class="px-4 py-3 font-mono text-xs">
													<div class="font-semibold text-primary">{item.seller_sku}</div>
													<div class="text-muted-foreground">{item.asin}</div>
												</td>
												<td class="px-4 py-3 text-xs line-clamp-2 my-2">{item.title}</td>
												<td class="px-4 py-3 text-right whitespace-nowrap">
													<Button
														variant="outline"
														size="sm"
														onclick={() => openCostModal(item.seller_sku, item.asin, item.title)}
													>
														Assign Dimensions
													</Button>
												</td>
											</tr>
										{/if}
									{/each}
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<div
						class="text-center p-12 text-muted-foreground bg-muted/20 border border-dashed rounded-xl"
					>
						No unmapped orders found. All packaging logic is completely mapped!
					</div>
				{/if}
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
