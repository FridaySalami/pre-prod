<!-- Job Management Page -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { userEmail } from '$lib/stores/pricingBasketStore';
	import { get } from 'svelte/store';

	interface JobStatus {
		isRunning: boolean;
		intervalMinutes: number;
		batchSize: number;
		lastRun?: string;
		nextRun?: string;
	}

	interface JobStatistics {
		totalRuns: number;
		totalErrors: number;
		totalProcessed: number;
		totalAlerts: number;
		averageDuration: number;
		lastRun?: string;
		recentLogs: any[];
	}

	interface JobLog {
		id: string;
		status: string;
		metadata: any;
		timestamp: string;
	}

	let jobStatus: JobStatus = {
		isRunning: false,
		intervalMinutes: 30,
		batchSize: 10
	};

	let jobStatistics: JobStatistics = {
		totalRuns: 0,
		totalErrors: 0,
		totalProcessed: 0,
		totalAlerts: 0,
		averageDuration: 0,
		recentLogs: []
	};

	let recentLogs: JobLog[] = [];
	let activeConfigs: any[] = [];
	let isLoading = false;
	let statusRefreshInterval: NodeJS.Timeout;

	// Form state
	let intervalMinutes = 30;
	let batchSize = 10;
	let maxRetries = 3;
	let retryDelayMs = 5000;
	let manualCheckAsin = '';

	// Modal state
	let showJobConfig = false;
	let showManualCheck = false;
	let showLogsModal = false;

	const API_BASE = 'http://localhost:3001';

	onMount(async () => {
		await loadJobStatus();
		await loadJobStatistics();
		await loadRecentLogs();
		await loadActiveConfigs();

		// Auto-refresh status every 30 seconds
		statusRefreshInterval = setInterval(async () => {
			await loadJobStatus();
		}, 30000);
	});

	onDestroy(() => {
		if (statusRefreshInterval) {
			clearInterval(statusRefreshInterval);
		}
	});

	async function loadJobStatus() {
		try {
			const response = await fetch(`${API_BASE}/api/monitoring-job/status`);
			const data = await response.json();

			if (data.success) {
				jobStatus = data.status;
				if (data.statistics) {
					jobStatistics = data.statistics;
				}
			}
		} catch (error) {
			console.error('Error loading job status:', error);
		}
	}

	async function loadJobStatistics() {
		try {
			const response = await fetch(`${API_BASE}/api/monitoring-job/statistics?days=7`);
			const data = await response.json();

			if (data.success) {
				jobStatistics = data.statistics;
			}
		} catch (error) {
			console.error('Error loading job statistics:', error);
		}
	}

	async function loadRecentLogs() {
		try {
			const response = await fetch(`${API_BASE}/api/monitoring-job/logs?limit=10`);
			const data = await response.json();

			if (data.success) {
				recentLogs = data.logs;
			}
		} catch (error) {
			console.error('Error loading recent logs:', error);
		}
	}

	async function loadActiveConfigs() {
		try {
			const response = await fetch(`${API_BASE}/api/monitoring-job/active-configs`);
			const data = await response.json();

			if (data.success) {
				activeConfigs = data.configs;
			}
		} catch (error) {
			console.error('Error loading active configs:', error);
		}
	}

	async function startJob() {
		isLoading = true;
		try {
			const response = await fetch(`${API_BASE}/api/monitoring-job/start`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ intervalMinutes })
			});

			const data = await response.json();

			if (data.success) {
				await loadJobStatus();
				alert('Monitoring job started successfully!');
			} else {
				alert(`Error starting job: ${data.error}`);
			}
		} catch (error) {
			console.error('Error starting job:', error);
			alert('Failed to start monitoring job');
		} finally {
			isLoading = false;
		}
	}

	async function stopJob() {
		if (!confirm('Are you sure you want to stop the monitoring job?')) return;

		isLoading = true;
		try {
			const response = await fetch(`${API_BASE}/api/monitoring-job/stop`, {
				method: 'POST'
			});

			const data = await response.json();

			if (data.success) {
				await loadJobStatus();
				alert('Monitoring job stopped successfully!');
			} else {
				alert(`Error stopping job: ${data.error}`);
			}
		} catch (error) {
			console.error('Error stopping job:', error);
			alert('Failed to stop monitoring job');
		} finally {
			isLoading = false;
		}
	}

	async function updateJobConfig() {
		isLoading = true;
		try {
			const response = await fetch(`${API_BASE}/api/monitoring-job/update-config`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ batchSize, maxRetries, retryDelayMs })
			});

			const data = await response.json();

			if (data.success) {
				showJobConfig = false;
				alert('Job configuration updated successfully!');
			} else {
				alert(`Error updating config: ${data.error}`);
			}
		} catch (error) {
			console.error('Error updating job config:', error);
			alert('Failed to update job configuration');
		} finally {
			isLoading = false;
		}
	}

	async function runManualCheck() {
		if (!manualCheckAsin.trim()) {
			alert('Please enter an ASIN');
			return;
		}

		isLoading = true;
		try {
			const response = await fetch(`${API_BASE}/api/monitoring-job/manual-check`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					asin: manualCheckAsin.trim(),
					userEmail: get(userEmail)
				})
			});

			const data = await response.json();

			if (data.success) {
				alert(`Manual check completed for ${data.asin}. Generated ${data.alertsGenerated} alerts.`);
				manualCheckAsin = '';
				showManualCheck = false;
			} else {
				alert(`Error running manual check: ${data.error}`);
			}
		} catch (error) {
			console.error('Error running manual check:', error);
			alert('Failed to run manual check');
		} finally {
			isLoading = false;
		}
	}

	async function runManualCycle() {
		if (!confirm('This will run a complete monitoring cycle for all active ASINs. Continue?'))
			return;

		isLoading = true;
		try {
			const response = await fetch(`${API_BASE}/api/monitoring-job/run-cycle`, {
				method: 'POST'
			});

			const data = await response.json();

			if (data.success) {
				alert('Manual monitoring cycle started. Check logs for progress.');
				await loadRecentLogs();
			} else {
				alert(`Error starting manual cycle: ${data.error}`);
			}
		} catch (error) {
			console.error('Error starting manual cycle:', error);
			alert('Failed to start manual cycle');
		} finally {
			isLoading = false;
		}
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'started':
				return 'text-green-600 bg-green-100';
			case 'stopped':
				return 'text-red-600 bg-red-100';
			case 'cycle_completed':
				return 'text-blue-600 bg-blue-100';
			case 'cycle_error':
				return 'text-red-600 bg-red-100';
			default:
				return 'text-gray-600 bg-gray-100';
		}
	}

	function formatDuration(ms: number) {
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${Math.round(ms / 1000)}s`;
		return `${Math.round(ms / 60000)}m`;
	}

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleString();
	}
</script>

<div class="container mx-auto px-4 py-8">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900 mb-2">Job Management</h1>
		<p class="text-gray-600">Monitor and control the buy box monitoring job</p>
	</div>

	<!-- Job Status Card -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
		<div class="bg-white p-6 rounded-lg shadow">
			<h2 class="text-xl font-semibold text-gray-900 mb-4">Job Status</h2>
			<div class="space-y-3">
				<div class="flex justify-between items-center">
					<span class="text-gray-600">Status:</span>
					<span class="font-semibold {jobStatus.isRunning ? 'text-green-600' : 'text-red-600'}">
						{jobStatus.isRunning ? 'Running' : 'Stopped'}
					</span>
				</div>
				<div class="flex justify-between items-center">
					<span class="text-gray-600">Interval:</span>
					<span class="font-semibold">{jobStatus.intervalMinutes} minutes</span>
				</div>
				<div class="flex justify-between items-center">
					<span class="text-gray-600">Batch Size:</span>
					<span class="font-semibold">{jobStatus.batchSize} ASINs</span>
				</div>
				{#if jobStatus.lastRun}
					<div class="flex justify-between items-center">
						<span class="text-gray-600">Last Run:</span>
						<span class="font-mono text-sm">{formatDate(jobStatus.lastRun)}</span>
					</div>
				{/if}
				{#if jobStatus.nextRun}
					<div class="flex justify-between items-center">
						<span class="text-gray-600">Next Run:</span>
						<span class="font-mono text-sm">{formatDate(jobStatus.nextRun)}</span>
					</div>
				{/if}
			</div>

			<div class="mt-6 flex gap-3">
				{#if jobStatus.isRunning}
					<button
						on:click={stopJob}
						disabled={isLoading}
						class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
					>
						Stop Job
					</button>
				{:else}
					<button
						on:click={startJob}
						disabled={isLoading}
						class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
					>
						Start Job
					</button>
				{/if}
				<button
					on:click={() => (showJobConfig = true)}
					class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
				>
					Configure
				</button>
			</div>
		</div>

		<!-- Statistics Card -->
		<div class="bg-white p-6 rounded-lg shadow">
			<h2 class="text-xl font-semibold text-gray-900 mb-4">Statistics (Last 7 Days)</h2>
			<div class="grid grid-cols-2 gap-4">
				<div class="text-center">
					<div class="text-2xl font-bold text-blue-600">{jobStatistics.totalRuns}</div>
					<div class="text-sm text-gray-500">Total Runs</div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold text-red-600">{jobStatistics.totalErrors}</div>
					<div class="text-sm text-gray-500">Errors</div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold text-green-600">{jobStatistics.totalProcessed}</div>
					<div class="text-sm text-gray-500">ASINs Processed</div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold text-purple-600">{jobStatistics.totalAlerts}</div>
					<div class="text-sm text-gray-500">Alerts Generated</div>
				</div>
			</div>
			{#if jobStatistics.averageDuration > 0}
				<div class="mt-4 text-center">
					<div class="text-lg font-semibold text-gray-700">
						Avg Duration: {formatDuration(jobStatistics.averageDuration)}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Actions -->
	<div class="mb-8">
		<div class="bg-white p-6 rounded-lg shadow">
			<h2 class="text-xl font-semibold text-gray-900 mb-4">Actions</h2>
			<div class="flex flex-wrap gap-3">
				<button
					on:click={() => (showManualCheck = true)}
					class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
				>
					Manual Check
				</button>
				<button
					on:click={runManualCycle}
					disabled={isLoading || jobStatus.isRunning}
					class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
				>
					Run Full Cycle
				</button>
				<button
					on:click={() => (showLogsModal = true)}
					class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
				>
					View Full Logs
				</button>
				<button
					on:click={() => {
						loadJobStatus();
						loadJobStatistics();
						loadRecentLogs();
						loadActiveConfigs();
					}}
					class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
				>
					Refresh All
				</button>
			</div>
		</div>
	</div>

	<!-- Active Configurations -->
	<div class="mb-8">
		<div class="bg-white p-6 rounded-lg shadow">
			<h2 class="text-xl font-semibold text-gray-900 mb-4">Active Monitoring Configurations</h2>
			<div class="text-sm text-gray-600 mb-4">
				{activeConfigs.length} ASINs configured for monitoring
			</div>
			{#if activeConfigs.length > 0}
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ASIN</th
								>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
									>Priority</th
								>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
									>Last Checked</th
								>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
									>Check Count</th
								>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
									>Total Alerts</th
								>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-200">
							{#each activeConfigs.slice(0, 10) as config}
								<tr>
									<td class="px-6 py-4 font-mono text-sm">{config.asin}</td>
									<td class="px-6 py-4 text-sm">{config.priority}</td>
									<td class="px-6 py-4 text-sm">
										{config.last_checked ? formatDate(config.last_checked) : 'Never'}
									</td>
									<td class="px-6 py-4 text-sm">{config.check_count || 0}</td>
									<td class="px-6 py-4 text-sm">
										{config.price_monitoring_stats?.[0]?.total_alerts || 0}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				{#if activeConfigs.length > 10}
					<div class="mt-4 text-sm text-gray-500">
						Showing first 10 of {activeConfigs.length} configurations
					</div>
				{/if}
			{:else}
				<div class="text-center py-8 text-gray-500">No active monitoring configurations found</div>
			{/if}
		</div>
	</div>

	<!-- Recent Logs -->
	<div class="bg-white p-6 rounded-lg shadow">
		<h2 class="text-xl font-semibold text-gray-900 mb-4">Recent Logs</h2>
		{#if recentLogs.length > 0}
			<div class="space-y-3">
				{#each recentLogs as log}
					<div class="flex justify-between items-center p-3 bg-gray-50 rounded">
						<div class="flex items-center space-x-3">
							<span
								class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusColor(
									log.status
								)}"
							>
								{log.status}
							</span>
							<span class="text-sm text-gray-900">
								{log.metadata?.message || 'No message'}
							</span>
						</div>
						<span class="text-sm text-gray-500">{formatDate(log.timestamp)}</span>
					</div>
				{/each}
			</div>
		{:else}
			<div class="text-center py-8 text-gray-500">No recent logs available</div>
		{/if}
	</div>
</div>

<!-- Job Configuration Modal -->
{#if showJobConfig}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
		<div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
			<h3 class="text-lg font-medium text-gray-900 mb-4">Job Configuration</h3>
			<div class="space-y-4">
				<div>
					<label for="interval-input" class="block text-sm font-medium text-gray-700 mb-1"
						>Interval (minutes)</label
					>
					<input
						id="interval-input"
						type="number"
						bind:value={intervalMinutes}
						min="5"
						max="1440"
						class="w-full px-3 py-2 border border-gray-300 rounded"
					/>
				</div>
				<div>
					<label for="batch-size-input" class="block text-sm font-medium text-gray-700 mb-1"
						>Batch Size</label
					>
					<input
						id="batch-size-input"
						type="number"
						bind:value={batchSize}
						min="1"
						max="50"
						class="w-full px-3 py-2 border border-gray-300 rounded"
					/>
				</div>
				<div>
					<label for="max-retries-input" class="block text-sm font-medium text-gray-700 mb-1"
						>Max Retries</label
					>
					<input
						id="max-retries-input"
						type="number"
						bind:value={maxRetries}
						min="1"
						max="10"
						class="w-full px-3 py-2 border border-gray-300 rounded"
					/>
				</div>
				<div>
					<label for="retry-delay-input" class="block text-sm font-medium text-gray-700 mb-1"
						>Retry Delay (ms)</label
					>
					<input
						id="retry-delay-input"
						type="number"
						bind:value={retryDelayMs}
						min="1000"
						max="60000"
						step="1000"
						class="w-full px-3 py-2 border border-gray-300 rounded"
					/>
				</div>
			</div>
			<div class="flex justify-end gap-3 mt-6">
				<button
					on:click={() => (showJobConfig = false)}
					class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
				>
					Cancel
				</button>
				<button
					on:click={updateJobConfig}
					disabled={isLoading}
					class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
				>
					Update
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Manual Check Modal -->
{#if showManualCheck}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
		<div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
			<h3 class="text-lg font-medium text-gray-900 mb-4">Manual Check</h3>
			<div class="space-y-4">
				<div>
					<label for="manual-asin-input" class="block text-sm font-medium text-gray-700 mb-1"
						>ASIN</label
					>
					<input
						id="manual-asin-input"
						type="text"
						bind:value={manualCheckAsin}
						placeholder="Enter ASIN to check"
						class="w-full px-3 py-2 border border-gray-300 rounded"
					/>
				</div>
			</div>
			<div class="flex justify-end gap-3 mt-6">
				<button
					on:click={() => {
						showManualCheck = false;
						manualCheckAsin = '';
					}}
					class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
				>
					Cancel
				</button>
				<button
					on:click={runManualCheck}
					disabled={isLoading}
					class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
				>
					Run Check
				</button>
			</div>
		</div>
	</div>
{/if}
