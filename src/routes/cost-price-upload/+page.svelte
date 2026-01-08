<script lang="ts">
	import AdminPageHeader from '$lib/components/AdminPageHeader.svelte';
	import UploadModal from '$lib/components/UploadModal.svelte';
	import { showToast } from '$lib/toastStore';

	let showImportModal = false;
	let importLoading = false;
	let importResult: any = null;
	let selectedFile: FileList | null = null;

	const expectedColumns = [
		{ name: 'Code', description: 'Stock Code' },
		{ name: 'Standard Cost', description: 'Standard Cost Value' }
	];

	async function handleUpload() {
		if (!selectedFile || selectedFile.length === 0) {
			showToast('No file selected', 'error');
			return;
		}

		importLoading = true;
		importResult = null;

		try {
			const formData = new FormData();
			formData.append('file', selectedFile[0]);

			const response = await fetch('/api/cost-price-upload', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			importResult = result;

			if (result.success) {
				showToast(
					`Upload successful: ${result.imported + result.updated} items processed`,
					'success'
				);
			} else {
				showToast(`Upload failed: ${result.error}`, 'error');
			}
		} catch (error) {
			console.error('Upload error:', error);
			showToast('An unexpected error occurred', 'error');
			importResult = {
				success: false,
				errors: ['Network or server error']
			};
		} finally {
			importLoading = false;
		}
	}
</script>

<div class="page-container">
	<div class="header-section">
		<h1 class="text-3xl font-bold tracking-tight">Cost Price Updater</h1>
		<p class="text-muted-foreground mt-2">
			Upload Sage reports to update standard costs. Simplified upload for cost updates only.
		</p>
	</div>

	<div class="content-section mt-8">
		<div class="card p-6 border rounded-lg shadow-sm bg-white">
			<h2 class="text-xl font-semibold mb-4">Upload New Pricing</h2>
			<p class="mb-6 text-gray-600">
				Please upload a CSV file containing "Code" and "Standard Cost" columns to update the system.
			</p>

			<button
				class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
				on:click={() => (showImportModal = true)}
			>
				Upload CSV
			</button>
		</div>
	</div>
</div>

<UploadModal
	bind:showModal={showImportModal}
	bind:selectedFile
	title="Upload Cost Prices"
	description="Select your Sage export CSV file."
	{expectedColumns}
	{importLoading}
	{importResult}
	on:upload={handleUpload}
/>

<!-- Note: UploadModal implementation triggers `fileSelected` when file input changes. -->
<!-- If the user wants to click "Upload" button inside the modal, I need to handle `on:upload`. -->
<!-- Let's check UploadModal again carefully. -->

<style>
	.page-container {
		padding: 2rem;
		max-width: 1200px;
		margin: 0 auto;
	}
</style>
