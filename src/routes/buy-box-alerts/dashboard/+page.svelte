<!-- Alert Dashboard Page -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { userEmail } from '$lib/stores/pricingBasketStore';
	import { get } from 'svelte/store';

	interface Alert {
		id: string;
		type: string;
		severity: string;
		asin: string;
		sku: string;
		message: string;
		alert_data: any;
		status: string;
		created_at: string;
		acknowledged_at?: string;
	}

	interface AlertStats {
		total: number;
		active: number;
		critical: number;
		high: number;
		medium: number;
		low: number;
		buy_box_lost: number;
		price_changes: number;
	}

	let alerts: Alert[] = [];
	let alertStats: AlertStats = {
		total: 0,
		active: 0,
		critical: 0,
		high: 0,
		medium: 0,
		low: 0,
		buy_box_lost: 0,
		price_changes: 0
	};

	let isLoading = false;
	let selectedAlert: Alert | null = null;
	let showAlertModal = false;
	let filterType = 'all';
	let filterSeverity = 'all';
	let filterStatus = 'active';
	let currentPage = 1;
	let itemsPerPage = 20;

	onMount(async () => {
		await loadAlerts();
		await loadAlertStats();
	});

	async function loadAlerts() {
		isLoading = true;
		try {
			let query = supabase
				.from('price_monitoring_alerts')
				.select('*')
				.eq('user_email', get(userEmail))
				.order('created_at', { ascending: false });

			// Apply filters
			if (filterType !== 'all') {
				query = query.eq('type', filterType);
			}
			if (filterSeverity !== 'all') {
				query = query.eq('severity', filterSeverity);
			}
			if (filterStatus !== 'all') {
				query = query.eq('status', filterStatus);
			}

			// Apply pagination
			const startIndex = (currentPage - 1) * itemsPerPage;
			const endIndex = startIndex + itemsPerPage - 1;
			query = query.range(startIndex, endIndex);

			const { data, error } = await query;

			if (error) throw error;

			alerts = data || [];
			console.log(`Loaded ${alerts.length} alerts`);
		} catch (error) {
			console.error('Error loading alerts:', error);
		} finally {
			isLoading = false;
		}
	}

	async function loadAlertStats() {
		try {
			const { data, error } = await supabase
				.from('price_monitoring_alerts')
				.select('type, severity, status')
				.eq('user_email', get(userEmail));

			if (error) throw error;

			const stats = data?.reduce(
				(acc, alert) => {
					acc.total++;

					if (alert.status === 'active') acc.active++;

					switch (alert.severity) {
						case 'critical':
							acc.critical++;
							break;
						case 'high':
							acc.high++;
							break;
						case 'medium':
							acc.medium++;
							break;
						case 'low':
							acc.low++;
							break;
					}

					if (alert.type === 'buy_box_ownership_change') acc.buy_box_lost++;
					if (alert.type === 'price_threshold_breach') acc.price_changes++;

					return acc;
				},
				{
					total: 0,
					active: 0,
					critical: 0,
					high: 0,
					medium: 0,
					low: 0,
					buy_box_lost: 0,
					price_changes: 0
				}
			);

			alertStats = stats || alertStats;
		} catch (error) {
			console.error('Error loading alert stats:', error);
		}
	}

	async function acknowledgeAlert(alertId: string) {
		try {
			const { error } = await supabase
				.from('price_monitoring_alerts')
				.update({
					status: 'acknowledged',
					acknowledged_at: new Date().toISOString(),
					acknowledged_by: get(userEmail)
				})
				.eq('id', alertId);

			if (error) throw error;

			await loadAlerts();
			await loadAlertStats();
		} catch (error) {
			console.error('Error acknowledging alert:', error);
		}
	}

	async function acknowledgeAllActive() {
		if (!confirm('Are you sure you want to acknowledge all active alerts?')) return;

		try {
			const { error } = await supabase
				.from('price_monitoring_alerts')
				.update({
					status: 'acknowledged',
					acknowledged_at: new Date().toISOString(),
					acknowledged_by: get(userEmail)
				})
				.eq('user_email', get(userEmail))
				.eq('status', 'active');

			if (error) throw error;

			await loadAlerts();
			await loadAlertStats();
		} catch (error) {
			console.error('Error acknowledging all alerts:', error);
		}
	}

	function openAlertModal(alert: Alert) {
		selectedAlert = alert;
		showAlertModal = true;
	}

	function getSeverityColor(severity: string) {
		switch (severity) {
			case 'critical':
				return 'text-red-600 bg-red-100';
			case 'high':
				return 'text-orange-600 bg-orange-100';
			case 'medium':
				return 'text-yellow-600 bg-yellow-100';
			case 'low':
				return 'text-blue-600 bg-blue-100';
			default:
				return 'text-gray-600 bg-gray-100';
		}
	}

	function getTypeIcon(type: string) {
		switch (type) {
			case 'buy_box_ownership_change':
				return '🏆';
			case 'price_threshold_breach':
				return '💰';
			case 'competitive_reaction':
				return '🎯';
			case 'new_competitor':
				return '👥';
			default:
				return '📊';
		}
	}

	function formatAlertType(type: string) {
		return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
	}

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleString();
	}

	// Reactive statements for filtering
	$: {
		currentPage = 1; // Reset to first page when filters change
		loadAlerts();
	}

	$: filteredAlertCount = alerts.length;
