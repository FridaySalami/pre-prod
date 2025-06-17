<script lang="ts">
	import ExportOrdersCsv from '$lib/ExportOrdersCsv.svelte';
	import ItemSku from '$lib/ItemSku.svelte'; // Import the new component
	import type { ProcessedOrder } from './types';

	export let orders: ProcessedOrder[] = [];
	export let loading: boolean = false;
	export let error: string | null = null;

	// Sorting state
	let sortColumn: string = '';
	let sortDirection: 'asc' | 'desc' = 'asc';

	// Sort function
	function sortOrders(column: string) {
		if (sortColumn === column) {
			// If clicking the same column, toggle direction
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			// If clicking a new column, set to ascending
			sortColumn = column;
			sortDirection = 'asc';
		}
	}

	// Sorted orders computed property
	$: sortedOrders = [...orders].sort((a, b) => {
		if (!sortColumn) return 0;

		let aValue: any;
		let bValue: any;

		switch (sortColumn) {
			case 'orderId':
				aValue = a.nOrderId;
				bValue = b.nOrderId;
				break;
			case 'source':
				aValue = a.Source?.toLowerCase() || '';
				bValue = b.Source?.toLowerCase() || '';
				break;
			case 'reference':
				if (a.Source === 'AMAZON' && a.ExternalReference) {
					aValue = a.ExternalReference.toLowerCase();
				} else {
					aValue = (a.ReferenceNum || a.OrderId || '').toLowerCase();
				}
				if (b.Source === 'AMAZON' && b.ExternalReference) {
					bValue = b.ExternalReference.toLowerCase();
				} else {
					bValue = (b.ReferenceNum || b.OrderId || '').toLowerCase();
				}
				break;
			case 'shipping':
				aValue = a.PostalServiceName?.toLowerCase() || '';
				bValue = b.PostalServiceName?.toLowerCase() || '';
				break;
			case 'total':
				aValue = a.fTotalCharge || 0;
				bValue = b.fTotalCharge || 0;
				break;
			case 'itemCount':
				aValue = a.Items?.length || 0;
				bValue = b.Items?.length || 0;
				break;
			default:
				return 0;
		}

		// Handle comparison
		if (aValue < bValue) {
			return sortDirection === 'asc' ? -1 : 1;
		}
		if (aValue > bValue) {
			return sortDirection === 'asc' ? 1 : -1;
		}
		return 0;
	});

	function formatCurrency(value: number | undefined): string {
		if (value === undefined) return '£0.00';
		return `£${value.toFixed(2)}`;
	}

	// Get sort icon for column
	function getSortIcon(column: string): string {
		if (sortColumn !== column) return 'unfold_more';
		return sortDirection === 'asc' ? 'keyboard_arrow_up' : 'keyboard_arrow_down';
	}

	$: fileName = 'orders_export';
</script>

