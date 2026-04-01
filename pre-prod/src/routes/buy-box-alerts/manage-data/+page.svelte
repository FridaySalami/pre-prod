<script lang="ts">
	import {
		createTable,
		FlexRender,
		getCoreRowModel,
		renderComponent,
		type ColumnDef,
		type TableOptions
	} from '@tanstack/svelte-table';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Input } from '$lib/shadcn/ui/input';
	import { Button } from '$lib/shadcn/ui/button';
	import EditableCell from './EditableCell.svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	let searchTimeout: NodeJS.Timeout;

	function handleSearch(e: Event & { currentTarget: HTMLInputElement }) {
		const value = e.currentTarget.value;
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			const url = new URL($page.url);
			url.searchParams.set('search', value);
			url.searchParams.set('page', '1');
			goto(url);
		}, 500);
	}

	function handlePageChange(newPage: number) {
		const url = new URL($page.url);
		url.searchParams.set('page', newPage.toString());
		goto(url);
	}

	type BuyBoxData = {
		id: number;
		asin: string;
		sku: string;
		item_name: string;
		price: number;
		min_profitable_price: number;
		opportunity_flag: boolean;
		captured_at: string;
		is_winner: boolean;
		competitor_name: string;
		your_current_price: number;
		margin_percent_at_buybox: number;
		recommended_action: string;
		your_offers_count: number;
		profit_opportunity: number;
	};

	// Define columns
	const columns: ColumnDef<BuyBoxData>[] = [
		{
			accessorKey: 'asin',
			header: 'ASIN',
			cell: (info) => info.getValue()
		},
		{
			accessorKey: 'sku',
			header: 'SKU',
			cell: (info) => info.getValue()
		},
		{
			accessorKey: 'item_name',
			header: 'Item Name',
			cell: (info) => info.getValue() || '-'
		},
		{
			accessorKey: 'is_winner',
			header: 'Winner?',
			cell: (info) => (info.getValue() ? '🏆' : '❌')
		},
		{
			accessorKey: 'your_current_price',
			header: 'Your Price',
			cell: (info) => (info.getValue() ? `£${info.getValue()}` : '-')
		},
		{
			accessorKey: 'price',
			header: 'Buy Box Price',
			cell: (info) =>
				renderComponent(EditableCell, {
					value: info.getValue() as string | number,
					id: info.row.original.id.toString(),
					field: 'price'
				})
		},
		{
			accessorKey: 'competitor_name',
			header: 'Competitor',
			cell: (info) => info.getValue() || '-'
		},
		{
			accessorKey: 'min_profitable_price',
			header: 'Min Price',
			cell: (info) =>
				renderComponent(EditableCell, {
					value: info.getValue() as string | number,
					id: info.row.original.id.toString(),
					field: 'min_profitable_price'
				})
		},
		{
			accessorKey: 'margin_percent_at_buybox',
			header: 'Margin %',
			cell: (info) => (info.getValue() ? `${info.getValue()}%` : '-')
		},
		{
			accessorKey: 'profit_opportunity',
			header: 'Profit Opp.',
			cell: (info) => (info.getValue() ? `£${info.getValue()}` : '-')
		},
		{
			accessorKey: 'recommended_action',
			header: 'Action',
			cell: (info) => info.getValue() || '-'
		},
		{
			accessorKey: 'your_offers_count',
			header: 'Stock',
			cell: (info) => {
				const count = info.getValue() as number;
				return count > 0 ? 'In Stock' : 'Out of Stock';
			}
		},
		{
			accessorKey: 'opportunity_flag',
			header: 'Opp.',
			cell: (info) => (info.getValue() ? '✅' : '❌')
		},
		{
			accessorKey: 'captured_at',
			header: 'Captured At',
			cell: (info) => new Date(info.getValue() as string).toLocaleString()
		}
	];

	const table = createTable({
		get data() {
			return (data.buyboxData || []) as BuyBoxData[];
		},
		columns: columns,
		getCoreRowModel: getCoreRowModel()
	});

	$: {
		table.setOptions((prev) => ({
			...prev,
			data: (data.buyboxData || []) as BuyBoxData[]
		}));
	}
</script>

<div class="p-8">
	<div class="flex justify-between items-center mb-6">
		<h1 class="text-2xl font-bold">Manage Buy Box Data</h1>
		<div class="flex items-center gap-4">
			<div class="relative w-64">
				<Input
					type="search"
					placeholder="Search ASIN, SKU, or Item Name..."
					value={data.search || ''}
					oninput={handleSearch}
				/>
			</div>
		</div>
	</div>

	<div class="rounded-md border">
		{#key data.buyboxData}
			<table class="w-full text-sm text-left">
				<thead class="bg-gray-100 border-b">
					{#each table.getHeaderGroups() as headerGroup}
						<tr>
							{#each headerGroup.headers as header}
								<th class="h-12 px-4 align-middle font-medium text-gray-500">
									{#if !header.isPlaceholder}
										<FlexRender
											content={header.column.columnDef.header}
											context={header.getContext()}
										/>
									{/if}
								</th>
							{/each}
						</tr>
					{/each}
				</thead>
				<tbody>
					{#each table.getRowModel().rows as row}
						<tr class="border-b transition-colors hover:bg-gray-50/50">
							{#each row.getVisibleCells() as cell}
								<td class="p-4 align-middle">
									<FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		{/key}
	</div>

	<div class="flex items-center justify-end space-x-2 py-4">
		<div class="flex-1 text-sm text-muted-foreground">
			{data.count} total records
		</div>
		<div class="space-x-2">
			<Button
				variant="outline"
				size="sm"
				onclick={() => handlePageChange(data.page - 1)}
				disabled={data.page <= 1}
			>
				Previous
			</Button>
			<span class="text-sm mx-2">
				Page {data.page} of {Math.ceil(data.count / data.pageSize)}
			</span>
			<Button
				variant="outline"
				size="sm"
				onclick={() => handlePageChange(data.page + 1)}
				disabled={data.page >= Math.ceil(data.count / data.pageSize)}
			>
				Next
			</Button>
		</div>
	</div>
</div>