</script>

<div class="container mx-auto px-4 py-8">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900 mb-2">Buy Box Alerts Dashboard</h1>
		<p class="text-gray-600">Monitor and manage alerts for your configured ASINs</p>
	</div>

	<!-- Stats Overview -->
	<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-2xl font-bold text-gray-900">{alertStats.total}</div>
			<div class="text-sm text-gray-500">Total Alerts</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-2xl font-bold text-blue-600">{alertStats.active}</div>
			<div class="text-sm text-gray-500">Active</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-2xl font-bold text-red-600">{alertStats.critical}</div>
			<div class="text-sm text-gray-500">Critical</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-2xl font-bold text-orange-600">{alertStats.high}</div>
			<div class="text-sm text-gray-500">High Priority</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-2xl font-bold text-purple-600">{alertStats.buy_box_lost}</div>
			<div class="text-sm text-gray-500">Buy Box Lost</div>
		</div>
		<div class="bg-white p-4 rounded-lg shadow">
			<div class="text-2xl font-bold text-green-600">{alertStats.price_changes}</div>
			<div class="text-sm text-gray-500">Price Changes</div>
		</div>
	</div>

	<!-- Actions -->
	<div class="mb-6 flex justify-between items-center">
		<div class="flex gap-4">
			<!-- Filters -->
			<select bind:value={filterStatus} class="px-3 py-2 border border-gray-300 rounded">
				<option value="all">All Status</option>
				<option value="active">Active</option>
				<option value="acknowledged">Acknowledged</option>
				<option value="resolved">Resolved</option>
			</select>

			<select bind:value={filterSeverity} class="px-3 py-2 border border-gray-300 rounded">
				<option value="all">All Severity</option>
				<option value="critical">Critical</option>
				<option value="high">High</option>
				<option value="medium">Medium</option>
				<option value="low">Low</option>
			</select>

			<select bind:value={filterType} class="px-3 py-2 border border-gray-300 rounded">
				<option value="all">All Types</option>
				<option value="buy_box_ownership_change">Buy Box Changes</option>
				<option value="price_threshold_breach">Price Changes</option>
				<option value="competitive_reaction">Competitive Activity</option>
				<option value="new_competitor">New Competitors</option>
			</select>
		</div>

		<div class="flex gap-2">
			<button
				on:click={acknowledgeAllActive}
				class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
				disabled={alertStats.active === 0}
			>
				Acknowledge All Active
			</button>
			<button
				on:click={() => {
					loadAlerts();
					loadAlertStats();
				}}
				class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
			>
				Refresh
			</button>
		</div>
	</div>

	<!-- Alerts Table -->
	{#if isLoading}
		<div class="text-center py-8">
			<div
				class="animate-spin inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"
			></div>
			<p class="mt-2 text-gray-600">Loading alerts...</p>
		</div>
	{:else if alerts.length === 0}
		<div class="text-center py-8 bg-gray-50 rounded-lg">
			<p class="text-gray-500">No alerts found matching your criteria.</p>
		</div>
	{:else}
		<div class="bg-white shadow rounded-lg overflow-hidden">
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Alert</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>ASIN/SKU</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Severity</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Status</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Created</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Actions</th
							>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each alerts as alert}
							<tr class="hover:bg-gray-50 cursor-pointer" on:click={() => openAlertModal(alert)}>
								<td class="px-6 py-4">
									<div class="flex items-center">
										<span class="text-lg mr-2">{getTypeIcon(alert.type)}</span>
										<div>
											<div class="text-sm font-medium text-gray-900 truncate max-w-xs">
												{formatAlertType(alert.type)}
											</div>
											<div class="text-sm text-gray-500 truncate max-w-xs" title={alert.message}>
												{alert.message}
											</div>
										</div>
									</div>
								</td>
								<td class="px-6 py-4">
									<div class="text-sm font-mono text-gray-900">{alert.asin}</div>
									<div class="text-sm text-gray-500">{alert.sku}</div>
								</td>
								<td class="px-6 py-4">
									<span
										class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getSeverityColor(
											alert.severity
										)}"
									>
										{alert.severity.toUpperCase()}
									</span>
								</td>
								<td class="px-6 py-4">
									<span
										class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {alert.status ===
										'active'
											? 'bg-red-100 text-red-800'
											: 'bg-green-100 text-green-800'}"
									>
										{alert.status.toUpperCase()}
									</span>
								</td>
								<td class="px-6 py-4 text-sm text-gray-500">
									{formatDate(alert.created_at)}
								</td>
								<td class="px-6 py-4">
									{#if alert.status === 'active'}
										<button
											on:click|stopPropagation={() => acknowledgeAlert(alert.id)}
											class="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
										>
											Acknowledge
										</button>
									{:else}
										<span class="text-sm text-gray-400">
											{alert.acknowledged_at ? 'Acknowledged' : 'Resolved'}
										</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Pagination -->
		<div class="mt-4 flex justify-between items-center">
			<div class="text-sm text-gray-500">
				Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(
					currentPage * itemsPerPage,
					filteredAlertCount
				)} of {filteredAlertCount} alerts
			</div>
			<div class="flex gap-2">
				<button
					on:click={() => {
						currentPage = Math.max(1, currentPage - 1);
					}}
					disabled={currentPage === 1}
					class="px-3 py-1 bg-gray-300 text-gray-700 rounded disabled:opacity-50"
				>
					Previous
				</button>
				<span class="px-3 py-1 bg-blue-100 text-blue-800 rounded">
					Page {currentPage}
				</span>
				<button
					on:click={() => {
						currentPage++;
					}}
					disabled={alerts.length < itemsPerPage}
					class="px-3 py-1 bg-gray-300 text-gray-700 rounded disabled:opacity-50"
				>
					Next
				</button>
			</div>
		</div>
	{/if}
