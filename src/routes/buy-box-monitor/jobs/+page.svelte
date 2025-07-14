<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	// Types for job monitoring
	interface BuyBoxJob {
		id: string;
		status: 'running' | 'completed' | 'failed';
		started_at: string;
		completed_at: string | null;
		total_asins: number;
		successful_asins: number;
		failed_asins: number;
		duration_seconds: number | null;
		source: string;
		notes: string | null;
	}

	interface BuyBoxFailure {
		id: string;
		job_id: string;
		asin: string;
		sku: string | null;
		reason: string;
		error_code: string | null;
		attempt_number: number;
		captured_at: string;
	}

	interface BuyBoxData {
		id: string;
		asin: string;
		sku: string;
		price: number | null;
		is_winner: boolean;
		opportunity_flag: boolean;
		margin_at_buybox: number | null;
		margin_percent_at_buybox: number | null;
		captured_at: string;

		// Enhanced margin analysis fields
		your_cost: number | null;
		your_shipping_cost: number | null;
		your_material_total_cost: number | null;
		your_box_cost: number | null;
		your_vat_amount: number | null;
		your_fragile_charge: number | null;
		material_cost_only: number | null;
		total_operating_cost: number | null;

		// Current pricing margins
		your_margin_at_current_price: number | null;
		your_margin_percent_at_current_price: number | null;

		// Competitor analysis
		margin_at_buybox_price: number | null;
		margin_percent_at_buybox_price: number | null;
		margin_difference: number | null;
		profit_opportunity: number | null;

		// Actual profit calculations
		current_actual_profit: number | null;
		buybox_actual_profit: number | null;
		current_profit_breakdown: string | null;
		buybox_profit_breakdown: string | null;

		// Recommendations
		recommended_action: string | null;
		price_adjustment_needed: number | null;
		break_even_price: number | null;

		// Metadata
		margin_calculation_version: string | null;
		cost_data_source: string | null;
	}

	// State management
	let jobs: BuyBoxJob[] = [];
	let selectedJob: BuyBoxJob | null = null;
	let jobResults: BuyBoxData[] = [];
	let jobFailures: BuyBoxFailure[] = [];
	let isLoading = true;
	let isResultsLoading = false;
	let isFailuresLoading = false;
	let errorMessage = '';
	let scanInProgress = false;
	let refreshInterval: ReturnType<typeof setInterval> | null = null;

	// Search functionality
	let searchQuery = '';
	let searchResults: BuyBoxData[] = [];
	let isSearching = false;
	let showSearchResults = false;

	// Filters for results
	let showOnlyOpportunities = false;
	let showOnlyWinners = false;
	let showOnlyProfitable = false;
	let minMarginFilter = 0;
	let recommendationFilter = 'all';

	// Pagination
	let currentPage = 1;
	let itemsPerPage = 25;
	let totalResults = 0;

	// Stats for selected job
	let winnerCount = 0;
	let opportunityCount = 0;
	let profitableOpportunityCount = 0;
	let marginDataCount = 0;
	let totalProfitOpportunity = 0;
	let matchBuyboxCount = 0;
	let averageCurrentProfit = 0;
	let totalResultsInJob = 0;

	// Rate limit settings for new scans
	let newScanRateLimit = 0.5; // Default to a more conservative 0.5 requests/second
	let newScanJitter = 800; // Increased jitter for more randomization
	let newScanMaxRetries = 5; // Increased retries

	// Initialize and load data
	onMount(async () => {
		await fetchJobs();

		// Set up auto-refresh for jobs in progress
		refreshInterval = setInterval(async () => {
			if (scanInProgress) {
				await fetchJobs(false);

				// If we have a selected job that's running, refresh its data too
				if (selectedJob && selectedJob.status === 'running') {
					await fetchJobResults(selectedJob.id);
				}
			}
		}, 5000); // Refresh every 5 seconds if a scan is in progress
	});

	onDestroy(() => {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}
	});

	// Fetch all jobs
	async function fetchJobs(showLoading = true): Promise<void> {
		if (showLoading) isLoading = true;
		errorMessage = '';

		try {
			const response = await fetch('/api/buybox/jobs?limit=20');
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to fetch jobs');
			}

			jobs = data.jobs;

			// Check if any job is currently running
			scanInProgress = jobs.some((job) => job.status === 'running');

			// If no job selected yet, select the most recent one
			if (!selectedJob && jobs.length > 0) {
				selectedJob = jobs[0];
				await fetchJobResults(selectedJob.id);
			}
		} catch (error: unknown) {
			console.error('Error fetching jobs:', error);
			errorMessage =
				error instanceof Error ? error.message : 'An error occurred while fetching jobs';
		} finally {
			isLoading = false;
		}
	}

	// Fetch results for a specific job
	async function fetchJobResults(jobId: string): Promise<void> {
		isResultsLoading = true;
		isFailuresLoading = true;

		try {
			// Fetch job results
			const resultsResponse = await fetch(
				`/api/buybox/results?job_id=${jobId}&page=${currentPage}&limit=${itemsPerPage}` +
					`&show_opportunities=${showOnlyOpportunities}&show_winners=${showOnlyWinners}` +
					`&show_profitable=${showOnlyProfitable}&min_margin=${minMarginFilter}&recommendation=${recommendationFilter}`
			);
			const resultsData = await resultsResponse.json();

			if (!resultsResponse.ok) {
				throw new Error(resultsData.error || 'Failed to fetch job results');
			}

			jobResults = resultsData.results;
			totalResults = resultsData.total;
			winnerCount = resultsData.winners_count;
			opportunityCount = resultsData.opportunities_count;
			profitableOpportunityCount = resultsData.profitable_opportunities_count || 0;
			marginDataCount = resultsData.margin_data_count || 0;
			totalProfitOpportunity = resultsData.total_profit_opportunity || 0;
			matchBuyboxCount = resultsData.match_buybox_count || 0;
			averageCurrentProfit = resultsData.average_current_profit || 0;
			totalResultsInJob = resultsData.total_results_in_job || 0;

			// Fetch job failures
			const failuresResponse = await fetch(`/api/buybox/failures?job_id=${jobId}`);
			const failuresData = await failuresResponse.json();

			if (!failuresResponse.ok) {
				throw new Error(failuresData.error || 'Failed to fetch job failures');
			}

			jobFailures = failuresData.failures;
		} catch (error: unknown) {
			console.error('Error fetching job data:', error);
			errorMessage =
				error instanceof Error ? error.message : 'An error occurred while fetching job data';
		} finally {
			isResultsLoading = false;
			isFailuresLoading = false;
		}
	}

	// Select a job to view its details
	async function selectJob(job: BuyBoxJob): Promise<void> {
		selectedJob = job;
		currentPage = 1; // Reset pagination
		await fetchJobResults(job.id);
	}

	// Start a new scan
	async function startNewScan(): Promise<void> {
		try {
			console.log(
				`Starting new scan with rate: ${newScanRateLimit}, jitter: ${newScanJitter}, retries: ${newScanMaxRetries}`
			);

			const response = await fetch('/api/buybox/full-scan', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					rateLimit: newScanRateLimit,
					jitter: newScanJitter,
					maxRetries: newScanMaxRetries,
					source: 'manual'
				})
			});

			const data = await response.json();

			if (!response.ok) {
				console.error('API Error:', response.status, data);
				throw new Error(data.error || 'Failed to start scan');
			}

			console.log('Scan started successfully:', data);

			// Refresh jobs to show the new one
			await fetchJobs();

			// Set the newly created job as the selected job
			if (jobs.length > 0) {
				const newJob = jobs.find((job) => job.id === data.jobId);
				if (newJob) {
					selectJob(newJob);
				}
			}

			// Set scan in progress flag
			scanInProgress = true;
		} catch (error: unknown) {
			console.error('Error starting scan:', error);
			errorMessage =
				error instanceof Error ? error.message : 'An error occurred while starting the scan';
		}
	}

	// Cancel the current job
	async function cancelJob(jobId: string): Promise<void> {
		if (!confirm('Are you sure you want to cancel this job? This will mark it as failed.')) {
			return;
		}

		try {
			const response = await fetch(`/api/buybox/jobs/${jobId}/cancel`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to cancel job');
			}

			// Refresh jobs to update the status
			await fetchJobs();

			// Display success message
			errorMessage = ''; // Clear any previous error
			alert('Job cancelled successfully');
		} catch (error: unknown) {
			console.error('Error cancelling job:', error);
			errorMessage =
				error instanceof Error ? error.message : 'An error occurred while cancelling the job';
		}
	}

	// Format date
	function formatDate(dateString: string | null): string {
		if (!dateString) return 'N/A';
		return new Date(dateString).toLocaleString();
	}

	// Format duration
	function formatDuration(seconds: number | null): string {
		if (seconds === null) return 'N/A';

		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const remainingSeconds = seconds % 60;

		if (hours > 0) {
			return `${hours}h ${minutes}m ${remainingSeconds}s`;
		} else if (minutes > 0) {
			return `${minutes}m ${remainingSeconds}s`;
		} else {
			return `${remainingSeconds}s`;
		}
	}

	// Calculate progress percentage
	function calculateProgress(job: BuyBoxJob): number {
		if (job.status === 'completed') return 100;
		if (job.total_asins === 0) return 0;

		const processed = job.successful_asins + job.failed_asins;
		return Math.floor((processed / job.total_asins) * 100);
	}

	// Handle pagination
	async function changePage(newPage: number): Promise<void> {
		if (newPage < 1) return;
		currentPage = newPage;
		if (selectedJob) {
			await fetchJobResults(selectedJob.id);
		}
	}

	// Apply filters
	async function applyFilters(): Promise<void> {
		currentPage = 1; // Reset to first page
		if (selectedJob) {
			await fetchJobResults(selectedJob.id);
		}
	}

	// Navigate to product detail page
	function viewProductDetails(asin: string, sku: string): void {
		goto(`/buy-box-monitor?query=${encodeURIComponent(sku || asin)}`);
	}

	// Search for SKU/ASIN across all jobs
	async function searchSkuAsin(): Promise<void> {
		if (!searchQuery.trim()) {
			showSearchResults = false;
			return;
		}

		isSearching = true;
		showSearchResults = true;

		try {
			// Fetch results that match the SKU or ASIN
			const response = await fetch(`/api/buybox/search?query=${encodeURIComponent(searchQuery)}`);
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to search for SKU/ASIN');
			}

			searchResults = data.results;
		} catch (error: unknown) {
			console.error('Error searching for SKU/ASIN:', error);
			errorMessage = error instanceof Error ? error.message : 'An error occurred during search';
		} finally {
			isSearching = false;
		}
	}
