<script lang="ts">
	import { onMount } from 'svelte';
	import Breadcrumb from '$lib/components/Breadcrumb.svelte';
	let summaryData: any[] = [];
	let loading = true;
	let error = '';

	async function fetchSummary() {
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/linnworks-composition/summary');
			const result = await res.json();
			if (result.success) {
				summaryData = result.data;
			} else {
				error = result.error || 'Failed to fetch summary.';
			}
		} catch (e) {
			error = 'Error fetching summary.';
		} finally {
			loading = false;
		}
	}

	onMount(fetchSummary);

	function formatNumber(value: any): string {
		if (value === null || value === undefined || value === '') return '-';
		const num = Number(value);
		if (isNaN(num)) return String(value);
		return num.toString();
	}

	function safeJsonParse(jsonString: string, defaultValue: any[] = []): any[] {
		try {
			if (!jsonString) return defaultValue;
			const parsed = JSON.parse(jsonString);
			return Array.isArray(parsed) ? parsed : defaultValue;
		} catch (e) {
			console.error('Error parsing JSON:', e, 'Input:', jsonString);
			return defaultValue;
		}
	}
</script>

<svelte:head>
	<title>Linnworks Composition Summary</title>
</svelte:head>

<div class="container mx-auto px-4 py-6">
	<Breadcrumb currentPage="Composition Summary" />

	<h1 class="text-2xl font-bold mb-4">Linnworks Composition Summary</h1>
	{#if loading}
		<div>Loading...</div>
	{:else if error}
		<div class="text-red-600">{error}</div>
	{:else if summaryData.length === 0}
		<div>No summary data available.</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="min-w-full divide-y divide-gray-200 mt-4" style="table-layout: fixed;">
				<thead class="bg-gray-50">
					<tr>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Parent SKU</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Parent Title</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Child SKUs</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Child Quantities</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Child Costs</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Child VATs</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Total Qty</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Total Cost</th
						>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each summaryData as row}
						<tr>
							<td class="px-6 py-4 text-sm text-gray-900">{row.parent_sku}</td>
							<td class="px-6 py-4 text-sm text-gray-900">{row.parent_title}</td>
							<td class="px-6 py-4 text-sm text-gray-900"
								>{safeJsonParse(row.child_skus).join(', ')}</td
							>
							<td class="px-6 py-4 text-sm text-gray-900"
								>{safeJsonParse(row.child_quantities).join(', ')}</td
							>
							<td class="px-6 py-4 text-sm text-gray-900"
								>{safeJsonParse(row.child_prices).map(formatNumber).join(', ')}</td
							>
							<td class="px-6 py-4 text-sm text-gray-900"
								>{safeJsonParse(row.child_vats).map(formatNumber).join(', ')}</td
							>
							<td class="px-6 py-4 text-sm text-gray-900">{formatNumber(row.total_qty)}</td>
							<td class="px-6 py-4 text-sm text-gray-900">{formatNumber(row.total_value)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
