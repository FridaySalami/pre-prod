<script lang="ts">
	import ExportOrdersCsv from '$lib/ExportOrdersCsv.svelte';
	import type { ProcessedOrder } from './types';

	export let orders: ProcessedOrder[] = [];
	export let loading: boolean = false;
	export let error: string | null = null;

	function formatCurrency(value: number | undefined): string {
		if (value === undefined) return '£0.00';
		return `£${value.toFixed(2)}`;
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
			<!-- Export CSV Button -->
			<div class="export-container">
				<ExportOrdersCsv {orders} {fileName} buttonText="Export Orders to CSV" />
			</div>

			<!-- Orders Table -->
			<table>
				<thead>
					<tr>
						<th class="text-left">ORDER #</th>
						<th class="text-left">SOURCE</th>
						<th class="text-left">REFERENCE</th>
						<th class="text-left">SHIPPING METHOD</th>
						<th class="text-right">TOTAL</th>
						<th class="text-right">BREAKDOWN</th>
					</tr>
				</thead>
				<tbody>
					{#each orders as order}
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
		justify-content: flex-end;
		margin-bottom: 1rem;
		padding-right: 1rem;
		padding: 16px;
		text-align: right;
		background: #f9fafb;
		border-bottom: 1px solid #e5e7eb;
	}
</style>