</div>

<!-- Alert Detail Modal -->
{#if showAlertModal && selectedAlert}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
		<div
			class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white"
		>
			<div class="mt-3">
				<div class="flex justify-between items-start mb-4">
					<div>
						<h3 class="text-lg font-medium text-gray-900 flex items-center">
							<span class="text-2xl mr-2">{getTypeIcon(selectedAlert.type)}</span>
							{formatAlertType(selectedAlert.type)}
						</h3>
						<div class="mt-1">
							<span
								class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getSeverityColor(
									selectedAlert.severity
								)}"
							>
								{selectedAlert.severity.toUpperCase()}
							</span>
						</div>
					</div>
					<button
						on:click={() => {
							showAlertModal = false;
							selectedAlert = null;
						}}
						class="text-gray-400 hover:text-gray-600"
						aria-label="Close modal"
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							></path>
						</svg>
					</button>
				</div>

				<div class="space-y-4">
					<!-- Basic Info -->
					<div class="bg-gray-50 p-4 rounded">
						<h4 class="font-medium text-gray-900 mb-2">Alert Details</h4>
						<dl class="grid grid-cols-2 gap-2 text-sm">
							<dt class="font-medium text-gray-500">ASIN:</dt>
							<dd class="font-mono">{selectedAlert.asin}</dd>
							<dt class="font-medium text-gray-500">SKU:</dt>
							<dd>{selectedAlert.sku}</dd>
							<dt class="font-medium text-gray-500">Created:</dt>
							<dd>{formatDate(selectedAlert.created_at)}</dd>
							<dt class="font-medium text-gray-500">Status:</dt>
							<dd class="capitalize">{selectedAlert.status}</dd>
						</dl>
					</div>

					<!-- Message -->
					<div>
						<h4 class="font-medium text-gray-900 mb-2">Message</h4>
						<p class="text-gray-700 bg-blue-50 p-3 rounded">{selectedAlert.message}</p>
					</div>

					<!-- Alert Data -->
					{#if selectedAlert.alert_data}
						<div>
							<h4 class="font-medium text-gray-900 mb-2">Additional Data</h4>
							<div class="bg-gray-50 p-4 rounded">
								<pre class="text-sm text-gray-700 whitespace-pre-wrap">{JSON.stringify(
										selectedAlert.alert_data,
										null,
										2
									)}</pre>
							</div>
						</div>
					{/if}
				</div>

				<div class="flex justify-end gap-3 mt-6">
					{#if selectedAlert?.status === 'active'}
						<button
							on:click={() => {
								if (selectedAlert?.id) {
									acknowledgeAlert(selectedAlert.id);
									showAlertModal = false;
									selectedAlert = null;
								}
							}}
							class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
						>
							Acknowledge Alert
						</button>
					{/if}
					<button
						on:click={() => {
							showAlertModal = false;
							selectedAlert = null;
						}}
						class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
					>
						Close
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.truncate {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
