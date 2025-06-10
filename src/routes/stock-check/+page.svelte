<script lang="ts">
	let skuToSearch = '';
	let searchStatus = 'idle'; // idle, loading, success, error
	let searchResult: any = null;
	let errorMessage: string | null = null;

	async function searchSku() {
		if (!skuToSearch.trim()) {
			errorMessage = 'Please enter an SKU.';
			searchStatus = 'error';
			return;
		}

		searchStatus = 'loading';
		errorMessage = null;
		searchResult = null;

		try {
			const response = await fetch(
				`/api/linnworks/stock-items?sku=${encodeURIComponent(skuToSearch.trim())}`
			);
			const data = await response.json();

			if (!response.ok || !data.success) {
				searchStatus = 'error';
				errorMessage = data.error || `Error ${response.status}: ${response.statusText}`;
				searchResult = data; // Store for debugging if needed
			} else {
				searchStatus = 'success';
				searchResult = data.item;
			}
		} catch (err) {
			searchStatus = 'error';
			errorMessage = err instanceof Error ? err.message : String(err);
		}
	}
</script>

<div class="container">
	<h1>Linnworks Stock Check by SKU</h1>

	<div class="search-bar">
		<input type="text" bind:value={skuToSearch} placeholder="Enter SKU" />
		<button on:click={searchSku} disabled={searchStatus === 'loading'}>
			{searchStatus === 'loading' ? 'Searching...' : 'Search'}
		</button>
	</div>

	{#if searchStatus === 'loading'}
		<p>Loading...</p>
	{/if}

	{#if errorMessage}
		<div class="error-message">
			<p>Error: {errorMessage}</p>
			{#if searchResult && searchResult.errorDetails}
				<pre>{JSON.stringify(searchResult.errorDetails, null, 2)}</pre>
			{/if}
		</div>
	{/if}

	{#if searchStatus === 'success' && searchResult}
		<div class="result-display">
			<h2>Item Details for SKU: {searchResult.SKU}</h2>
			<p><strong>Stock Item ID:</strong> {searchResult.StockItemId}</p>
			<p><strong>Title:</strong> {searchResult.ItemTitle || 'N/A'}</p>

			<h3>Extended Properties:</h3>
			{#if searchResult.ExtendedProperties && searchResult.ExtendedProperties.length > 0}
				<ul>
					{#each searchResult.ExtendedProperties as prop}
						<li>
							<strong>{prop.PropertyName}:</strong>
							{prop.PropertyValue} ({prop.PropertyType})
						</li>
					{/each}
				</ul>
			{:else}
				<p>No extended properties found.</p>
			{/if}

			<!-- You might want to display other information from searchResult if available -->
			<!-- <pre>{JSON.stringify(searchResult, null, 2)}</pre> -->
		</div>
	{/if}
</div>

<style>
	.container {
		max-width: 800px;
		margin: 2rem auto;
		padding: 1rem;
		font-family: sans-serif;
	}
	.search-bar {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}
	.search-bar input {
		flex-grow: 1;
		padding: 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
	}
	.search-bar button {
		padding: 0.5rem 1rem;
		background-color: #007bff;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}
	.search-bar button:disabled {
		background-color: #aaa;
	}
	.error-message {
		color: red;
		background-color: #ffebee;
		border: 1px solid red;
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1rem;
	}
	.result-display {
		margin-top: 1.5rem;
		padding: 1rem;
		border: 1px solid #eee;
		border-radius: 4px;
		background-color: #f9f9f9;
	}
	.result-display h2 {
		margin-top: 0;
	}
	.result-display ul {
		list-style-type: none;
		padding-left: 0;
	}
	.result-display li {
		padding: 0.25rem 0;
		border-bottom: 1px dotted #eee;
	}
	.result-display li:last-child {
		border-bottom: none;
	}
</style>