<div class="orders-list">
	{#if loading}
		<div class="loading-container">
			<div class="loading-spinner"></div>
			<p>Loading orders...</p>
		</div>
	{:else if error}
		<div class="error-message">
			<p class="font-bold">Error loading orders:</p>
			<p>{error}</p>
		</div>
	{:else if orders.length === 0}
		<div class="empty-message">
			<p>No orders found for the selected period.</p>
		</div>
	{:else}
		<div class="table-container">
			<!-- Export CSV Button and Sort Info -->
			<div class="export-container">
				<div class="sort-info">
					{#if sortColumn}
						<span class="sort-indicator">
							<i class="material-icons-outlined">sort</i>
							Sorted by {sortColumn === 'orderId'
								? 'Order ID'
								: sortColumn === 'source'
									? 'Source'
									: sortColumn === 'reference'
										? 'Reference'
										: sortColumn === 'shipping'
											? 'Shipping Method'
											: sortColumn === 'total'
												? 'Total'
												: sortColumn === 'itemCount'
													? 'Item Count'
													: sortColumn}
							({sortDirection === 'asc' ? 'A-Z' : 'Z-A'})
						</span>
					{:else}
						<span class="sort-hint">
							<i class="material-icons-outlined">info</i>
							Click column headers to sort
						</span>
					{/if}
				</div>
				<ExportOrdersCsv orders={sortedOrders} {fileName} buttonText="Export Orders to CSV" />
			</div>

			<!-- Orders Table -->
			<table>
				<thead>
					<tr>
						<th class="text-left sortable" onclick={() => sortOrders('orderId')}>
							<div class="header-content">
								<span>ORDER #</span>
								<i class="material-icons-outlined sort-icon">{getSortIcon('orderId')}</i>
							</div>
						</th>
						<th class="text-left sortable" onclick={() => sortOrders('source')}>
							<div class="header-content">
								<span>SOURCE</span>
								<i class="material-icons-outlined sort-icon">{getSortIcon('source')}</i>
							</div>
						</th>
						<th class="text-left sortable" onclick={() => sortOrders('reference')}>
							<div class="header-content">
								<span>REFERENCE</span>
								<i class="material-icons-outlined sort-icon">{getSortIcon('reference')}</i>
							</div>
						</th>
						<th class="text-left sortable" onclick={() => sortOrders('itemCount')}>
							<div class="header-content">
								<span>ITEMS & SKUs</span>
								<i class="material-icons-outlined sort-icon">{getSortIcon('itemCount')}</i>
							</div>
						</th>
						<th class="text-left sortable" onclick={() => sortOrders('shipping')}>
							<div class="header-content">
								<span>SHIPPING METHOD</span>
								<i class="material-icons-outlined sort-icon">{getSortIcon('shipping')}</i>
							</div>
						</th>
						<th class="text-right sortable" onclick={() => sortOrders('total')}>
							<div class="header-content">
								<span>TOTAL</span>
								<i class="material-icons-outlined sort-icon">{getSortIcon('total')}</i>
							</div>
						</th>
						<th class="text-right">BREAKDOWN</th>
					</tr>
				</thead>
				<tbody>
					{#each sortedOrders as order}
						<tr>
							<td class="text-left order-id">
								{order.nOrderId}
							</td>
							<td class="text-left order-source">
								{order.Source}
							</td>
							<td class="text-left order-reference">
								{#if order.Source === 'AMAZON' && order.ExternalReference}
									{order.ExternalReference}
								{:else if order.ReferenceNum}
									{order.ReferenceNum}
								{:else}
									{order.OrderId || 'No reference'}
								{/if}
							</td>
							<td class="text-left items-skus">
								<!-- Cell for Items and SKUs -->
								{#if order.Items && order.Items.length > 0}
									{#each order.Items as item}
										<ItemSku {item} />
									{/each}
								{:else}
									No items in this order.
								{/if}
							</td>
							<td class="text-left shipping-method">
								{order.PostalServiceName}
							</td>
							<td class="text-right total-cost">
								{formatCurrency(order.fTotalCharge)}
							</td>
							<td class="text-right cost-breakdown">
								{formatCurrency(
									order.fTotalCharge ? order.fTotalCharge - (order.fPostageCost || 0) : undefined
								)} + {formatCurrency(order.fPostageCost)} shipping
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.orders-list {
		background: white;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		overflow: hidden;
		font-size: 0.8125rem;
		margin-top: 20px;
	}

	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		color: #6b7280;
	}

	.loading-spinner {
		border: 2px solid #f3f3f3;
		border-top: 2px solid #3498db;
		border-radius: 50%;
		width: 20px;
		height: 20px;
		animation: spin 1s linear infinite;
		margin-bottom: 0.75rem;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.error-message {
		padding: 16px;
		background: #fee2e2;
		border: 1px solid #ef4444;
		border-radius: 6px;
		color: #991b1b;
	}

	.empty-message {
		padding: 48px;
		text-align: center;
		color: #6b7280;
	}

	.table-container {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th {
		padding: 12px;
		font-size: 0.75rem;
		color: #6b7280;
		text-transform: uppercase;
		font-weight: 600;
		border-bottom: 1px solid #e5e7eb;
	}

	td {
		padding: 12px;
		border-bottom: 1px solid #e5e7eb;
	}

	td {
		padding-top: 0.75rem;
		padding-bottom: 0.75rem;
	}

	.order-id {
		font-weight: 500;
		font-size: 0.875rem;
	}

	.order-source {
		font-size: 0.875rem;
		color: #6b7280;
	}

	.order-reference {
		font-size: 0.875rem;
		color: #4b5563;
	}

	.items-skus {
		font-size: 0.875rem;
		color: #4b5563;
		min-width: 200px; /* Adjust as needed */
	}

	.shipping-method {
		font-size: 0.875rem;
		color: #6b7280;
	}

	.total-cost {
		font-weight: 500;
		font-size: 0.875rem;
	}

	.cost-breakdown {
		font-size: 0.875rem;
		color: #6b7280;
	}

	.export-container {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding: 16px;
		background: #f9fafb;
		border-bottom: 1px solid #e5e7eb;
	}

	.sort-info {
		display: flex;
		align-items: center;
		font-size: 0.875rem;
		color: #6b7280;
		gap: 0.5rem;
	}

	.sort-indicator {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 500;
		color: #374151;
	}

	.sort-hint {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-style: italic;
	}

	.sortable {
		cursor: pointer;
		user-select: none;
		transition: background-color 0.2s ease;
	}

	.sortable:hover {
		background-color: #f3f4f6;
	}

	.header-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.sort-icon {
		font-size: 1.125rem;
		color: #9ca3af;
		transition: color 0.2s ease;
	}

	.sortable:hover .sort-icon {
		color: #6b7280;
	}
</style>
