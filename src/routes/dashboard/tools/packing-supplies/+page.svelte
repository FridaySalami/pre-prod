<script lang="ts">
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/shadcn/ui/button';
	import {
		Plus,
		Package,
		FileText,
		ClipboardList,
		AlertCircle,
		Maximize,
		Search,
		TrendingDown,
		PackageSearch,
		Activity,
		PieChart,
		Package2
	} from 'lucide-svelte';
	import UpdateCostModal from '$lib/components/UpdateCostModal.svelte';
	import BoxSKUListModal from '$lib/components/BoxSKUListModal.svelte';

	export let data: any = { supplies: [] };

	$: activeTab = $page.url.searchParams.get('tab') || 'log'; // 'log', 'inventory', 'history', 'unmapped', 'sku-search', 'review'

	function handleDateChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const date = input.value;
		const url = new URL($page.url);
		url.searchParams.set('date', date);
		goto(url.toString());
	}

	let showInvoiceSummaryPreview = false;

	function setTab(tab: string) {
		const url = new URL($page.url);
		url.searchParams.set('tab', tab);
		goto(url, { replaceState: true, keepFocus: true, noScroll: true });
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

	// Local mapping tracking for search tab so it updates instantly
	let searchMappingUpdates: Record<string, string> = {};

	async function handleSearchQuickAssign(sku: string, newBoxCode: string) {
		await quickAssignBox(sku, newBoxCode);
		searchMappingUpdates[sku] = newBoxCode;
		searchMappingUpdates = { ...searchMappingUpdates };
	}

	async function handleQuickAssign(sku: string, newBoxCode: string) {
		await quickAssignBox(sku, newBoxCode);
		// Local update for unmapped table is handled by the mappedActiveSkus array in quickAssignBox
		// but we add this for clarity/consistency
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

	// Optimization: Store prices in a reactive object to avoid repeated lookups
	let unitPrices: Record<string, number> = {};
	$: if (selectedSupplier && data.supplies) {
		const newPrices: Record<string, number> = {};
		data.supplies.forEach((s: any) => {
			// Search the nested array (from packing_supplier_prices table) for a matching supplier_id
			const priceEntry = (s.packing_supplier_prices || []).find(
				(p: any) => p.supplier_id === selectedSupplier
			);
			newPrices[s.id] = priceEntry ? Number(priceEntry.default_price) : 0;
		});
		unitPrices = newPrices;
	}

	function handleQuantityChange(supplyId: string) {
		const price = unitPrices[supplyId] || 0;
		const qty = quantities[supplyId];

		if (qty !== null && qty !== undefined && qty > 0) {
			lineTotals[supplyId] = Number((qty * price).toFixed(2));
		} else {
			lineTotals[supplyId] = null;
		}

		// Trigger Svelte reactivity for objects
		lineTotals = { ...lineTotals };
	}

	function handleTotalManualChange(supplyId: string) {
		// Just trigger reactivity
		lineTotals = { ...lineTotals };
	}

	function handleSupplierChange(supplierId: string) {
		selectedSupplier = supplierId;

		// Auto-prefix invoice number based on supplier
		const supplier = data.suppliers.find((s: any) => s.id === supplierId);
		if (supplier) {
			const name = supplier.name.toLowerCase();
			const ukPrefix = 'S';
			const kitePrefix = 'SW';

			// If current value is empty, or if it matches one of the known prefixes, update it
			if (!invoiceNumber || invoiceNumber === ukPrefix || invoiceNumber === kitePrefix) {
				if (name.includes('uk packaging')) {
					invoiceNumber = ukPrefix;
				} else if (name.includes('kite packaging')) {
					invoiceNumber = kitePrefix;
				} else if (invoiceNumber === ukPrefix || invoiceNumber === kitePrefix) {
					// Clear the prefix if we switched to a supplier that doesn't use these
					invoiceNumber = '';
				}
			}
		}

		// Wait for unitPrices to update then refresh totals
		setTimeout(() => {
			Object.keys(quantities).forEach((id) => {
				if (quantities[id]) handleQuantityChange(id);
			});
		}, 0);
	}

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

	// Reassignment Modal State
	let showReassignModal = false;
	let reassignBoxCode = '';

	// Toast notification state
	let toastNotifications: {
		id: string;
		message: string;
		type: 'success' | 'error' | 'info' | 'warning';
	}[] = [];

	function addToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
		const id = Math.random().toString(36).substring(2, 9);
		toastNotifications = [...toastNotifications, { id, message, type }];
		setTimeout(() => {
			toastNotifications = toastNotifications.filter((t) => t.id !== id);
		}, 3000);
	}

	function openReassignModal(boxCode: string) {
		reassignBoxCode = boxCode;
		showReassignModal = true;
	}

	function handleReassignSuccess(sku: string | undefined) {
		if (sku) {
			mappedActiveSkus = [...mappedActiveSkus, sku];
		}
		// Invalidate is overkill but ensures everything is fresh if they reassign everything
		invalidateAll();
	}

	async function quickAssignBox(sku: string, newBoxCode: string) {
		if (!newBoxCode) return;

		console.log(`[UI DEBUG] Assigning ${sku} to box ${newBoxCode}...`);

		try {
			const res = await fetch('/api/tools/packing-supplies/reassign', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sku, newBoxCode })
			});

			const responseData = await res.json();
			console.log(`[UI DEBUG] Server response for ${sku}:`, responseData);

			if (res.ok) {
				mappedActiveSkus = [...mappedActiveSkus, sku];
				console.log(`[UI DEBUG] SKU ${sku} added to mappedActiveSkus list.`);

				const supplyName =
					data.supplies.find((s: any) => s.code === newBoxCode)?.name || newBoxCode;
				addToast(`Assigned ${sku} to ${supplyName}`, 'success');

				// Force refresh the data to update the Review tab view
				invalidateAll();
			} else {
				console.error(`[UI DEBUG] Error response mapping ${sku}:`, responseData);
				addToast(responseData.error || 'Failed to assign box size', 'error');
			}
		} catch (e) {
			console.error(`[UI DEBUG] Fetch exception mapping ${sku}:`, e);
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
			?.flatMap((o: any) => o.items)
			.filter(
				(i: any) =>
					i.costs?.boxCode !== '0x0x0' &&
					i.costs?.boxReason !== 'Mapped' &&
					!mappedActiveSkus.includes(i.seller_sku)
			).length || 0;

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

	// Group supplies by type
	$: groupedSupplies = {
		box: data.supplies.filter((s: any) => s.type === 'box'),
		tape: data.supplies.filter((s: any) => s.type === 'tape'),
		wrap: data.supplies.filter((s: any) => s.type === 'wrap'),
		bag: data.supplies.filter((s: any) => s.type === 'bag'),
		envelope: data.supplies.filter((s: any) => s.type === 'envelope')
	};

	$: invoiceTotalRaw = data.supplies.reduce((acc: number, supply: any) => {
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

	function getUsage30d(supplyId: string) {
		const avg2d = (data.usageStats2d?.[supplyId] || 0) / 2;
		const avg7d = (data.usageStats7d?.[supplyId] || 0) / 7;
		return Math.max(avg2d, avg7d) * 30;
	}

	function getActualUsage(supplyId: string) {
		return data.usageStats30d?.[supplyId] || 0;
	}

	$: totalProjectedSpend30d = data.supplies.reduce((acc: number, supply: any) => {
		const usage30d = getUsage30d(supply.id);
		const unitCost = getEstimatedUnitCost(supply);
		return acc + usage30d * unitCost;
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

	// Ranking/Sorting state for Inventory tab
	let sortColumn = 'totalProjectedSpend30d'; // Default to highest impact
	let sortDirection = -1; // -1 for desc, 1 for asc

	function toggleSort(column: string) {
		if (sortColumn === column) {
			sortDirection *= -1;
		} else {
			sortColumn = column;
			sortDirection = -1; // Default to desc for new column
		}
	}

	$: sortedSupplies = [...data.supplies].sort((a: any, b: any) => {
		let valA: any;
		let valB: any;

		const costA = getEstimatedUnitCost(a);
		const costB = getEstimatedUnitCost(b);
		const usageA = getUsage30d(a.id);
		const usageB = getUsage30d(b.id);

		switch (sortColumn) {
			case 'name':
				valA = a.name;
				valB = b.name;
				break;
			case 'type':
				valA = a.type;
				valB = b.type;
				break;
			case 'unitCost':
				valA = costA;
				valB = costB;
				break;
			case 'stock':
				valA = a.current_stock || 0;
				valB = b.current_stock || 0;
				break;
			case 'usage30d':
				valA = usageA;
				valB = usageB;
				break;
			case 'dailyAvg':
				valA = usageA / 30;
				valB = usageB / 30;
				break;
			case 'totalProjectedSpend30d':
				valA = usageA * costA;
				valB = usageB * costB;
				break;
			case 'weeksRemaining':
				valA = usageA > 0 ? (a.current_stock || 0) / (usageA / 30) : 999999;
				valB = usageB > 0 ? (b.current_stock || 0) / (usageB / 30) : 999999;
				break;
			case 'totalValue':
				valA = (a.current_stock || 0) * costA;
				valB = (b.current_stock || 0) * costB;
				break;
			default:
				valA = a.name;
				valB = b.name;
		}

		if (valA < valB) return -1 * sortDirection;
		if (valA > valB) return 1 * sortDirection;
		return 0;
	});

	// Metrics Calculations
	$: totalBoxesUsed30d = data.supplies.reduce((acc: number, s: any) => acc + getUsage30d(s.id), 0);
	$: highestUsageBox = [...data.supplies].sort((a, b) => getUsage30d(b.id) - getUsage30d(a.id))[0];
	$: highestCostDriver = [...data.supplies].sort(
		(a, b) =>
			getUsage30d(b.id) * getEstimatedUnitCost(b) - getUsage30d(a.id) * getEstimatedUnitCost(a)
	)[0];

	// Summary values for Pareto/Stats
	$: runningUsageSum = 0;
	$: sortedByUsage = [...data.supplies].sort((a, b) => getUsage30d(b.id) - getUsage30d(a.id));

	// NEW: Operational calculation helpers
	const TARGET_COVERAGE_DAYS = 30;

	function getReorderQty(supply: any) {
		const dailyBurn = getUsage30d(supply.id) / 30;
		if (dailyBurn <= 0) return 0;
		const needed = dailyBurn * TARGET_COVERAGE_DAYS;
		const stock = Math.max(0, supply.current_stock || 0);
		return Math.max(0, Math.ceil(needed - stock));
	}

	function getRunOutDate(supply: any) {
		const dailyBurn = getUsage30d(supply.id) / 30;
		if (dailyBurn <= 0) return null;
		const daysLeft = (supply.current_stock || 0) / dailyBurn;
		const date = new Date();
		date.setDate(date.getDate() + Math.round(daysLeft));
		return date;
	}

	function getConfidence(supplyId: string) {
		const days = data.daysOfData || 0;
		if (days >= 14) return { label: 'High', color: 'text-emerald-600' };
		if (days >= 4) return { label: 'Med', color: 'text-amber-600' };
		return { label: 'Low', color: 'text-red-500' };
	}

	function getUsageTrend(supplyId: string) {
		const current = data.usageStats3d?.[supplyId] || 0;
		const previous = data.usageStatsPrev3d?.[supplyId] || 0;

		// 10% threshold to avoid noise
		const threshold = 0.1;

		if (current > previous * (1 + threshold) && current > 0)
			return { icon: '▲', color: 'text-red-500', label: 'Rising' };
		if (current < previous * (1 - threshold) && previous > 0)
			return { icon: '▼', color: 'text-emerald-500', label: 'Falling' };
		return { icon: '', color: 'text-muted-foreground', label: 'Stable' };
	}

	function getReorderCost(supply: any) {
		const qty = getReorderQty(supply);
		const cost = getEstimatedUnitCost(supply);
		return qty * cost;
	}

	function getLastPaidPrice(supplyId: string) {
		if (!data.history || data.history.length === 0) return null;

		// Sort history by date descending (already likely sorted, but to be sure)
		const sortedHistory = [...data.history].sort(
			(a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime()
		);

		for (const invoice of sortedHistory) {
			const line = (invoice.packing_invoice_lines || []).find(
				(l: any) => l.supply_id === supplyId && (l.quantity || 0) > 0
			);
			if (line) return Number(line.unit_price || 0);
		}
		return null;
	}

	// Dynamic Quick Filters
	let filterMode: 'all' | 'critical' | 'high-spend' | 'high-usage' | 'reorder' = 'all';

	$: filteredSupplies = sortedSupplies.filter((s) => {
		if (filterMode === 'all') return true;
		const dailyBurn = getUsage30d(s.id) / 30;
		const daysLeft = dailyBurn > 0 ? (s.current_stock || 0) / dailyBurn : 999;
		const spend = getUsage30d(s.id) * getEstimatedUnitCost(s);
		const usage = getUsage30d(s.id);
		const reorderQty = getReorderQty(s);

		if (filterMode === 'critical') return daysLeft < 7;
		if (filterMode === 'high-spend') return spend > totalProjectedSpend30d * 0.1; // Top 10% spenders
		if (filterMode === 'high-usage') return usage > totalBoxesUsed30d * 0.1;
		if (filterMode === 'reorder') return reorderQty > 0;

		return true;
	});

	// Top Risk Items Calculation
	$: topRiskItems = sortedSupplies
		.map((s) => {
			const dailyBurn = getUsage30d(s.id) / 30;
			const daysLeft = dailyBurn > 0 ? (s.current_stock || 0) / dailyBurn : 999;
			const reorderQty = getReorderQty(s);
			return { ...s, daysLeft, reorderQty };
		})
		.filter((s) => s.daysLeft < 14)
		.sort((a, b) => a.daysLeft - b.daysLeft)
		.slice(0, 3);

	// Invoice History Stats & Filters
	let historySearch = '';
	let historySupplierFilter = 'all';
	let historyDateRange = '90'; // 30, 90, 365, all

	$: filteredHistory = (data.history || []).filter((inv: any) => {
		// Supplier Filter
		if (historySupplierFilter !== 'all' && inv.supplier_id !== historySupplierFilter) return false;

		// Search Filter
		if (historySearch) {
			const search = historySearch.toLowerCase();
			const supplierName = (inv.packing_suppliers?.name || '').toLowerCase();
			const invNum = (inv.invoice_number || '').toLowerCase();
			const hasItem = (inv.packing_invoice_lines || []).some((l: any) =>
				(l.packing_supplies?.name || '').toLowerCase().includes(search)
			);
			if (!supplierName.includes(search) && !invNum.includes(search) && !hasItem) return false;
		}

		// Date Filter
		if (historyDateRange !== 'all') {
			const days = parseInt(historyDateRange);
			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - days);
			if (new Date(inv.invoice_date) < cutoff) return false;
		}

		return true;
	});

	$: historySpend30d = (data.history || [])
		.filter((inv: any) => {
			const cutoff = new Date();
			cutoff.setDate(cutoff.getDate() - 30);
			return new Date(inv.invoice_date) >= cutoff;
		})
		.reduce((acc: number, inv: any) => acc + (Number(inv.total_cost_raw) || 0), 0);

	$: historySpendPrev30d = (data.history || [])
		.filter((inv: any) => {
			const now = new Date();
			const start = new Date();
			start.setDate(now.getDate() - 60);
			const end = new Date();
			end.setDate(now.getDate() - 30);
			const date = new Date(inv.invoice_date);
			return date >= start && date < end;
		})
		.reduce((acc: number, inv: any) => acc + (Number(inv.total_cost_raw) || 0), 0);

	function getPriceComparison(supplyId: string, currentPrice: number, currentDate: string) {
		const history = data.history || [];
		// Find the most recent invoice BEFORE this one that contains this supply
		const prevInvoice = history
			.filter((inv: any) => new Date(inv.invoice_date) < new Date(currentDate))
			.sort(
				(a: any, b: any) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime()
			)
			.find((inv: any) =>
				(inv.packing_invoice_lines || []).some(
					(l: any) => l.supply_id === supplyId && (l.quantity || 0) > 0
				)
			);

		if (!prevInvoice) return null;

		const prevLine = prevInvoice.packing_invoice_lines.find((l: any) => l.supply_id === supplyId);
		const prevPrice = Number(prevLine.unit_price || 0);

		if (prevPrice === 0) return null;

		const diff = currentPrice - prevPrice;
		const percent = (diff / prevPrice) * 100;

		return { diff, percent, prevPrice };
	}

	function getBundleInfo(supply: any, qty: number) {
		if (!supply) return null;
		const name = supply.name.toLowerCase();
		if (name.includes('9x6x6')) return Math.ceil(qty / 120) + ' bundles';
		if (name.includes('6x6x6')) return Math.ceil(qty / 150) + ' bundles';
		if (name.includes('12x9x6')) return Math.ceil(qty / 75) + ' bundles';
		if (supply.type === 'tape') return Math.ceil(qty / 6) + ' packs';
		return null;
	}

	function getStockAfter(supplyId: string, invoiceDate: string) {
		// This is a simplified calculation: Current Stock - (Total Usage since Invoice)
		// It's not 100% accurate without a full audit log but gives a good "Warehouse Impact" feel
		const supply = data.supplies.find((s: any) => s.id === supplyId);
		if (!supply) return 0;

		const daysSince =
			(new Date().getTime() - new Date(invoiceDate).getTime()) / (1000 * 60 * 60 * 24);
		const dailyBurn = getUsage30d(supplyId) / 30;
		const usageSince = Math.max(0, daysSince * dailyBurn);

		return Math.round((supply.current_stock || 0) + usageSince);
	}

	$: totalReorderCost = data.supplies.reduce((acc: number, s: any) => acc + getReorderCost(s), 0);
</script>

<div class="flex flex-col gap-6 p-6 max-w-[1600px] mx-auto w-full">
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
			<PackageSearch class="h-4 w-4" /> Review
		</button>
	</div>

	<!-- Tab Panels -->
	<div class="mt-4">
		{#if activeTab === 'log'}
			<div class="bg-card text-card-foreground rounded-xl border shadow-sm p-6 w-full relative">
				<div
					class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 sticky top-0 z-30 bg-card/95 backdrop-blur-sm pb-4 border-b -mx-6 px-6"
				>
					<div>
						<h2 class="text-xl font-semibold">Log New Invoice</h2>
						{#if !selectedSupplier}
							<p class="text-xs text-red-500 font-medium">Please select a supplier to begin</p>
						{:else if invoiceTotalRaw === 0}
							<p class="text-xs text-amber-600 font-medium">Add quantities to items below</p>
						{/if}
					</div>

					<div class="flex items-center gap-4 bg-muted/30 px-4 py-2 rounded-lg border">
						<div class="flex flex-col items-end border-r pr-4">
							<span class="text-[10px] uppercase font-bold text-muted-foreground">Ex. VAT</span>
							<span class="text-lg font-bold">£{invoiceTotalRaw.toFixed(2)}</span>
						</div>
						<div class="flex flex-col items-end">
							<span class="text-[10px] uppercase font-bold text-muted-foreground"
								>Total (Inc. VAT)</span
							>
							<span class="text-xl font-black text-primary">£{invoiceTotal.toFixed(2)}</span>
						</div>
						<Button
							size="sm"
							class="ml-2 shadow-sm"
							onclick={submitInvoice}
							disabled={isSubmitting || !selectedSupplier || invoiceTotal === 0}
						>
							{isSubmitting ? 'Saving...' : 'Save Invoice'}
						</Button>
					</div>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
					<div class="space-y-2 md:col-span-3">
						<label class="text-sm font-medium block" for="supplier">Supplier</label>
						<div class="flex flex-wrap gap-2">
							{#each data.suppliers as supplier}
								<button
									type="button"
									class="px-6 py-2 border rounded-md text-sm font-semibold transition-colors {selectedSupplier ===
									supplier.id
										? 'bg-primary text-primary-foreground border-primary'
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
												{@const current = unitPrices[supply.id] || 0}
												{@const last = getLastPaidPrice(supply.id)}
												{@const isEdited =
													quantities[supply.id] &&
													lineTotals[supply.id] !== null &&
													Math.abs(
														Number(lineTotals[supply.id]) -
															(quantities[supply.id] || 0) * (unitPrices[supply.id] || 0)
													) > 0.01}
												<div
													class="p-2 flex items-center justify-between {quantities[supply.id]
														? 'bg-primary/5'
														: 'opacity-60'} hover:bg-muted/30 transition-colors gap-2"
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
														<!-- Price Display (Procurement Tool improvement) -->
														<div class="flex flex-col items-center min-w-20">
															<span class="text-[10px] font-semibold text-muted-foreground mb-0.5"
																>Unit Spend</span
															>
															<div class="flex flex-col items-center leading-none mt-0.5">
																<div class="text-[11px] font-bold text-muted-foreground">
																	{selectedSupplier ? '£' + current.toFixed(2) : '--'}
																</div>
																{#if selectedSupplier && last !== null}
																	<div class="flex items-center gap-1 mt-0.5">
																		<span class="text-[8px] text-muted-foreground shrink-0"
																			>Last: £{last.toFixed(2)}</span
																		>
																		{#if Math.abs(current - last) > 0.005}
																			{@const diff = ((current - last) / last) * 100}
																			<span
																				class="text-[8px] font-black {diff > 0
																					? 'text-red-500'
																					: 'text-emerald-500'}"
																			>
																				{diff > 0 ? '↑' : '↓'}{Math.abs(diff).toFixed(1)}%
																			</span>
																		{/if}
																	</div>
																{/if}
															</div>
														</div>

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
																class="w-16 h-7 border rounded text-xs text-center focus:border-primary focus:ring-1 focus:ring-primary outline-none {isEdited
																	? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
																	: ''}"
																bind:value={lineTotals[supply.id]}
																oninput={() => handleTotalManualChange(supply.id)}
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
																£{quantities[supply.id] &&
																quantities[supply.id]! > 0 &&
																Number(lineTotals[supply.id]) > 0
																	? (
																			Number(lineTotals[supply.id]) / quantities[supply.id]!
																		).toFixed(2)
																	: (unitPrices[supply.id] || 0).toFixed(2)}
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
												{@const current = unitPrices[supply.id] || 0}
												{@const last = getLastPaidPrice(supply.id)}
												{@const isEdited =
													quantities[supply.id] &&
													lineTotals[supply.id] !== null &&
													Math.abs(
														Number(lineTotals[supply.id]) -
															(quantities[supply.id] || 0) * (unitPrices[supply.id] || 0)
													) > 0.01}
												<div
													class="p-2 flex items-center justify-between {quantities[supply.id]
														? 'bg-primary/5'
														: 'opacity-60'} hover:bg-muted/30 transition-colors gap-2"
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
														<!-- Price Display (Procurement Tool improvement) -->
														<div class="flex flex-col items-center min-w-20">
															<span class="text-[10px] font-semibold text-muted-foreground mb-0.5"
																>Unit Spend</span
															>
															<div class="flex flex-col items-center leading-none mt-0.5">
																<div class="text-[11px] font-bold text-muted-foreground">
																	{selectedSupplier ? '£' + current.toFixed(2) : '--'}
																</div>
																{#if selectedSupplier && last !== null}
																	<div class="flex items-center gap-1 mt-0.5">
																		<span class="text-[8px] text-muted-foreground shrink-0"
																			>Last: £{last.toFixed(2)}</span
																		>
																		{#if Math.abs(current - last) > 0.005}
																			{@const diff = ((current - last) / last) * 100}
																			<span
																				class="text-[8px] font-black {diff > 0
																					? 'text-red-500'
																					: 'text-emerald-500'}"
																			>
																				{diff > 0 ? '↑' : '↓'}{Math.abs(diff).toFixed(1)}%
																			</span>
																		{/if}
																	</div>
																{/if}
															</div>
														</div>

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
																class="w-16 h-7 border rounded text-xs text-center focus:border-primary focus:ring-1 focus:ring-primary outline-none {isEdited
																	? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
																	: ''}"
																bind:value={lineTotals[supply.id]}
																oninput={() => handleTotalManualChange(supply.id)}
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
																£{quantities[supply.id] &&
																quantities[supply.id]! > 0 &&
																Number(lineTotals[supply.id]) > 0
																	? (
																			Number(lineTotals[supply.id]) / quantities[supply.id]!
																		).toFixed(2)
																	: (unitPrices[supply.id] || 0).toFixed(2)}
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

					<!-- Compact Summary Preview -->
					{#if invoiceTotalRaw > 0}
						<div class="mt-6 border rounded-xl overflow-hidden bg-muted/20">
							<button
								class="w-full px-4 py-2 flex items-center justify-between text-sm font-bold bg-muted/40 hover:bg-muted/60 transition-colors"
								onclick={() => (showInvoiceSummaryPreview = !showInvoiceSummaryPreview)}
							>
								<div class="flex items-center gap-2">
									<ClipboardList class="h-4 w-4 text-primary" />
									<span>Invoice Summary Preview</span>
									<span class="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px]"
										>{Object.values(quantities).filter((q) => q && q > 0).length} Items</span
									>
								</div>
								<span>{showInvoiceSummaryPreview ? 'Hide' : 'Show'}</span>
							</button>

							{#if showInvoiceSummaryPreview}
								<div class="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
									{#each data.supplies as supply}
										{#if quantities[supply.id] && quantities[supply.id]! > 0}
											<div
												class="flex items-center justify-between p-2 bg-background rounded-lg border text-xs"
											>
												<div class="min-w-0 pr-2">
													<p class="font-bold truncate">{supply.name}</p>
													<p class="text-[10px] text-muted-foreground">
														£{(Number(lineTotals[supply.id]) / quantities[supply.id]!).toFixed(2)} ea
													</p>
												</div>
												<div class="text-right whitespace-nowrap">
													<p class="font-black text-primary">×{quantities[supply.id]}</p>
													<p class="font-bold">£{Number(lineTotals[supply.id]).toFixed(2)}</p>
												</div>
											</div>
										{/if}
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{:else if activeTab === 'inventory'}
			<!-- KPI Summary Panel -->
			<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
				<!-- Top Risk Items (New Highlight) -->
				<div
					class="bg-card border-2 border-red-500 rounded-xl p-4 shadow-sm flex flex-col justify-between overflow-hidden relative"
				>
					<div class="flex items-center gap-2 text-red-600 mb-2 relative z-10">
						<AlertCircle class="h-4 w-4" />
						<span class="text-xs font-black uppercase tracking-wider">Top Risk Items</span>
					</div>
					<div class="flex flex-col gap-1 relative z-10 h-full justify-center">
						{#each topRiskItems as item}
							<div class="flex justify-between items-center text-xs group">
								<span class="font-bold truncate max-w-[120px]">{item.name}</span>
								<div class="flex gap-2">
									<span class="text-red-700 font-black">
										{Math.round(item.daysLeft)}d
									</span>
									<span class="text-slate-500 font-bold border-l pl-2 text-[10px]">
										+{getReorderQty(item)}
									</span>
								</div>
							</div>
						{:else}
							<span class="text-xs text-muted-foreground italic">No critical risk items.</span>
						{/each}
					</div>
					<div
						class="absolute -right-4 -bottom-4 text-red-100/50 scale-[2.5] opacity-50 select-none pointer-events-none"
					>
						<TrendingDown class="h-24 w-24" />
					</div>
				</div>

				<div class="bg-card border rounded-xl p-4 shadow-sm flex flex-col justify-between">
					<div class="flex items-center gap-2 text-muted-foreground mb-1">
						<PackageSearch class="h-4 w-4 text-blue-500" />
						<span class="text-xs font-semibold uppercase tracking-wider">Stock Valuation</span>
					</div>
					<div class="flex flex-col">
						<div class="flex items-baseline gap-2">
							<span class="text-2xl font-bold"
								>£{totalInventoryValue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</span
							>
						</div>
						<div class="mt-1 flex items-center gap-2">
							<span
								class="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded font-medium"
								>PKR Cost: £{(totalProjectedSpend30d / (totalBoxesUsed30d || 1)).toFixed(2)} /order</span
							>
						</div>
					</div>
				</div>

				<div class="bg-card border rounded-xl p-4 shadow-sm flex flex-col justify-between">
					<div class="flex items-center gap-2 text-muted-foreground mb-1">
						<Activity class="h-4 w-4 text-purple-500" />
						<span class="text-xs font-semibold uppercase tracking-wider"
							>Reorder Spend (Next 30d)</span
						>
					</div>
					<div class="flex flex-col">
						<div class="flex items-baseline gap-2">
							<span class="text-2xl font-bold"
								>£{totalReorderCost.toLocaleString('en-GB', {
									maximumFractionDigits: 0
								})}</span
							>
							<span class="text-xs text-muted-foreground italic">Forecast</span>
						</div>
						<div class="mt-1 flex items-center gap-1.5">
							<span class="text-[10px] uppercase font-bold text-muted-foreground">Confidence:</span>
							<span class="text-[10px] font-bold {getConfidence('').color}"
								>{getConfidence('').label}</span
							>
						</div>
					</div>
				</div>

				<div class="bg-card border rounded-xl p-4 shadow-sm flex flex-col justify-between">
					<div class="flex items-center gap-2 text-muted-foreground mb-1">
						<PieChart class="h-4 w-4 text-amber-500" />
						<span class="text-xs font-semibold uppercase tracking-wider">Packaging Efficiency</span>
					</div>
					<div class="flex items-baseline gap-2">
						<span class="text-2xl font-bold">
							{sortedSupplies.filter((s) => {
								const usage = getUsage30d(s.id);
								const unitCost = getEstimatedUnitCost(s);
								const spend = usage * unitCost;
								const idx = sortedByUsage.findIndex((item) => item.id === s.id);
								if (idx === -1) return false;
								let cumSum = 0;
								for (let i = 0; i <= idx; i++) {
									const usageB = getUsage30d(sortedByUsage[i].id);
									const costB = getEstimatedUnitCost(sortedByUsage[i]);
									cumSum += usageB * costB;
								}
								return cumSum / totalProjectedSpend30d <= 0.8;
							}).length}
						</span>
						<span class="text-xs text-muted-foreground">Key Drivers (Pareto A)</span>
					</div>
				</div>
			</div>

			<div class="flex justify-between items-center mb-6">
				<div class="flex gap-2">
					<button
						class="px-3 py-1.5 rounded-md text-xs font-bold transition-all border {filterMode ===
						'all'
							? 'bg-primary text-primary-foreground border-primary shadow-sm'
							: 'bg-background text-muted-foreground hover:bg-muted border-input'}"
						onclick={() => (filterMode = 'all')}
					>
						All Supplies ({data.supplies.length})
					</button>
					<button
						class="px-3 py-1.5 rounded-md text-xs font-bold transition-all border {filterMode ===
						'critical'
							? 'bg-red-600 text-white border-red-600 shadow-sm animate-pulse'
							: 'bg-background text-red-600 hover:bg-red-50 border-red-200'}"
						onclick={() => (filterMode = 'critical')}
					>
						Critical &lt; 7d
					</button>
					<button
						class="px-3 py-1.5 rounded-md text-xs font-bold transition-all border {filterMode ===
						'reorder'
							? 'bg-red-100 text-red-800 border-red-200'
							: 'bg-background text-red-800 hover:bg-red-50 border-input'}"
						onclick={() => (filterMode = 'reorder')}
					>
						Reorder Needed
					</button>
					<button
						class="px-3 py-1.5 rounded-md text-xs font-bold transition-all border {filterMode ===
						'high-spend'
							? 'bg-amber-100 text-amber-800 border-amber-200'
							: 'bg-background text-amber-800 hover:bg-amber-50 border-input'}"
						onclick={() => (filterMode = 'high-spend')}
					>
						High Spend
					</button>
					<button
						class="px-3 py-1.5 rounded-md text-xs font-bold transition-all border {filterMode ===
						'high-usage'
							? 'bg-blue-100 text-blue-800 border-blue-200'
							: 'bg-background text-blue-800 hover:bg-blue-50 border-input'}"
						onclick={() => (filterMode = 'high-usage')}
					>
						High Usage
					</button>
				</div>
				<Button size="sm" onclick={openAddSupply}>
					<Plus class="h-4 w-4 mr-2" /> Add Supply
				</Button>
			</div>

			{#if showSupplyForm && !editSupplyId}
				<div class="bg-card border rounded-lg shadow-sm p-4 mb-6 relative">
					<h3 class="font-medium mb-4">Add New Supply</h3>
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

			<div class="bg-card border rounded-lg shadow-sm overflow-hidden">
				<table class="w-full text-sm text-left border-collapse">
					<thead class="bg-muted sticky top-0 z-20 shadow-sm">
						<tr>
							<th
								class="px-4 py-3 font-semibold cursor-pointer hover:bg-muted-foreground/10 select-none"
								onclick={() => toggleSort('name')}
							>
								<div class="flex items-center gap-1">
									Supply Name
									{#if sortColumn === 'name'}
										<span class="text-[10px]">{sortDirection === 1 ? '↑' : '↓'}</span>
									{/if}
								</div>
							</th>
							<th class="px-4 py-3 font-semibold">SKU / Code</th>
							<th
								class="px-4 py-3 font-semibold cursor-pointer hover:bg-muted-foreground/10 select-none"
								onclick={() => toggleSort('type')}
							>
								<div class="flex items-center gap-1">
									Type
									{#if sortColumn === 'type'}
										<span class="text-[10px]">{sortDirection === 1 ? '↑' : '↓'}</span>
									{/if}
								</div>
							</th>
							<th
								class="px-4 py-3 font-semibold text-right cursor-pointer hover:bg-muted-foreground/10 select-none"
								onclick={() => toggleSort('unitCost')}
							>
								<div class="flex items-center justify-end gap-1">
									Avg Unit Cost
									{#if sortColumn === 'unitCost'}
										<span class="text-[10px]">{sortDirection === 1 ? '↑' : '↓'}</span>
									{/if}
								</div>
							</th>
							<th
								class="px-4 py-3 font-semibold text-right cursor-pointer hover:bg-muted-foreground/10 select-none"
								onclick={() => toggleSort('stock')}
							>
								<div class="flex items-center justify-end gap-1">
									Current Stock
									{#if sortColumn === 'stock'}
										<span class="text-[10px]">{sortDirection === 1 ? '↑' : '↓'}</span>
									{/if}
								</div>
							</th>
							<th
								class="px-4 py-3 font-semibold text-right cursor-pointer hover:bg-muted-foreground/10 select-none"
								onclick={() => toggleSort('usage30d')}
							>
								<div class="flex items-center justify-end gap-1">
									Actual Usage ({data.daysOfData}d)
									{#if sortColumn === 'usage30d'}
										<span class="text-[10px]">{sortDirection === 1 ? '↑' : '↓'}</span>
									{/if}
								</div>
							</th>
							<th
								class="px-4 py-3 font-semibold text-right cursor-pointer hover:bg-muted-foreground/10 select-none"
								onclick={() => toggleSort('totalProjectedSpend30d')}
							>
								<div class="flex items-center justify-end gap-1">
									30d Spend (Proj)
									{#if sortColumn === 'totalProjectedSpend30d'}
										<span class="text-[10px]">{sortDirection === 1 ? '↑' : '↓'}</span>
									{/if}
								</div>
							</th>
							<th class="px-4 py-3 font-semibold text-right">Burn Rate</th>
							<th
								class="px-4 py-3 font-semibold text-right cursor-pointer hover:bg-muted-foreground/10 select-none"
								onclick={() => toggleSort('weeksRemaining')}
							>
								<div class="flex items-center justify-end gap-1 text-red-600">
									Days Left
									{#if sortColumn === 'weeksRemaining'}
										<span class="text-[10px]">{sortDirection === 1 ? '↑' : '↓'}</span>
									{/if}
								</div>
							</th>
							<th class="px-4 py-3 font-semibold text-right">Run Out</th>
							<th class="px-4 py-3 font-semibold text-right text-primary">Reorder Qty</th>
							<th
								class="px-4 py-3 font-semibold text-right cursor-pointer hover:bg-muted-foreground/10 select-none"
								onclick={() => toggleSort('totalValue')}
							>
								<div class="flex items-center justify-end gap-1">
									Stock Value
									{#if sortColumn === 'totalValue'}
										<span class="text-[10px]">{sortDirection === 1 ? '↑' : '↓'}</span>
									{/if}
								</div>
							</th>
							<th class="px-4 py-3 font-semibold text-right">Impact %</th>
							<th class="px-4 py-3 font-semibold text-right whitespace-nowrap min-w-[210px]"
								>Actions</th
							>
						</tr>
					</thead>
					<tbody class="divide-y">
						{#each filteredSupplies as supply}
							{@const unitCost = getEstimatedUnitCost(supply)}
							{@const usage30d = getUsage30d(supply.id)}
							{@const dailyBurn = usage30d / 30}
							{@const currentStock = Math.max(0, supply.current_stock || 0)}
							{@const daysLeft = dailyBurn > 0 ? currentStock / dailyBurn : 999}
							{@const trend = getUsageTrend(supply.id)}
							{@const runOutDate = getRunOutDate(supply)}
							{@const reorderQty = getReorderQty(supply)}

							{@const projectedSpend30d = usage30d * unitCost}
							{@const impactPercent =
								totalProjectedSpend30d > 0 ? (projectedSpend30d / totalProjectedSpend30d) * 100 : 0}

							{@const paretoIdx = sortedByUsage.findIndex((s) => s.id === supply.id)}
							{@const cumUsageAtThisPoint = sortedByUsage
								.slice(0, paretoIdx + 1)
								.reduce((acc, s) => acc + getUsage30d(s.id) * getEstimatedUnitCost(s), 0)}
							{@const cumUsagePercent =
								totalProjectedSpend30d > 0
									? (cumUsageAtThisPoint / totalProjectedSpend30d) * 100
									: 0}

							<tr
								class="hover:bg-muted/50 {(showAdjustModal && adjustSupplyId === supply.id) ||
								(showSupplyForm && editSupplyId === supply.id)
									? 'bg-muted/30 border-l-4 border-l-primary'
									: ''} {daysLeft < 7 ? 'bg-red-50/50' : ''}"
							>
								<td class="px-4 py-3 font-medium">
									<div class="flex items-center gap-2">
										{#if daysLeft < 7}
											<AlertCircle class="h-3.5 w-3.5 text-red-600 animate-pulse" />
										{/if}
										{#if ['box', 'envelope', 'bag'].includes(supply.type)}
											<button
												class="text-primary hover:underline font-bold flex items-center gap-1 group w-fit"
												onclick={() => openReassignModal(supply.code)}
												title="View and reassign items using this size"
											>
												{supply.name}
												<Search
													class="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity"
												/>
											</button>
										{:else}
											<span class="font-bold">{supply.name}</span>
										{/if}
									</div>
								</td>
								<td class="px-4 py-3 text-muted-foreground whitespace-nowrap">{supply.code}</td>
								<td class="px-4 py-3">
									<span
										class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-muted/30"
									>
										{supply.type}
									</span>
								</td>
								<td class="px-4 py-3 text-right">£{unitCost.toFixed(4)}</td>
								<td class="px-4 py-3 text-right font-bold">{currentStock}</td>
								<td
									class="px-4 py-3 text-right font-bold italic text-muted-foreground whitespace-nowrap"
								>
									<div class="flex flex-col items-end">
										<span>{getActualUsage(supply.id)} units</span>
										<span class="text-[9px] not-italic font-normal">in {data.daysOfData}d</span>
									</div>
								</td>
								<td class="px-4 py-3 text-right font-bold italic text-muted-foreground"
									>£{projectedSpend30d.toFixed(2)}</td
								>
								<td class="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
									<div class="flex flex-col items-end">
										<div class="flex items-center gap-1">
											<span class="font-bold text-foreground">{dailyBurn.toFixed(1)}/day</span>
											<span class="{trend.color} text-[10px]" title={trend.label}>{trend.icon}</span
											>
										</div>
										<span class="text-[9px] {getConfidence(supply.id).color} font-bold"
											>{getConfidence(supply.id).label} confidence</span
										>
									</div>
								</td>
								<td class="px-4 py-3 text-right font-bold min-w-[100px]">
									<span
										class="px-2 py-1 rounded-md text-[11px] font-black inline-block w-full text-center {daysLeft <
										7
											? 'bg-red-600 text-white animate-pulse'
											: daysLeft < 14
												? 'bg-orange-100 text-orange-700'
												: daysLeft <= 30
													? 'bg-yellow-100 text-yellow-800'
													: 'bg-emerald-100 text-emerald-700'}"
									>
										{dailyBurn > 0 ? Math.round(daysLeft) + ' days' : '∞'}
									</span>
								</td>
								<td class="px-4 py-3 text-right font-medium whitespace-nowrap">
									{#if runOutDate}
										<span class={daysLeft < 7 ? 'text-red-600 font-bold' : 'text-muted-foreground'}>
											{runOutDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
										</span>
									{:else}
										<span class="text-muted-foreground">--</span>
									{/if}
								</td>
								<td class="px-4 py-3 text-right">
									{#if reorderQty > 0}
										<div class="flex flex-col items-end">
											<span class="font-black text-primary text-base">+{reorderQty}</span>
											<span class="text-[9px] font-bold text-muted-foreground uppercase"
												>Cost: £{getReorderCost(supply).toFixed(0)}</span
											>
										</div>
									{:else}
										<span class="text-emerald-600 font-bold text-xs uppercase tracking-tighter"
											>Sufficient</span
										>
									{/if}
								</td>
								<td class="px-4 py-3 text-right font-mono text-xs">
									£{(currentStock * unitCost).toFixed(2)}
								</td>
								<td class="px-4 py-3 text-right">
									<div class="flex flex-col items-end gap-1">
										<div class="flex items-center gap-2">
											{#if cumUsagePercent <= 80}
												<span class="bg-amber-100 text-amber-700 text-[9px] font-black px-1 rounded"
													>A</span
												>
											{/if}
											<div class="flex flex-col items-end">
												<span class="text-[10px] font-bold">{impactPercent.toFixed(1)}%</span>
												<span class="text-[9px] text-muted-foreground"
													>Cum: {cumUsagePercent.toFixed(0)}%</span
												>
											</div>
											<div class="w-16 h-1.5 bg-muted rounded-full overflow-hidden self-center">
												<div
													class="h-full {cumUsagePercent <= 80 ? 'bg-amber-500' : 'bg-primary'}"
													style="width: {impactPercent}%"
												></div>
											</div>
										</div>
									</div>
								</td>
								<td class="px-4 py-3 text-right">
									<div class="flex justify-end gap-2">
										<button
											class="text-primary hover:underline font-medium text-xs whitespace-nowrap"
											onclick={() => openEditSupply(supply)}>Edit</button
										>
										<button
											class="text-primary hover:underline font-medium text-xs whitespace-nowrap"
											onclick={() => openAdjustStock(supply)}>Adjust</button
										>
										<button
											class="text-red-500 hover:underline font-medium text-xs whitespace-nowrap"
											onclick={() => deleteSupply(supply.id)}>Delete</button
										>
									</div>
								</td>
							</tr>
							{#if showAdjustModal && adjustSupplyId === supply.id}
								<tr class="bg-muted/20 border-l-4 border-l-primary">
									<td colspan="13" class="p-4">
										<div class="grid grid-cols-1 sm:grid-cols-6 gap-4 items-end">
											<div class="space-y-1 sm:col-span-1">
												<span class="text-xs font-medium text-muted-foreground block">Current</span>
												<div
													class="p-2 text-sm bg-muted rounded border border-transparent font-medium"
												>
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
												<span class="text-xs font-medium text-muted-foreground block"
													>Adjustment</span
												>
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
									</td>
								</tr>
							{/if}
							{#if showSupplyForm && editSupplyId === supply.id}
								<tr class="bg-muted/20 border-l-4 border-l-primary">
									<td colspan="11" class="p-4">
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
												<Button class="flex-1" onclick={saveSupply} disabled={isSavingSupply}>
													{isSavingSupply ? 'Saving...' : 'Save'}
												</Button>
												<Button
													variant="outline"
													class="flex-1"
													onclick={() => (showSupplyForm = false)}
													disabled={isSavingSupply}
												>
													Cancel
												</Button>
											</div>
										</div>
									</td>
								</tr>
							{/if}
						{/each}
						{#if data.supplies.length === 0}
							<tr
								><td colspan="11" class="px-4 py-8 text-center text-muted-foreground"
									>No supplies found in database.</td
								></tr
							>
						{/if}
					</tbody>
				</table>
			</div>
		{:else if activeTab === 'history'}
			<div class="flex flex-col gap-6">
				<!-- History Stats -->
				<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
					<div class="bg-card border rounded-xl p-4 shadow-sm flex flex-col justify-between">
						<div class="flex items-center gap-2 text-muted-foreground mb-1">
							<Activity class="h-4 w-4 text-purple-500" />
							<span class="text-xs font-semibold uppercase tracking-wider">Spend (Last 30d)</span>
						</div>
						<div class="flex items-baseline gap-2">
							<span class="text-2xl font-bold">£{historySpend30d.toLocaleString()}</span>
							{#if historySpendPrev30d > 0}
								{@const diff =
									((historySpend30d - historySpendPrev30d) / historySpendPrev30d) * 100}
								<span class="text-xs font-bold {diff > 0 ? 'text-red-600' : 'text-emerald-600'}">
									{diff > 0 ? '▲' : '▼'}
									{Math.abs(diff).toFixed(0)}%
								</span>
							{/if}
						</div>
					</div>
					<!-- Placeholder for other history stats -->
					<div
						class="bg-card border rounded-xl p-4 shadow-sm flex flex-col justify-between opacity-50"
					>
						<div class="flex items-center gap-2 text-muted-foreground mb-1">
							<ClipboardList class="h-4 w-4" />
							<span class="text-xs font-semibold uppercase tracking-wider">Total Invoices</span>
						</div>
						<span class="text-2xl font-bold">{(data.history || []).length}</span>
					</div>
				</div>

				<!-- Filters -->
				<div class="flex flex-wrap items-center gap-4 bg-muted/30 p-4 rounded-xl border">
					<div class="flex-1 min-w-[200px] relative">
						<Search
							class="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
						/>
						<input
							type="text"
							placeholder="Search invoices, items, or suppliers..."
							class="w-full pl-9 pr-4 py-2 bg-background border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
							bind:value={historySearch}
						/>
					</div>

					<div class="flex items-center gap-4 shrink-0">
						<div class="flex flex-col">
							<label
								for="history-supplier-filter"
								class="text-[10px] uppercase font-bold text-muted-foreground mb-1">Supplier</label
							>
							<select
								id="history-supplier-filter"
								class="bg-background border rounded-lg px-3 py-2 text-sm outline-none"
								bind:value={historySupplierFilter}
							>
								<option value="all">All Suppliers</option>
								{#each data.suppliers as s}
									<option value={s.id}>{s.name}</option>
								{/each}
							</select>
						</div>

						<div class="flex flex-col">
							<label
								for="history-timeframe-filter"
								class="text-[10px] uppercase font-bold text-muted-foreground mb-1">Timeframe</label
							>
							<select
								id="history-timeframe-filter"
								class="bg-background border rounded-lg px-3 py-2 text-sm outline-none"
								bind:value={historyDateRange}
							>
								<option value="30">Last 30 Days</option>
								<option value="90">Last 90 Days</option>
								<option value="365">Last 1 Year</option>
								<option value="all">All Time</option>
							</select>
						</div>
					</div>
				</div>

				<!-- History Feed -->
				<div class="bg-card border rounded-xl shadow-sm overflow-hidden">
					{#if filteredHistory.length === 0}
						<div class="p-12 text-center text-muted-foreground">
							<p class="font-bold">No history matching these filters</p>
							<button
								class="text-primary hover:underline mt-2 text-sm"
								onclick={() => {
									historySearch = '';
									historySupplierFilter = 'all';
									historyDateRange = '90';
								}}>Clear all filters</button
							>
						</div>
					{:else}
						<div class="divide-y divide-muted/60">
							{#each filteredHistory as invoice}
								<div class="p-6 hover:bg-muted/10 transition-colors group">
									<div class="flex items-center justify-between mb-4">
										<div class="flex items-center gap-4">
											<div>
												<h4 class="font-black text-lg tracking-tight">
													{invoice.packing_suppliers?.name || 'Unknown'}
												</h4>
												<p class="text-xs text-muted-foreground">
													{new Date(invoice.invoice_date).toLocaleDateString('en-GB', {
														day: 'numeric',
														month: 'short',
														year: 'numeric'
													})} • {invoice.invoice_number || 'No Inv #'}
												</p>
											</div>
											<div class="flex gap-1">
												<button
													class="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold hover:bg-primary/20"
													onclick={() => openEditInvoice(invoice)}
												>
													EDIT
												</button>
												<button
													class="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold hover:bg-red-200"
													onclick={() => deleteInvoice(invoice.id)}
												>
													DEL
												</button>
											</div>
										</div>
										<div class="text-right">
											<p class="text-xl font-black text-primary tracking-tighter">
												£{Number(invoice.total_cost || 0).toFixed(2)}
											</p>
											<p class="text-[10px] text-muted-foreground uppercase font-bold">
												Incl. £{Number(invoice.total_vat || 0).toFixed(2)} VAT
											</p>
										</div>
									</div>

									<div class="bg-muted/30 rounded-lg overflow-hidden border">
										<table class="w-full text-xs text-left">
											<thead class="bg-muted/50 text-muted-foreground border-b italic">
												<tr>
													<th class="px-3 py-2 font-bold uppercase tracking-wider">Supplies Item</th
													>
													<th class="px-3 py-2 font-bold uppercase tracking-wider text-right"
														>Qty</th
													>
													<th class="px-3 py-2 font-bold uppercase tracking-wider text-right"
														>Unit Price</th
													>
													<th class="px-3 py-2 font-bold uppercase tracking-wider text-right"
														>Total</th
													>
													<th class="px-3 py-2 w-16"></th>
												</tr>
											</thead>
											<tbody class="divide-y divide-border/40">
												{#each invoice.packing_invoice_lines || [] as line}
													{#if editingLineInvoiceId === invoice.id && editingLineSupplyId === line.supply_id}
														<tr class="bg-primary/5">
															<td class="px-3 py-2 font-bold text-primary">
																{line.packing_supplies?.name || 'Unknown Item'}
															</td>
															<td class="px-3 py-2 text-right">
																<input
																	type="number"
																	min="0"
																	class="w-20 border rounded px-2 py-1 text-right focus:ring-1 focus:ring-primary outline-none"
																	bind:value={editLineQty}
																/>
															</td>
															<td class="px-3 py-2 text-right text-muted-foreground">
																£{editLineQty > 0
																	? (editLineTotal / editLineQty).toFixed(4)
																	: '0.0000'}
															</td>
															<td class="px-3 py-2 text-right">
																<input
																	type="number"
																	step="0.01"
																	min="0"
																	class="w-24 border rounded px-2 py-1 text-right focus:ring-1 focus:ring-primary outline-none font-bold"
																	bind:value={editLineTotal}
																/>
															</td>
															<td class="px-3 py-2 text-right">
																<div class="flex items-center gap-2 justify-end">
																	<button
																		class="text-primary font-bold hover:underline"
																		onclick={saveLineEdit}
																		disabled={isSavingLineEdit}>Save</button
																	>
																	<button
																		class="text-muted-foreground hover:underline"
																		onclick={cancelEditLine}
																		disabled={isSavingLineEdit}>Cancel</button
																	>
																</div>
															</td>
														</tr>
													{:else}
														<tr class="hover:bg-muted/40 transition-colors">
															<td class="px-3 py-2">
																<div class="flex flex-col">
																	<div class="flex items-center gap-2">
																		<span class="font-bold">
																			{line.packing_supplies?.name || 'Unknown Item'}
																		</span>
																		{#if getPriceComparison(line.supply_id, line.unit_price, invoice.invoice_date)}
																			{@const priceInfo = getPriceComparison(
																				line.supply_id,
																				line.unit_price,
																				invoice.invoice_date
																			)}
																			{#if priceInfo}
																				<span
																					class="px-1.5 py-0.5 rounded text-[10px] font-black {priceInfo.diff >
																					0.001
																						? 'bg-red-100 text-red-700'
																						: priceInfo.diff < -0.001
																							? 'bg-emerald-100 text-emerald-700'
																							: 'bg-muted text-muted-foreground'}"
																				>
																					{#if priceInfo.diff > 0.001}
																						▲ £{priceInfo.diff.toFixed(2)} ({priceInfo.percent.toFixed(
																							0
																						)}%)
																					{:else if priceInfo.diff < -0.001}
																						▼ £{Math.abs(priceInfo.diff).toFixed(2)} ({Math.abs(
																							priceInfo.percent
																						).toFixed(0)}%)
																					{:else}
																						STABLE
																					{/if}
																				</span>
																			{/if}
																		{/if}
																	</div>
																	<div class="flex items-center gap-2">
																		<span class="text-[10px] text-muted-foreground font-mono">
																			{line.packing_supplies?.code || ''}
																		</span>
																		{#if getBundleInfo(line.packing_supplies, line.quantity)}
																			<span
																				class="text-[10px] font-bold text-muted-foreground italic"
																			>
																				({getBundleInfo(line.packing_supplies, line.quantity)})
																			</span>
																		{/if}
																	</div>
																</div>
															</td>
															<td class="px-3 py-2 text-right font-black text-primary tabular-nums"
																>×{line.quantity}</td
															>
															<td class="px-3 py-2 text-right tabular-nums text-muted-foreground"
																>£{Number(line.unit_price || 0).toFixed(4)}</td
															>
															<td class="px-3 py-2 text-right font-bold tabular-nums"
																>£{(line.quantity * Number(line.unit_price || 0)).toFixed(2)}</td
															>
															<td class="px-3 py-2 text-right">
																<button
																	class="text-[10px] text-muted-foreground hover:text-primary transition-colors font-bold uppercase"
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
					{/if}
				</div>
			</div>
		{/if}

		{#if activeTab === 'unmapped'}
			<div class="bg-card text-card-foreground rounded-xl border shadow-sm p-6 w-full">
				<div class="mb-6">
					<h2 class="text-xl font-semibold">Unmapped Orders Review</h2>
					<p class="text-sm text-muted-foreground">
						Orders where the packaging could not be automatically determined. Assign a box size to
						the SKUs below to resolve.
					</p>
				</div>

				<div class="overflow-x-auto rounded-lg border">
					<table class="w-full text-sm">
						<thead class="bg-muted/50 border-b">
							<tr>
								<th class="px-4 py-3 text-left font-medium">Order Details</th>
								<th class="px-4 py-3 text-left font-medium">Items to Map</th>
								<th class="px-4 py-3 text-right font-medium">Action</th>
							</tr>
						</thead>
						<tbody class="divide-y">
							{#each data.unmappedOrders as order}
								{@const activeItems = order.items.filter(
									(i: any) =>
										i.costs?.boxCode !== '0x0x0' &&
										i.costs?.boxReason !== 'Mapped' &&
										!mappedActiveSkus.includes(i.seller_sku)
								)}
								{#if activeItems.length > 0}
									<tr class="hover:bg-muted/30 transition-colors">
										<td class="px-4 py-4">
											<div class="font-bold flex items-center gap-2">
												{order.amazon_order_id}
												{#if order.is_prime}<span
														class="text-[10px] bg-blue-100 text-blue-700 px-1 rounded font-black"
														>PRIME</span
													>{/if}
											</div>
											<div class="text-[10px] text-muted-foreground mt-1">
												Box Code: <code class="bg-muted px-1 rounded">{order.box_code}</code>
											</div>
											<div class="text-[10px] text-muted-foreground">
												Calculated: {new Date(order.calculated_at).toLocaleString()}
											</div>
										</td>
										<td class="px-4 py-4">
											<div class="flex flex-col gap-3">
												{#each activeItems as item}
													<div
														class="flex items-start justify-between gap-4 border-l-2 border-amber-300 pl-3"
													>
														<div class="min-w-0">
															<p class="font-medium line-clamp-1 text-xs">{item.title}</p>
															<p class="text-[10px] text-muted-foreground font-mono">
																{item.seller_sku} | {item.asin}
															</p>
															<p class="text-[10px] text-red-600 font-bold mt-0.5">
																Reason: {item.costs?.boxReason || 'Unknown Mapping Error'}
															</p>
														</div>
														<div class="flex flex-col gap-2 shrink-0">
															<select
																class="h-7 border rounded text-[10px] px-1 focus:ring-1 focus:ring-primary outline-none"
																onchange={(e) =>
																	handleQuickAssign(item.seller_sku, e.currentTarget.value)}
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
										<td class="px-4 py-4 text-right">
											<Button
												variant="outline"
												size="sm"
												onclick={() => openReassignModal(order.box_code)}
											>
												<Search class="h-3.5 w-3.5 mr-2" />
												Analyze Size
											</Button>
										</td>
									</tr>
								{/if}
							{:else}
								<tr>
									<td colspan="3" class="px-4 py-12 text-center text-muted-foreground italic">
										All orders are currently mapped correctly.
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		{#if activeTab === 'sku-search'}
			<div class="bg-card text-card-foreground rounded-xl border shadow-sm p-6 w-full">
				<div class="flex flex-col gap-4 mb-6">
					<div>
						<h2 class="text-xl font-semibold">SKU / Product Search</h2>
						<p class="text-sm text-muted-foreground">
							Quickly search for any SKU or Product to manually override its box size mapping.
						</p>
					</div>

					<div class="flex gap-2 max-w-xl">
						<div class="relative flex-1">
							<Search
								class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
							/>
							<input
								type="text"
								placeholder="Search by SKU, ASIN or Product Name..."
								class="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
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
											<div class="mt-1 flex flex-wrap gap-1">
												{#if result.linnworks?.props?.length > 0}
													{#each result.linnworks.props || [] as prop}
														{@const isBoxProp =
															prop.name.toLowerCase().includes('box') ||
															prop.name.toLowerCase().includes('pack')}
														<span
															class="text-[9px] {isBoxProp
																? result.box_code === prop.value
																	? 'bg-green-100 text-green-800 border-green-300 font-bold'
																	: 'bg-amber-100 text-amber-800 border-amber-300 font-bold'
																: 'bg-muted text-muted-foreground border-border'} px-1 border rounded"
															title="Property Type: {prop.type}"
														>
															{prop.name}: {prop.value}
															{#if isBoxProp && result.box_code === prop.value}
																<span class="ml-1">✓</span>
															{/if}
														</span>
													{/each}
												{:else if result.linnworks}
													<div class="text-[9px] text-muted-foreground italic">
														No extended properties found for this SKU in Linnworks.
													</div>
												{/if}
											</div>
										</td>
										<td class="px-4 py-4 text-center">
											<div class="text-foreground font-semibold">{result.sku}</div>
											<div class="text-muted-foreground">{result.asin}</div>
											{#if result.linnworks?.mismatch}
												<div
													class="mt-1 text-[9px] text-red-600 font-bold bg-red-50 px-1 rounded border border-red-200 inline-block"
													title="Local: {result.inventory_dims || '0x0x0'} vs Linnworks: {result
														.linnworks?.dims?.w}x{result.linnworks?.dims?.h}x{result.linnworks?.dims
														?.d}"
												>
													DIM MISMATCH
												</div>
											{:else if result.linnworks?.dims}
												<div
													class="mt-1 text-[9px] text-green-600 font-medium bg-green-50 px-1 rounded border border-green-200 inline-block"
												>
													DIMS SYNCED
												</div>
											{/if}
										</td>
										<td class="px-4 py-4">
											{#if searchMappingUpdates[result.sku] || result.box_code}
												<div class="flex flex-col gap-1">
													<div class="flex items-center gap-2">
														<span
															class="inline-flex items-center rounded-full {result.supply_match
																? 'bg-blue-100 text-blue-800 border-blue-300'
																: 'bg-amber-50 text-amber-700 border-amber-200'} px-2.5 py-0.5 text-[11px] font-bold border-2 shadow-sm"
														>
															{searchMappingUpdates[result.sku] || result.box_code}
														</span>
														{#if !result.supply_match && (searchMappingUpdates[result.sku] || result.box_code)}
															<span
																class="text-[9px] bg-red-100 text-red-700 px-1 rounded border border-red-200 animate-pulse font-bold"
																title="The box code specified doesn't exist in your catalog!"
															>
																CATALOG ERROR
															</span>
														{/if}
													</div>

													{#if result.supply_match}
														<div class="flex items-center gap-1.5">
															<span
																class="text-[10px] px-1 rounded {result.supply_match.stock <= 5
																	? 'bg-red-500 text-white font-bold'
																	: result.supply_match.stock <= 20
																		? 'bg-orange-400 text-white'
																		: 'text-muted-foreground bg-muted'} "
															>
																Stock: {result.supply_match.stock}
															</span>
															<span class="text-[9px] text-muted-foreground"
																>{result.supply_match.name}</span
															>
														</div>
													{/if}

													{#if result.linnworks?.dims}
														<span class="text-[9px] text-muted-foreground font-mono">
															LW: {result.linnworks.dims.w}x{result.linnworks.dims.h}x{result
																.linnworks.dims.d}
														</span>
													{/if}
												</div>
											{:else}
												<span class="text-muted-foreground italic text-xs">Not Mapped</span>
											{/if}
										</td>
										<td class="px-4 py-4">
											<div class="flex items-center gap-2">
												<select
													class="w-full h-8 border rounded-md px-2 text-[11px] focus:ring-1 focus:ring-primary outline-none"
													value={searchMappingUpdates[result.sku] || result.box_code}
													onchange={(e) =>
														handleSearchQuickAssign(result.sku, e.currentTarget.value)}
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
													title="Advanced Settings"
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
				{:else if skuSearchQuery.length >= 2 && !isSearchingSkus}
					<div
						class="text-center p-12 text-muted-foreground bg-muted/20 border border-dashed rounded-xl"
					>
						No matching products or SKUs found.
					</div>
				{:else if !isSearchingSkus}
					<div
						class="text-center p-12 text-muted-foreground bg-muted/20 border border-dashed rounded-xl"
					>
						Type at least 2 characters to search for a product.
					</div>
				{/if}
			</div>
		{/if}

		{#if activeTab === 'review'}
			<div
				class="bg-card text-card-foreground rounded-xl border shadow-sm p-6 w-full overflow-hidden"
			>
				<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
					<div>
						<h2 class="text-xl font-semibold flex items-center gap-2">
							<PackageSearch class="h-5 w-5 text-primary" />
							Daily Dispatch Review
						</h2>
						<p class="text-sm text-muted-foreground mt-1">
							Review historical box allocations and costs for a specific date.
						</p>
					</div>

					<div class="flex items-center gap-3 bg-muted/30 p-2 rounded-lg border">
						<span class="text-sm font-medium px-2">Select Date:</span>
						<input
							type="date"
							class="bg-background border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
							value={data.selectedDate}
							onchange={handleDateChange}
						/>
					</div>
				</div>

				<div class="overflow-x-auto -mx-6">
					<table class="w-full text-left border-collapse min-w-[1000px]">
						<thead>
							<tr class="bg-muted/50 text-muted-foreground text-[11px] uppercase tracking-wider">
								<th class="px-6 py-3 font-bold border-b">Order Info</th>
								<th class="px-6 py-3 font-bold border-b">Items & Analysis</th>
								<th class="px-6 py-3 font-bold border-b text-center">Allocated Box</th>
							</tr>
						</thead>
						<tbody class="divide-y text-xs">
							{#each data.reviewOrders || [] as order}
								<tr
									class="hover:bg-muted/20 transition-all border-l-4 {order.box_code === '0x0x0'
										? 'border-l-red-500 bg-red-50/10'
										: order.box_supply_id
											? 'border-l-green-500'
											: 'border-l-amber-500'}"
								>
									<td class="px-6 py-4 align-top">
										<div class="font-bold text-sm text-foreground">{order.amazon_order_id}</div>
										<div class="text-muted-foreground font-mono text-[10px] mt-1">
											{new Date(order.purchase_date).toLocaleString()}
										</div>
										{#if order.is_prime}
											<div class="mt-2">
												<span
													class="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-bold border border-blue-200"
												>
													PRIME
												</span>
											</div>
										{/if}
									</td>
									<td class="px-6 py-4 align-top">
										<div class="space-y-4">
											{#each order.items || [] as item}
												<div
													class="flex flex-col gap-1.5 p-3 bg-white/50 rounded border border-border/50"
												>
													<div class="flex justify-between items-start gap-4">
														<div class="flex-1">
															<div class="font-bold text-xs text-foreground line-clamp-1">
																{item.title}
															</div>
															<div class="flex items-center gap-2 mt-1">
																<span class="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono"
																	>{item.seller_sku}</span
																>
																<span class="text-[10px] text-muted-foreground"
																	>Qty: <span class="font-bold text-foreground"
																		>{item.quantity_ordered}</span
																	></span
																>
															</div>
														</div>
														<div class="flex flex-col items-end">
															<span class="text-[10px] font-bold text-primary"
																>£{item.item_price_amount || '0.00'}</span
															>
														</div>
													</div>

													{#if item.costs}
														<div class="mt-2 text-[10px] w-fit">
															<div
																class="px-3 py-1.5 rounded border flex flex-col items-center justify-center transition-all shadow-sm min-w-[140px]"
																class:bg-green-100={order.box_code && order.box_code !== '0x0x0'}
																class:border-green-200={order.box_code &&
																	order.box_code !== '0x0x0'}
																class:bg-blue-100={order.box_code === '0x0x0'}
																class:border-blue-200={order.box_code === '0x0x0'}
															>
																<div
																	class="font-black uppercase tracking-tighter text-[8px]"
																	class:text-green-800={order.box_code &&
																		order.box_code !== '0x0x0'}
																	class:text-blue-800={order.box_code === '0x0x0'}
																>
																	Assigned Box
																</div>
																<div
																	class="font-black text-[12px] mt-0.5"
																	class:text-green-900={order.box_code &&
																		order.box_code !== '0x0x0'}
																	class:text-blue-900={order.box_code === '0x0x0'}
																>
																	{#if order.box_code === '0x0x0'}
																		Own Box
																	{:else}
																		{data.supplies.find((s: any) => s.id === order.box_supply_id)
																			?.name ||
																			order.box_code ||
																			'N/A'}
																	{/if}
																</div>
															</div>
														</div>
														<div class="mt-1 text-[8px] text-gray-400 italic">
															Reason: {item.costs.reason || 'Standard algorithm'}
														</div>
													{:else}
														<div
															class="mt-2 text-[10px] text-amber-600 italic bg-amber-50 p-1.5 rounded border border-amber-100"
														>
															No cost analysis available for this SKU.
														</div>
													{/if}
												</div>
											{/each}
										</div>
									</td>
									<td class="px-6 py-4 align-top text-center">
										<div class="inline-flex flex-col items-center gap-1">
											{#if order.box_code}
												<span class="text-[8px] text-muted-foreground font-mono">UPDATE SIZE</span>
											{:else}
												<span
													class="bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold text-[10px] border border-amber-200"
												>
													UNALLOCATED
												</span>
											{/if}
											<select
												class="mt-1 text-[10px] bg-white border border-border rounded px-1 py-0.5 focus:ring-1 focus:ring-primary/20 outline-none transition-all w-24"
												onchange={(e: Event) => {
													const target = e.target as HTMLSelectElement;
													if (target.value && order.items?.[0]?.seller_sku) {
														quickAssignBox(order.items[0].seller_sku, target.value);
													}
												}}
											>
												<option value="">Update...</option>
												{#each boxOptions as box}
													<option value={box.code}>{box.name}</option>
												{/each}
											</select>
										</div>
									</td>
								</tr>
							{:else}
								<tr>
									<td
										colspan="3"
										class="px-6 py-20 text-center text-muted-foreground italic bg-muted/10"
									>
										<div class="flex flex-col items-center gap-2">
											<PackageSearch class="h-10 w-10 text-muted-foreground/30" />
											<p>No orders found for the selected date.</p>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
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

<BoxSKUListModal
	bind:open={showReassignModal}
	boxCode={reassignBoxCode}
	supplies={data.supplies || []}
	onSuccess={handleReassignSuccess}
/>
{#if toastNotifications.length > 0}
	<div class="fixed top-4 right-4 z-9999 flex flex-col gap-2">
		{#each toastNotifications as toast (toast.id)}
			<div
				class="min-w-[250px] rounded-lg border bg-white p-4 shadow-lg transition-all"
				class:border-green-500={toast.type === 'success'}
				class:border-red-500={toast.type === 'error'}
				class:border-blue-500={toast.type === 'info'}
			>
				<div class="flex items-center gap-3">
					{#if toast.type === 'success'}
						<div class="rounded-full bg-green-100 p-1 text-green-600">
							<Plus size={16} />
						</div>
					{:else if toast.type === 'error'}
						<div class="rounded-full bg-red-100 p-1 text-red-600">
							<AlertCircle size={16} />
						</div>
					{:else}
						<div class="rounded-full bg-blue-100 p-1 text-blue-600">
							<Package size={16} />
						</div>
					{/if}
					<p class="text-sm font-medium text-gray-900">{toast.message}</p>
				</div>
			</div>
		{/each}
	</div>
{/if}
