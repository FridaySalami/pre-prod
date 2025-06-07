<script lang="ts">
	import type { ProcessedOrder } from './types';

	export let orders: ProcessedOrder[] = [];
	export let fileName: string = 'orders-export';
	export let buttonText: string = 'Export CSV';

	// Function to convert a value to CSV-safe string
	function escapeCsvValue(value: any): string {
		if (value === null || value === undefined) return '';

		const stringValue = String(value);

		// If the value contains commas, quotes, or newlines, wrap it in quotes
		if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
			// Double up any quotes to escape them
			return `"${stringValue.replace(/"/g, '""')}"`;
		}

		return stringValue;
	}

	function formatCurrency(value: number | undefined): string {
		if (value === undefined) return '0.00';
		return value.toFixed(2);
	}

	// Function to generate CSV content
	function generateCsv(): string {
		let csvContent = '';

		// Add headers
		const headers = [
			'Order #',
			'Source',
			'Reference',
			'Shipping Method',
			'Total (£)',
			'Item Cost (£)',
			'Shipping Cost (£)'
		];
		csvContent += headers.map(escapeCsvValue).join(',') + '\n';

		// Add data rows
		orders.forEach((order) => {
			const itemCost = order.fTotalCharge ? order.fTotalCharge - (order.fPostageCost || 0) : 0;

			const row = [
				order.nOrderId,
				order.Source,
				order.Source === 'AMAZON' && order.ExternalReference
					? order.ExternalReference
					: order.ReferenceNum || order.OrderId || 'No reference',
				order.PostalServiceName || '',
				formatCurrency(order.fTotalCharge),
				formatCurrency(itemCost),
				formatCurrency(order.fPostageCost)
			];
			csvContent += row.map(escapeCsvValue).join(',') + '\n';
		});

		return csvContent;
	}

	// Function to download the CSV
	function downloadCsv() {
		const csvContent = generateCsv();
		const timestamp = new Date().toISOString().split('T')[0];
		const fullFileName = `${fileName}_${timestamp}.csv`;

		// Create a Blob with the CSV content
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

		// Create a download link
		const link = document.createElement('a');
		const url = URL.createObjectURL(blob);

		// Set link properties
		link.setAttribute('href', url);
		link.setAttribute('download', fullFileName);
		link.style.visibility = 'hidden';

		// Add to document, click, and remove
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		// Clean up the URL object
		setTimeout(() => {
			URL.revokeObjectURL(url);
		}, 100);
	}
</script>

<button
	class="export-button"
	on:click={downloadCsv}
	on:keydown={(e) => e.key === 'Enter' && downloadCsv()}
>
	{buttonText}
</button>

<style>
	.export-button {
		background: #004225;
		color: white;
		border: none;
		padding: 8px 14px;
		font-size: 0.9em;
		font-weight: 500;
		cursor: pointer;
		border-radius: 6px;
		transition: all 0.2s ease;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
		display: inline-flex;
		align-items: center;
		gap: 8px;
		user-select: none;
	}

	.export-button:hover {
		background: #006339;
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
	}

	.export-button:active {
		transform: translateY(0);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}
</style>