</script>

<svelte:head>
	<title>Buy Box Monitor - Jobs</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<h1 class="text-3xl font-bold mb-2">Buy Box Monitor Jobs</h1>
	<p class="text-gray-600 mb-8">Track and manage Buy Box monitoring jobs</p>

	{#if errorMessage}
		<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6" role="alert">
			<p>{errorMessage}</p>
		</div>
	{/if}

	<!-- Action buttons -->
	<div class="flex justify-between mb-6">
		<div>
			<button
				class="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded mr-2"
				on:click={() => fetchJobs()}
			>
				Refresh Jobs
			</button>

			<button
				class="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded mr-2"
				on:click={startNewScan}
				disabled={scanInProgress}
			>
				{#if scanInProgress}
					Scan in Progress...
				{:else}
					Start New Scan
				{/if}
			</button>

			{#if scanInProgress}
				<button
					class="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded"
					on:click={() => {
						const runningJob = jobs.find((job) => job.status === 'running');
						if (runningJob) {
							cancelJob(runningJob.id);
						}
					}}
				>
					Cancel Scan
				</button>
			{/if}
		</div>

		<div>
			<a href="/buy-box-monitor" class="text-blue-600 hover:text-blue-800 underline">
				Go to Buy Box Dashboard
			</a>
		</div>
	</div>

	<!-- Search & Settings Row -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
		<!-- Search SKU/ASIN -->
		<div class="bg-white rounded shadow p-4">
			<h2 class="font-semibold mb-3">Search SKU/ASIN Across All Jobs</h2>
			<div class="flex">
				<input
					type="text"
					placeholder="Enter SKU or ASIN"
					class="border rounded-l px-3 py-2 w-full"
					bind:value={searchQuery}
					on:keypress={(e) => e.key === 'Enter' && searchSkuAsin()}
				/>
				<button
					class="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-r"
					on:click={searchSkuAsin}
					disabled={isSearching}
				>
					{isSearching ? 'Searching...' : 'Search'}
				</button>
			</div>
			<p class="text-xs text-gray-500 mt-1">
				Find a specific SKU or ASIN across all jobs to see its history
			</p>
		</div>

		<!-- Scan Settings Panel -->
		<div class="bg-white rounded shadow p-4">
			<h2 class="font-semibold mb-3">Scan Settings</h2>
			<div class="grid grid-cols-3 gap-4">
				<div>
					<label for="rateLimit" class="block text-sm font-medium text-gray-700 mb-1">
						Rate Limit (req/sec)
					</label>
					<input
						id="rateLimit"
						type="number"
						min="0.1"
						max="2"
						step="0.1"
						class="border rounded px-3 py-2 w-full"
						bind:value={newScanRateLimit}
					/>
					<p class="text-xs text-gray-500 mt-1">
						Lower values reduce API errors (recommended: 0.3-0.5)
					</p>
				</div>
				<div>
					<label for="jitter" class="block text-sm font-medium text-gray-700 mb-1">
						Jitter (ms)
					</label>
					<input
						id="jitter"
						type="number"
						min="100"
						max="2000"
						step="100"
						class="border rounded px-3 py-2 w-full"
						bind:value={newScanJitter}
					/>
					<p class="text-xs text-gray-500 mt-1">Random delay (recommended: 800-1000)</p>
				</div>
				<div>
					<label for="maxRetries" class="block text-sm font-medium text-gray-700 mb-1">
						Max Retries
					</label>
					<input
						id="maxRetries"
						type="number"
						min="1"
						max="10"
						step="1"
						class="border rounded px-3 py-2 w-full"
						bind:value={newScanMaxRetries}
					/>
					<p class="text-xs text-gray-500 mt-1">Retry attempts (recommended: 3-5)</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Main content area -->
	<div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
		<!-- Jobs list -->
		<div class="lg:col-span-1 bg-white rounded shadow">
			<h2 class="bg-gray-100 py-2 px-4 font-semibold border-b">Recent Jobs</h2>

			{#if isLoading}
				<div class="p-4 text-center">
					<p>Loading jobs...</p>
				</div>
			{:else if jobs.length === 0}
				<div class="p-4 text-center">
					<p>No jobs found</p>
				</div>
			{:else}
				<div class="overflow-y-auto max-h-[600px]">
					{#each jobs as job}
						<button
							class="w-full text-left p-3 border-b hover:bg-gray-50 transition-colors"
							class:bg-blue-50={selectedJob?.id === job.id}
							on:click={() => selectJob(job)}
						>
							<div class="flex justify-between items-center">
								<div>
									<span
										class={`inline-block w-3 h-3 rounded-full mr-2 ${
											job.status === 'completed'
												? 'bg-green-500'
												: job.status === 'running'
													? 'bg-blue-500'
													: 'bg-red-500'
										}`}
									></span>
									<span class="font-medium">{job.source}</span>
								</div>
								<span class="text-xs text-gray-500">{formatDate(job.started_at).split(',')[0]}</span
								>
							</div>

							{#if job.status === 'running'}
								<div class="mt-2 w-full bg-gray-200 rounded-full h-2.5">
									<div
										class="bg-blue-600 h-2.5 rounded-full"
										style="width: {calculateProgress(job)}%"
									></div>
								</div>
								<div class="text-xs text-gray-500 mt-1">
									{job.successful_asins + job.failed_asins} / {job.total_asins} ASINs processed
								</div>
							{:else}
								<div class="text-xs text-gray-500 mt-1">
									{job.successful_asins} successful / {job.failed_asins} failed
								</div>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Job details and results -->
		<div class="lg:col-span-3">
			{#if !selectedJob}
				<div class="bg-white rounded shadow p-6 text-center">
					<p class="text-gray-500">Select a job to view details</p>
				</div>
			{:else}
				<!-- Job summary card -->
				<div class="bg-white rounded shadow mb-6">
					<h2
						class="bg-gray-100 py-2 px-4 font-semibold border-b flex justify-between items-center"
					>
						<span>Job Summary</span>
						{#if selectedJob && selectedJob.status === 'running'}
							<button
								class="bg-red-600 hover:bg-red-700 text-white text-xs py-1 px-2 rounded"
								on:click={() => selectedJob && cancelJob(selectedJob.id)}
							>
								Cancel Job
							</button>
						{/if}
					</h2>
					<div class="p-4">
						<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div>
								<p class="text-sm text-gray-500">Status</p>
								<p class="font-medium">
									<span
										class={`inline-block w-2 h-2 rounded-full mr-1 ${
											selectedJob?.status === 'completed'
												? 'bg-green-500'
												: selectedJob?.status === 'running'
													? 'bg-blue-500'
													: 'bg-red-500'
										}`}
									></span>
									{selectedJob?.status.charAt(0).toUpperCase() + selectedJob?.status.slice(1)}
								</p>
							</div>
							<div>
								<p class="text-sm text-gray-500">Started</p>
								<p>{selectedJob?.started_at ? formatDate(selectedJob.started_at) : '-'}</p>
							</div>
							<div>
								<p class="text-sm text-gray-500">Completed</p>
								<p>{selectedJob?.completed_at ? formatDate(selectedJob.completed_at) : '-'}</p>
							</div>
							<div>
								<p class="text-sm text-gray-500">Duration</p>
								<p>
									{selectedJob?.duration_seconds
										? formatDuration(selectedJob.duration_seconds)
										: '-'}
								</p>
							</div>
							<div>
								<p class="text-sm text-gray-500">Processed</p>
								<p>
									{selectedJob ? selectedJob.successful_asins + selectedJob.failed_asins : 0} of {selectedJob?.total_asins ||
										0}
									ASINs
								</p>
							</div>
							<div>
								<p class="text-sm text-gray-500">Success Rate</p>
								<p>
									{selectedJob && selectedJob.total_asins > 0
										? Math.floor((selectedJob.successful_asins / selectedJob.total_asins) * 100)
										: 0}%
								</p>
							</div>
						</div>

						<div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<p class="text-sm text-gray-500">Job ID</p>
								<p class="text-sm font-mono bg-gray-100 p-1 rounded">{selectedJob?.id || '-'}</p>
							</div>
							<div>
								<p class="text-sm text-gray-500">Source</p>
								<p>{selectedJob?.source || '-'}</p>
							</div>
						</div>

						{#if selectedJob.notes}
							<div class="mt-4 p-3 bg-gray-50 rounded">
								<p class="text-sm font-medium">Notes:</p>
								<p class="text-sm">{selectedJob.notes}</p>
							</div>
						{/if}

						{#if selectedJob?.status === 'running'}
							<div class="mt-4">
								<div class="w-full bg-gray-200 rounded-full h-3">
									<div
										class="bg-blue-600 h-3 rounded-full"
										style="width: {selectedJob ? calculateProgress(selectedJob) : 0}%"
									></div>
								</div>
								<div class="flex justify-between text-xs text-gray-500 mt-1">
									<span>0%</span>
									<span>{selectedJob ? calculateProgress(selectedJob) : 0}%</span>
									<span>100%</span>
								</div>
							</div>
						{/if}

						{#if selectedJob?.status === 'failed'}
							<div class="mt-4 flex justify-center">
								<button
									class="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
									on:click={() => {
										// Set scan settings for retry
										newScanRateLimit = 0.3; // Very conservative rate
										newScanJitter = 1000; // More jitter
										newScanMaxRetries = 5; // More retries
										startNewScan();
									}}
								>
									Retry with Conservative Settings
								</button>
							</div>
						{/if}
					</div>
				</div>

				<!-- Results filter -->
				<div class="bg-white rounded shadow mb-6">
					<h2 class="bg-gray-100 py-2 px-4 font-semibold border-b">Results Filter</h2>
					<div class="p-4">
						<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							<!-- Basic Filters -->
							<div class="space-y-2">
								<h3 class="font-medium text-gray-700">Basic Filters</h3>
								<div class="flex items-center">
									<input
										type="checkbox"
										id="show-opportunities"
										class="mr-2"
										bind:checked={showOnlyOpportunities}
									/>
									<label for="show-opportunities" class="text-sm">Show Opportunities Only</label>
								</div>
								<div class="flex items-center">
									<input
										type="checkbox"
										id="show-winners"
										class="mr-2"
										bind:checked={showOnlyWinners}
									/>
									<label for="show-winners" class="text-sm">Show Winners Only</label>
								</div>
								<div class="flex items-center">
									<input
										type="checkbox"
										id="show-profitable"
										class="mr-2"
										bind:checked={showOnlyProfitable}
									/>
									<label for="show-profitable" class="text-sm">Show Profitable Opportunities</label>
								</div>
							</div>

							<!-- Margin Filters -->
							<div class="space-y-2">
								<h3 class="font-medium text-gray-700">Margin Filters</h3>
								<div>
									<label for="min-margin" class="block text-sm text-gray-600">Min Margin %</label>
									<input
										type="number"
										id="min-margin"
										class="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-sm"
										placeholder="0"
										min="0"
										max="100"
										bind:value={minMarginFilter}
									/>
								</div>
							</div>

							<!-- Recommendation Filters -->
							<div class="space-y-2">
								<h3 class="font-medium text-gray-700">Recommendations</h3>
								<div>
									<label for="recommendation-filter" class="block text-sm text-gray-600"
										>Action</label
									>
									<select
										id="recommendation-filter"
										class="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-sm"
										bind:value={recommendationFilter}
									>
										<option value="all">All Recommendations</option>
										<option value="match_buybox">📈 Match Buy Box</option>
										<option value="hold_price">✋ Hold Price</option>
										<option value="investigate">🔍 Investigate</option>
										<option value="not_profitable">❌ Not Profitable</option>
									</select>
								</div>
							</div>
						</div>

						<div class="flex gap-2 mt-4 pt-4 border-t">
							<button
								class="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded text-sm"
								on:click={applyFilters}
							>
								Apply Filters
							</button>
							<button
								class="bg-gray-200 hover:bg-gray-300 py-2 px-4 rounded text-sm"
								on:click={() => {
									showOnlyOpportunities = false;
									showOnlyWinners = false;
									showOnlyProfitable = false;
									minMarginFilter = 0;
									recommendationFilter = 'all';
									applyFilters();
								}}
							>
								Clear Filters
							</button>
						</div>
					</div>
				</div>

				<!-- Results summary -->
				<div class="bg-white rounded shadow mb-6">
					<h2 class="bg-gray-100 py-2 px-4 font-semibold border-b">Results Summary</h2>
					<div class="p-4">
						<div class="grid grid-cols-1 md:grid-cols-5 gap-4 text-center">
							<div class="bg-blue-50 p-3 rounded">
								<p class="text-sm text-gray-500">Total Results</p>
								<p class="text-2xl font-bold">{totalResults}</p>
							</div>
							<div class="bg-green-50 p-3 rounded">
								<p class="text-sm text-gray-500">Buy Box Won</p>
								<p class="text-2xl font-bold text-green-600">{winnerCount}</p>
								<p class="text-xs text-gray-400">We own buy box</p>
							</div>
							<div class="bg-yellow-50 p-3 rounded">
								<p class="text-sm text-gray-500">Opportunities</p>
								<p class="text-2xl font-bold text-yellow-600">{opportunityCount}</p>
								<p class="text-xs text-gray-400">Potential gains</p>
							</div>
							<div class="bg-purple-50 p-3 rounded">
								<p class="text-sm text-gray-500">Profitable Opportunities</p>
								<p class="text-2xl font-bold text-purple-600">{profitableOpportunityCount}</p>
								<p class="text-xs text-gray-400">Worth pursuing</p>
							</div>
							<div class="bg-orange-50 p-3 rounded" title="SKUs with cost data analyzed out of {totalResultsInJob} total">
								<p class="text-sm text-gray-500">Margin Analysis</p>
								<p class="text-2xl font-bold text-orange-600">{marginDataCount}</p>
								<p class="text-xs text-gray-400">of {totalResultsInJob} SKUs</p>
							</div>
						</div>

						{#if jobResults.length > 0}
							<div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-center border-t pt-4">
								<div>
									<p class="text-sm text-gray-500">Avg Current Profit</p>
									<p class={`text-lg font-medium ${averageCurrentProfit >= 2 ? 'text-green-600' : averageCurrentProfit >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
										£{averageCurrentProfit.toFixed(2)}
									</p>
								</div>
								<div>
									<p class="text-sm text-gray-500">Total Profit Opportunity</p>
									<p class="text-lg font-medium text-green-600">
										£{totalProfitOpportunity.toFixed(2)}
									</p>
									<p class="text-xs text-gray-400">If matched to buy box</p>
								</div>
								<div>
									<p class="text-sm text-gray-500">Needs Price Match</p>
									<p class="text-lg font-medium text-blue-600">
										{matchBuyboxCount} SKUs
									</p>
									<p class="text-xs text-gray-400">Recommended actions</p>
								</div>
							</div>
						{/if}
					</div>
				</div>

				<!-- Results table -->
				<div class="bg-white rounded shadow mb-6">
					<h2 class="bg-gray-100 py-2 px-4 font-semibold border-b">Scan Results</h2>

					{#if isResultsLoading}
						<div class="p-8 text-center">
							<p>Loading results...</p>
						</div>
					{:else if jobResults.length === 0}
						<div class="p-8 text-center">
							<p>No results available</p>
						</div>
					{:else}
						<div class="overflow-x-auto">
							<table class="min-w-full">
								<thead class="bg-gray-50">
									<tr>
										<th
											class="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>Product</th
										>
										<th
											class="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>Price Analysis</th
										>
										<th
											class="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>Cost Breakdown</th
										>
										<th
											class="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>Margin Analysis</th
										>
										<th
											class="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>Recommendation</th
										>
										<th
											class="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
											>Actions</th
										>
									</tr>
								</thead>
								<tbody class="divide-y divide-gray-200">
									{#each jobResults as result}
										<tr
											class={`
											hover:bg-gray-50 
											${result.opportunity_flag ? 'bg-yellow-50' : ''} 
											${result.is_winner ? 'bg-green-50' : ''}
											${result.recommended_action === 'match_buybox' ? 'border-l-4 border-l-blue-500' : ''}
											${result.recommended_action === 'not_profitable' ? 'border-l-4 border-l-red-500' : ''}
										`}
										>
											<!-- Product Info -->
											<td class="py-3 px-4">
												<div class="text-sm">
													<div class="font-medium text-gray-900">{result.sku}</div>
													<div class="text-gray-500">{result.asin}</div>
													{#if result.is_winner}
														<span
															class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"
														>
															🏆 Buy Box Winner
														</span>
													{:else if result.opportunity_flag}
														<span
															class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800"
														>
															⚡ Opportunity
														</span>
													{/if}
												</div>
											</td>

											<!-- Price Analysis -->
											<td class="py-3 px-4">
												<div class="text-sm">
													<div class="font-medium">
														Current: £{result.price?.toFixed(2) || 'N/A'}
													</div>
													{#if result.break_even_price}
														<div class="text-gray-600">
															Break-even: £{result.break_even_price.toFixed(2)}
														</div>
													{/if}
													{#if result.price_adjustment_needed && result.price_adjustment_needed !== 0}
														<div
															class={`text-xs ${result.price_adjustment_needed > 0 ? 'text-red-600' : 'text-green-600'}`}
														>
															Adjust: {result.price_adjustment_needed > 0
																? '+'
																: ''}£{result.price_adjustment_needed.toFixed(2)}
														</div>
													{/if}
												</div>
											</td>

											<!-- Cost Breakdown -->
											<td class="py-3 px-4">
												<div class="text-xs space-y-1">
													<div class="font-medium text-gray-700 mb-1">Fixed Costs:</div>
													{#if result.your_cost}
														<div>Base: £{result.your_cost.toFixed(2)}</div>
													{/if}
													{#if result.your_vat_amount}
														<div>VAT: £{result.your_vat_amount.toFixed(2)}</div>
													{/if}
													{#if result.your_box_cost}
														<div>Box: £{result.your_box_cost.toFixed(2)}</div>
													{/if}
													<div>Material: £0.20</div>
													{#if result.your_fragile_charge && result.your_fragile_charge > 0}
														<div>Fragile: £{result.your_fragile_charge.toFixed(2)}</div>
													{/if}
													{#if result.your_shipping_cost}
														<div>Shipping: £{result.your_shipping_cost.toFixed(2)}</div>
													{/if}
													{#if result.total_operating_cost}
														<div class="font-medium border-t pt-1 text-blue-800">
															Total Fixed Costs: £{result.total_operating_cost.toFixed(2)}
														</div>
													{/if}
													
													<div class="font-medium text-gray-700 mt-2 mb-1">Variable Cost:</div>
													{#if result.price}
														<div class="text-red-600">Amazon Fee (15% of £{result.price.toFixed(2)}): £{(result.price * 0.15).toFixed(2)}</div>
													{/if}
													
													{#if result.break_even_price}
														<div class="font-bold border-t pt-2 text-red-800">
															Break-even: £{result.break_even_price.toFixed(2)}
														</div>
														<div class="text-xs text-gray-500">
															(£{result.total_operating_cost?.toFixed(2)} ÷ 0.85)
														</div>
													{/if}
												</div>
											</td>

											<!-- Margin Analysis -->
											<td class="py-3 px-4">
												<div class="text-sm space-y-1">
													{#if result.current_actual_profit !== null}
														<div
															class={`font-bold text-lg ${result.current_actual_profit >= 5 ? 'text-green-600' : result.current_actual_profit >= 1 ? 'text-yellow-600' : result.current_actual_profit >= 0 ? 'text-orange-600' : 'text-red-600'}`}
														>
															£{result.current_actual_profit.toFixed(2)} profit
														</div>
													{/if}
													{#if result.your_margin_percent_at_current_price !== null}
														<div
															class={`font-medium text-xs ${result.your_margin_percent_at_current_price >= 10 ? 'text-green-600' : 'text-red-600'}`}
														>
															Current: {result.your_margin_percent_at_current_price.toFixed(1)}%
															margin
														</div>
													{/if}
													{#if result.buybox_actual_profit !== null && result.buybox_actual_profit !== result.current_actual_profit}
														<div class={`text-xs ${result.buybox_actual_profit >= (result.current_actual_profit || 0) ? 'text-green-600' : 'text-gray-600'}`}>
															At Buy Box: £{result.buybox_actual_profit.toFixed(2)} profit
														</div>
													{/if}
													{#if result.margin_percent_at_buybox_price !== null && result.margin_percent_at_buybox_price !== result.your_margin_percent_at_current_price}
														<div
															class={`text-xs ${result.margin_percent_at_buybox_price >= 10 ? 'text-green-600' : 'text-red-600'}`}
														>
															({result.margin_percent_at_buybox_price.toFixed(1)}% margin)
														</div>
													{/if}
													{#if result.profit_opportunity && result.profit_opportunity > 0}
														<div
															class="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded"
														>
															+£{result.profit_opportunity.toFixed(2)} opportunity
														</div>
													{/if}
													{#if result.margin_difference}
														<div
															class={`text-xs ${result.margin_difference > 0 ? 'text-green-600' : 'text-red-600'}`}
														>
															Difference: {result.margin_difference > 0
																? '+'
																: ''}£{result.margin_difference.toFixed(2)}
														</div>
													{/if}
												</div>
											</td>

											<!-- Recommendation -->
											<td class="py-3 px-4">
												{#if result.recommended_action}
													<span
														class={`inline-flex items-center px-2 py-1 rounded text-xs font-medium
														${result.recommended_action === 'match_buybox' ? 'bg-blue-100 text-blue-800' : ''}
														${result.recommended_action === 'hold_price' ? 'bg-green-100 text-green-800' : ''}
														${result.recommended_action === 'investigate' ? 'bg-yellow-100 text-yellow-800' : ''}
														${result.recommended_action === 'not_profitable' ? 'bg-red-100 text-red-800' : ''}
													`}
													>
														{#if result.recommended_action === 'match_buybox'}
															📈 Match Buy Box
														{:else if result.recommended_action === 'hold_price'}
															✋ Hold Price
														{:else if result.recommended_action === 'investigate'}
															🔍 Investigate
														{:else if result.recommended_action === 'not_profitable'}
															❌ Not Profitable
														{:else}
															{result.recommended_action}
														{/if}
													</span>
												{:else}
													<span class="text-gray-400 text-xs">No data</span>
												{/if}
											</td>

											<!-- Actions -->
											<td class="py-3 px-4">
												<button
													class="text-blue-600 hover:text-blue-800 underline text-sm"
													on:click={() => viewProductDetails(result.asin, result.sku)}
												>
													View Details
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						<!-- Pagination -->
						{#if totalResults > itemsPerPage}
							<div class="flex justify-center py-4">
								<div class="flex space-x-1">
									<button
										class="px-3 py-1 rounded border"
										disabled={currentPage === 1}
										on:click={() => changePage(currentPage - 1)}
									>
										Prev
									</button>

									{#if totalResults > 0}
										{#each Array(Math.ceil(totalResults / itemsPerPage)) as _, i}
											{#if i + 1 === currentPage || i + 1 === 1 || i + 1 === Math.ceil(totalResults / itemsPerPage) || (i + 1 >= currentPage - 1 && i + 1 <= currentPage + 1)}
												<button
													class={`px-3 py-1 rounded border ${currentPage === i + 1 ? 'bg-blue-600 text-white' : ''}`}
													on:click={() => changePage(i + 1)}
												>
													{i + 1}
												</button>
											{:else if (i === 1 && currentPage > 3) || (i === Math.ceil(totalResults / itemsPerPage) - 2 && currentPage < Math.ceil(totalResults / itemsPerPage) - 2)}
												<span class="px-3 py-1">...</span>
											{/if}
										{/each}
									{/if}

									<button
										class="px-3 py-1 rounded border"
										disabled={currentPage === Math.ceil(totalResults / itemsPerPage)}
										on:click={() => changePage(currentPage + 1)}
									>
										Next
									</button>
								</div>
							</div>
						{/if}
					{/if}
				</div>

				<!-- Failures section -->
				{#if selectedJob?.failed_asins > 0}
					<div class="bg-white rounded shadow">
						<h2 class="bg-gray-100 py-2 px-4 font-semibold border-b">Failed ASINs</h2>

						{#if isFailuresLoading}
							<div class="p-8 text-center">
								<p>Loading failure data...</p>
							</div>
						{:else if jobFailures.length === 0}
							<div class="p-8 text-center">
								<p>No failure data available</p>
							</div>
						{:else}
							<div class="overflow-x-auto">
								<table class="min-w-full">
									<thead class="bg-gray-50">
										<tr>
											<th
												class="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>SKU</th
											>
											<th
												class="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>ASIN</th
											>
											<th
												class="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>Error</th
											>
											<th
												class="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>Code</th
											>
											<th
												class="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
												>Attempts</th
											>
										</tr>
									</thead>
									<tbody class="divide-y divide-gray-200">
										{#each jobFailures as failure}
											<tr class="hover:bg-gray-50">
												<td class="py-3 px-4">{failure.sku || 'N/A'}</td>
												<td class="py-3 px-4">{failure.asin}</td>
												<td class="py-3 px-4">{failure.reason}</td>
												<td class="py-3 px-4">{failure.error_code || 'N/A'}</td>
												<td class="py-3 px-4">{failure.attempt_number}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>

<style>
	/* Additional styles if needed */
</style>
