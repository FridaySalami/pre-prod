<!-- StockItems.svelte -->
<script lang="ts">
	export let items: any[] = [];
	export let loading: boolean = false;
	export let error: string | null = null;

	const formatDate = (dateStr: string) => {
		return new Date(dateStr).toLocaleDateString();
	};
</script>

{#if loading}
	<div class="loading">Loading stock items...</div>
{:else if error}
	<div class="error">{error}</div>
{:else if items.length === 0}
	<div class="no-data">No stock items found</div>
{:else}
	<div class="stock-items-grid">
		{#each items as item}
			<div class="stock-item-card">
				{#if item.Images && item.Images[0]}
					<img src={item.Images[0].Source} alt={item.ItemTitle} class="item-image" />
				{/if}
				<div class="item-details">
					<h3>{item.ItemTitle}</h3>
					<p class="sku">SKU: {item.ItemNumber}</p>
					{#if item.StockLevels && item.StockLevels[0]}
						<div class="stock-info">
							<p>Available: {item.StockLevels[0].Available}</p>
							<p>In Orders: {item.StockLevels[0].InOrders}</p>
							<p>Stock Level: {item.StockLevels[0].StockLevel}</p>
						</div>
					{/if}
					<div class="pricing">
						<p>Purchase Price: £{item.PurchasePrice.toFixed(2)}</p>
						<p>Retail Price: £{item.RetailPrice.toFixed(2)}</p>
					</div>
					<p class="created">Created: {formatDate(item.CreationDate)}</p>
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.loading,
	.error,
	.no-data {
		text-align: center;
		padding: 2rem;
		color: #6b7280;
	}

	.error {
		color: #dc2626;
	}

	.stock-items-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1.5rem;
		padding: 1rem;
	}

	.stock-item-card {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		overflow: hidden;
		transition:
			transform 0.2s,
			box-shadow 0.2s;
	}

	.stock-item-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.item-image {
		width: 100%;
		height: 200px;
		object-fit: cover;
		border-bottom: 1px solid #e5e7eb;
	}

	.item-details {
		padding: 1rem;
	}

	.item-details h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.1rem;
		color: #1f2937;
	}

	.sku {
		color: #6b7280;
		font-size: 0.9rem;
		margin: 0 0 1rem 0;
	}

	.stock-info {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
		margin-bottom: 1rem;
		font-size: 0.9rem;
	}

	.stock-info p {
		margin: 0;
		color: #374151;
	}

	.pricing {
		border-top: 1px solid #e5e7eb;
		padding-top: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.pricing p {
		margin: 0.25rem 0;
		color: #374151;
	}

	.created {
		margin: 0;
		font-size: 0.8rem;
		color: #6b7280;
	}
</style>
