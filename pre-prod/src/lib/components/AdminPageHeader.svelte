<script lang="ts">
	export let title: string;
	export let description: string;
	export let showClearButton = true;
	export let showImportButton = true;
	export let showDownloadButton = false;
	export let clearButtonText = 'Clear Data';
	export let importButtonText = 'Import CSV';
	export let downloadButtonText = 'Download CSV';
	export let clearDisabled = false;
	export let importDisabled = false;
	export let downloadDisabled = false;
	export let onClear: (() => void) | undefined = undefined;
	export let onImport: (() => void) | undefined = undefined;
	export let onDownload: (() => void) | undefined = undefined;
</script>

<div class="header">
	<div class="header-title">
		<h1>{title}</h1>
		<p>{description}</p>
	</div>
	<div class="header-actions">
		{#if showClearButton && onClear}
			<button class="clear-btn" on:click={onClear} disabled={clearDisabled} title="Clear all data">
				<i class="material-icons-outlined">delete_sweep</i>
				{clearButtonText}
			</button>
		{/if}

		{#if showDownloadButton && onDownload}
			<button
				class="download-btn"
				on:click={onDownload}
				disabled={downloadDisabled}
				title="Download data as CSV"
			>
				<i class="material-icons-outlined">download</i>
				{downloadButtonText}
			</button>
		{/if}

		{#if showImportButton && onImport}
			<button class="import-btn" on:click={onImport} disabled={importDisabled}>
				<i class="material-icons-outlined">upload</i>
				{importButtonText}
			</button>
		{/if}
	</div>
</div>

<style>
	.header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 24px;
		gap: 16px;
	}

	.header-title h1 {
		font-size: 28px;
		font-weight: 700;
		color: #1f2937;
		margin: 0 0 8px 0;
		line-height: 1.2;
	}

	.header-title p {
		font-size: 16px;
		color: #6b7280;
		margin: 0;
		line-height: 1.5;
	}

	.header-actions {
		display: flex;
		gap: 12px;
		flex-shrink: 0;
		align-items: center;
	}

	.clear-btn,
	.download-btn,
	.import-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		border: none;
		border-radius: 6px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		text-decoration: none;
		white-space: nowrap;
	}

	.clear-btn:disabled,
	.download-btn:disabled,
	.import-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.clear-btn {
		background-color: #dc2626;
		color: white;
	}

	.clear-btn:hover:not(:disabled) {
		background-color: #b91c1c;
	}

	.download-btn {
		background-color: #059669;
		color: white;
	}

	.download-btn:hover:not(:disabled) {
		background-color: #047857;
	}

	.import-btn {
		background-color: #2563eb;
		color: white;
	}

	.import-btn:hover:not(:disabled) {
		background-color: #1d4ed8;
	}

	.clear-btn i,
	.download-btn i,
	.import-btn i {
		font-size: 18px;
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.header {
			flex-direction: column;
			align-items: stretch;
		}

		.header-actions {
			flex-wrap: wrap;
			justify-content: flex-start;
		}

		.clear-btn,
		.download-btn,
		.import-btn {
			flex: 1;
			min-width: 120px;
			justify-content: center;
		}
	}
</style>
