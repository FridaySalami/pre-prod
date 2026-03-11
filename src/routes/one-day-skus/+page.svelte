<script lang="ts">
	import { Icon } from 'lucide-svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	type SKURow = Record<string, string>;

	// Initialize local state with a consistent index signature for safe cell access.
	let skuData: SKURow[] = data.skuData as SKURow[];

	// Update local state when server data changes
	$: skuData = data.skuData as SKURow[];

	let sortColumn = 'BB Change';
	let sortDirection = 'asc';

	function sortData(column: string) {
		if (sortColumn === column) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			sortDirection = 'desc'; // Default to desc for numbers usually
		}

		skuData = [...skuData].sort((a: SKURow, b: SKURow) => {
			let valA = a[column];
			let valB = b[column];

			// Clean up percentage and currency strings for comparison
			const cleanNumber = (str: string) => {
				if (!str) return -Infinity;
				// Remove common currency symbols and percentages, and commas
				return parseFloat(str.replace(/[%,£$]/g, '').replace(/,/g, ''));
			};

			const numA = cleanNumber(valA);
			const numB = cleanNumber(valB);

			if (!isNaN(numA) && !isNaN(numB)) {
				return sortDirection === 'asc' ? numA - numB : numB - numA;
			}

			valA = valA ? valA.toLowerCase() : '';
			valB = valB ? valB.toLowerCase() : '';

			if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
			if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
			return 0;
		});
	}

	const escapeCSVValue = (value: unknown) => {
		const stringValue = value == null ? '' : String(value);
		if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
			return `"${stringValue.replace(/"/g, '""')}"`;
		}
		return stringValue;
	};

	function downloadCSV() {
		if (!skuData.length || typeof window === 'undefined') return;

		const columns = Object.keys(skuData[0]);
		const headerRow = columns.map(escapeCSVValue).join(',');
		const bodyRows = skuData
			.map((row) => columns.map((column) => escapeCSVValue(row[column])).join(','))
			.join('\r\n');
		const csv = [headerRow, bodyRows].join('\r\n');

		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);

		const link = document.createElement('a');
		link.href = url;
		link.download = 'one-day-skus.csv';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}
</script>

<div class="p-8">
	<div class="flex items-center justify-between mb-4 gap-4">
		<h1 class="text-2xl font-bold">One Day SKUs Data</h1>
		<button
			on:click={downloadCSV}
			class="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
		>
			Download CSV
		</button>
	</div>

	<div class="overflow-x-auto shadow-md sm:rounded-lg">
		<table class="w-full text-sm text-left text-gray-500 dark:text-gray-400">
			<thead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
				<tr>
					{#if skuData.length > 0}
						{#each Object.keys(skuData[0]) as header}
							<th
								scope="col"
								class="px-6 py-3 cursor-pointer hover:bg-gray-100"
								on:click={() => sortData(header)}
							>
								<div class="flex items-center">
									{header}
									{#if sortColumn === header}
										<span class="ml-1">{sortDirection === 'asc' ? '▲' : '▼'}</span>
									{/if}
								</div>
							</th>
						{/each}
					{/if}
				</tr>
			</thead>
			<tbody>
				{#each skuData as row}
					<tr
						class="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
					>
						{#each Object.keys(skuData[0]) as header}
							{@const cell = row[header]}
							<td class="px-6 py-4 whitespace-nowrap">
								{#if header === 'Calculated Profit'}
									<span
										class={parseFloat(cell) > 0
											? 'text-green-600 font-bold'
											: parseFloat(cell) < 0
												? 'text-red-600 font-bold'
												: ''}
									>
										{cell ? `£${cell}` : '-'}
									</span>
								{:else if ['Calculated Cost', 'Fulfillment Cost', 'Amazon Fees', 'List Price', 'Product Cost'].includes(header)}
									{cell ? `£${cell}` : '-'}
								{:else if header === 'Margin %'}
									{cell ? `${cell}%` : '-'}
								{:else}
									{cell}
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
