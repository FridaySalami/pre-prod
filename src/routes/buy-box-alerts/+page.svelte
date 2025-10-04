<!-- Alert Configuration Page -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { userEmail } from '$lib/stores/pricingBasketStore';
	import { get } from 'svelte/store';
	import BuyBoxAlert from '$lib/components/BuyBoxAlert.svelte';
	import CompetitorAnalysisTable from '$lib/components/CompetitorAnalysisTable.svelte';
	import type { BuyBoxAlert as BuyBoxAlertType, BuyBoxData } from '$lib/types/buyBoxTypes';

	interface MonitoringConfig {
		id?: string;
		asin: string;
		sku: string;
		item_name?: string;
		monitoring_enabled: boolean;
		priority: number;
		price_change_threshold: number;
		alert_types: string[];
		alert_frequency: string;
		current_price?: number;
		buy_box_status?: boolean;
	}

	interface ValidationMismatch {
		asin: string;
		currentSku: string;
		correctSku: string;
		notFound: boolean;
	}

	// API Configuration
	const API_BASE_URL = ''; // Use relative URLs for production compatibility

	let availableAsins: any[] = [];
	let monitoringConfigs: MonitoringConfig[] = [];
	let selectedAsins: Set<string> = new Set();
	let isLoading = false;
	let searchTerm = '';
	let showConfigModal = false;
	let editingConfig: MonitoringConfig | null = null;

	// Alert configuration options
	const priorityOptions = [
		{ value: 1, label: 'Critical - Check every 15 minutes', color: 'text-red-600' },
		{ value: 2, label: 'High - Check hourly', color: 'text-orange-600' },
		{ value: 3, label: 'Medium - Check every 4 hours', color: 'text-yellow-600' },
		{ value: 4, label: 'Low - Check twice daily', color: 'text-blue-600' },
		{ value: 5, label: 'Monitor - Check daily', color: 'text-gray-600' }
	];

	const alertTypeOptions = [
		{ value: 'email', label: 'Email Notifications' },
		{ value: 'webhook', label: 'Webhook/Slack' },
		{ value: 'database', label: 'Dashboard Alerts' }
	];

	const frequencyOptions = [
		{ value: 'immediate', label: 'Immediate' },
		{ value: 'hourly', label: 'Hourly Digest' },
		{ value: 'daily', label: 'Daily Summary' }
	];

	onMount(async () => {
		await loadAvailableAsins();
		await loadMonitoringConfigs();
	});

	async function loadAvailableAsins() {
		isLoading = true;
		try {
			// Get ASINs with recent buy box data and pricing info
			const { data, error } = await supabase
				.from('sku_asin_mapping')
				.select(
					`
          asin1,
          seller_sku,
          item_name,
          current_price,
          buybox_data!inner(
            is_winner,
            buybox_price,
            timestamp
          )
        `
				)
				.not('asin1', 'is', null)
				.eq('monitoring_enabled', true)
				.order('item_name');

			if (error) throw error;

			// Process and deduplicate ASINs, getting the most recent buy box data
			const asinMap = new Map();
			data?.forEach((item: any) => {
				const asin = item.asin1;
				if (
					!asinMap.has(asin) ||
					new Date(item.buybox_data.timestamp) > new Date(asinMap.get(asin).latest_check)
				) {
					asinMap.set(asin, {
						asin: asin,
						sku: item.seller_sku,
						item_name: item.item_name,
						current_price: item.current_price,
						buy_box_status: item.buybox_data.is_winner,
						buybox_price: item.buybox_data.buybox_price,
						latest_check: item.buybox_data.timestamp
					});
				}
			});

			availableAsins = Array.from(asinMap.values()).slice(0, 200); // Limit to top 200 for performance
			console.log(`Loaded ${availableAsins.length} ASINs for alert configuration`);
		} catch (error) {
			console.error('Error loading ASINs:', error);
		} finally {
			isLoading = false;
		}
	}

	async function loadMonitoringConfigs() {
		try {
			const { data, error } = await supabase
				.from('price_monitoring_config')
				.select('*')
				.eq('user_email', get(userEmail))
				.order('priority');

			if (error) throw error;

			monitoringConfigs = data || [];
			selectedAsins = new Set(monitoringConfigs.map((config) => config.asin));
		} catch (error) {
			console.error('Error loading monitoring configs:', error);
		}
	}

	function openConfigModal(asin?: string) {
		if (asin) {
			const existing = monitoringConfigs.find((c) => c.asin === asin);
			const asinData = availableAsins.find((a) => a.asin === asin);

			editingConfig = existing || {
				asin: asin,
				sku: asinData?.sku || '',
				item_name: asinData?.item_name || '',
				monitoring_enabled: true,
				priority: 3,
				price_change_threshold: 5.0,
				alert_types: ['email', 'database'],
				alert_frequency: 'immediate'
			};
		} else {
			editingConfig = {
				asin: '',
				sku: '',
				monitoring_enabled: true,
				priority: 3,
				price_change_threshold: 5.0,
				alert_types: ['email', 'database'],
				alert_frequency: 'immediate'
			};
		}
		showConfigModal = true;
	}

	async function saveConfig() {
		if (!editingConfig) return;

		try {
			if (editingConfig.id) {
				// Update existing configuration
				const configData = {
					user_email: get(userEmail),
					asin: editingConfig.asin,
					sku: editingConfig.sku,
					monitoring_enabled: editingConfig.monitoring_enabled,
					priority: editingConfig.priority,
					price_change_threshold: editingConfig.price_change_threshold,
					alert_types: editingConfig.alert_types,
					alert_frequency: editingConfig.alert_frequency
				};

				const { error } = await supabase
					.from('price_monitoring_config')
					.update(configData)
					.eq('id', editingConfig.id);

				if (error) throw error;
			} else {
				// Add new ASIN using the ASIN-SKU mapping API
				const response = await fetch(`${API_BASE_URL}/api/asin-sku/add-asin`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						asin: editingConfig.asin,
						userEmail: get(userEmail),
						options: {
							enabled: editingConfig.monitoring_enabled,
							priority: editingConfig.priority,
							priceChangeThreshold: editingConfig.price_change_threshold,
							alertTypes: editingConfig.alert_types,
							alertFrequency: editingConfig.alert_frequency
						}
					})
				});

				const result = await response.json();

				if (!result.success) {
					throw new Error(result.error || 'Failed to add ASIN to monitoring');
				}

				console.log('✅ Successfully added ASIN with correct SKU:', result.data);
			}

			await loadMonitoringConfigs();
			showConfigModal = false;
			editingConfig = null;
		} catch (error) {
			console.error('Error saving config:', error);
			alert(
				`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	async function deleteConfig(configId: string) {
		if (!confirm('Are you sure you want to delete this monitoring configuration?')) return;

		try {
			const { error } = await supabase.from('price_monitoring_config').delete().eq('id', configId);

			if (error) throw error;

			await loadMonitoringConfigs();
		} catch (error) {
			console.error('Error deleting config:', error);
		}
	}

	async function validateAndFixSkuMappings() {
		if (
			!confirm(
				'This will check and fix any incorrect ASIN-to-SKU mappings in your monitoring configurations. Continue?'
			)
		) {
			return;
		}

		try {
			isLoading = true;

			// First validate to see what needs fixing
			const validateResponse = await fetch(`${API_BASE_URL}/api/asin-sku/validate`);
			const validateData = await validateResponse.json();

			if (!validateResponse.ok) {
				throw new Error(validateData.error || 'Failed to validate SKU mappings');
			}

			if (validateData.isValid) {
				alert('✅ All ASIN-to-SKU mappings are already correct!');
				return;
			}

			// Show what will be fixed
			const mismatches = validateData.mismatches.filter((m: ValidationMismatch) => !m.notFound);
			const notFound = validateData.mismatches.filter((m: ValidationMismatch) => m.notFound);

			let message = `Found ${mismatches.length} SKU mappings that need correction:\n\n`;
			mismatches.slice(0, 5).forEach((m: ValidationMismatch) => {
				message += `• ASIN ${m.asin}: ${m.currentSku} → ${m.correctSku}\n`;
			});

			if (mismatches.length > 5) {
				message += `... and ${mismatches.length - 5} more\n`;
			}

			if (notFound.length > 0) {
				message += `\n⚠️ ${notFound.length} ASINs not found in amazon_listings (will be skipped)\n`;
			}

			message += `\nProceed with fixing ${mismatches.length} configurations?`;

			if (!confirm(message)) {
				return;
			}

			// Apply the fixes
			const fixResponse = await fetch(`${API_BASE_URL}/api/asin-sku/fix-all`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			const fixData = await fixResponse.json();

			if (!fixResponse.ok) {
				throw new Error(fixData.error || 'Failed to fix SKU mappings');
			}

			// Show results
			alert(
				`✅ SKU mapping fix completed!\n\n` +
					`Updated: ${fixData.results.updated}\n` +
					`Errors: ${fixData.results.errors}\n` +
					`Not found: ${fixData.results.notFound}`
			);

			// Reload the configurations to show updated data
			await loadMonitoringConfigs();
		} catch (error) {
			console.error('Error fixing SKU mappings:', error);
			alert(
				`❌ Failed to fix SKU mappings: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		} finally {
			isLoading = false;
		}
	}

	$: filteredAsins = availableAsins.filter(
		(asin) =>
			asin.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			asin.asin.toLowerCase().includes(searchTerm.toLowerCase()) ||
			asin.sku.toLowerCase().includes(searchTerm.toLowerCase())
	);

	$: configuredCount = monitoringConfigs.filter((c) => c.monitoring_enabled).length;
</script>

<div class="container mx-auto px-4 py-8">
	<div class="mb-8">
		<div class="flex items-center justify-between mb-4">
			<div>
				<h1 class="text-3xl font-bold text-gray-900 mb-2">Buy Box Alert Configuration</h1>
				<p class="text-gray-600">
					Set up alerts for your most important ASINs to get notified when you lose the buy box or
					prices change significantly.
				</p>
			</div>
			<div class="flex gap-3">
				<a
					href="/buy-box-alerts/demo"
					class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium"
				>
					📊 View Demo
				</a>
				<a
					href="/buy-box-alerts/real-time"
					class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
				>
					🔴 Live Monitor
				</a>
			</div>
		</div>

		<div class="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
			<div class="flex items-center justify-between">
				<div>
					<h3 class="font-medium text-blue-900">Current Configuration</h3>
					<p class="text-blue-700">{configuredCount} ASINs configured for monitoring</p>
				</div>
				<div class="flex gap-2">
					<button
						on:click={validateAndFixSkuMappings}
						disabled={isLoading}
						class="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 disabled:opacity-50"
						title="Check and fix any incorrect ASIN-to-SKU mappings"
					>
						{isLoading ? 'Fixing...' : 'Fix SKU Mappings'}
					</button>
					<button
						on:click={() => openConfigModal()}
						class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
					>
						Add New Alert
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Search and Filter -->
	<div class="mb-6">
		<div class="flex gap-4">
			<div class="flex-1">
				<input
					type="text"
					bind:value={searchTerm}
					placeholder="Search ASINs, SKUs, or product names..."
					class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
			</div>
		</div>
	</div>

	{#if isLoading}
		<div class="text-center py-8">
			<div
				class="animate-spin inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"
			></div>
			<p class="mt-2 text-gray-600">Loading ASINs...</p>
		</div>
	{:else}
		<!-- ASIN List -->
		<div class="bg-white shadow rounded-lg overflow-hidden">
			<div class="px-6 py-4 border-b border-gray-200">
				<h2 class="text-lg font-medium text-gray-900">Available ASINs ({filteredAsins.length})</h2>
			</div>

			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Product</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>ASIN</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Your Price</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Buy Box Status</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Alert Config</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
								>Actions</th
							>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each filteredAsins as asin}
							{@const config = monitoringConfigs.find((c) => c.asin === asin.asin)}
							<tr class="hover:bg-gray-50">
								<td class="px-6 py-4">
									<div
										class="text-sm font-medium text-gray-900 truncate max-w-xs"
										title={asin.item_name}
									>
										{asin.item_name || 'Unknown Product'}
									</div>
									<div class="text-sm text-gray-500">{asin.sku}</div>
								</td>
								<td class="px-6 py-4">
									<span class="text-sm font-mono text-gray-900">{asin.asin}</span>
								</td>
								<td class="px-6 py-4">
									<span class="text-sm font-semibold text-green-600">
										£{asin.current_price?.toFixed(2) || 'N/A'}
									</span>
								</td>
								<td class="px-6 py-4">
									{#if asin.buy_box_status === true}
										<span
											class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
										>
											🏆 Winning
										</span>
									{:else if asin.buy_box_status === false}
										<span
											class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"
										>
											❌ Losing
										</span>
									{:else}
										<span
											class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
										>
											❓ Unknown
										</span>
									{/if}
								</td>
								<td class="px-6 py-4">
									{#if config}
										<div class="text-sm">
											<div
												class={`font-medium ${priorityOptions.find((p) => p.value === config.priority)?.color || 'text-gray-600'}`}
											>
												Priority {config.priority}
											</div>
											<div class="text-gray-500">±{config.price_change_threshold}%</div>
										</div>
									{:else}
										<span class="text-sm text-gray-400">Not configured</span>
									{/if}
								</td>
								<td class="px-6 py-4">
									<div class="flex gap-2">
										<button
											on:click={() => openConfigModal(asin.asin)}
											class="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
										>
											{config ? 'Edit' : 'Configure'}
										</button>
										{#if config}
											<button
												on:click={() => config?.id && deleteConfig(config.id)}
												class="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
											>
												Delete
											</button>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

<!-- Configuration Modal -->
{#if showConfigModal && editingConfig}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
		<div
			class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white"
		>
			<div class="mt-3">
				<h3 class="text-lg font-medium text-gray-900 mb-4">
					Configure Alert for ASIN: {editingConfig.asin}
				</h3>

				<div class="space-y-4">
					<!-- Priority -->
					<div>
						<label for="priority-select" class="block text-sm font-medium text-gray-700 mb-2"
							>Priority Level</label
						>
						<select
							id="priority-select"
							bind:value={editingConfig.priority}
							class="w-full p-2 border border-gray-300 rounded"
						>
							{#each priorityOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</div>

					<!-- Price Change Threshold -->
					<div>
						<label for="threshold-input" class="block text-sm font-medium text-gray-700 mb-2"
							>Price Change Threshold (%)</label
						>
						<input
							id="threshold-input"
							type="number"
							bind:value={editingConfig.price_change_threshold}
							min="0.1"
							max="50"
							step="0.1"
							class="w-full p-2 border border-gray-300 rounded"
						/>
						<p class="text-sm text-gray-500 mt-1">Alert when price changes by this percentage</p>
					</div>

					<!-- Alert Types -->
					<div>
						<fieldset>
							<legend class="block text-sm font-medium text-gray-700 mb-2">Alert Methods</legend>
							<div class="space-y-2">
								{#each alertTypeOptions as option}
									<label class="flex items-center">
										<input
											type="checkbox"
											bind:group={editingConfig.alert_types}
											value={option.value}
											class="mr-2"
										/>
										{option.label}
									</label>
								{/each}
							</div>
						</fieldset>
					</div>

					<!-- Alert Frequency -->
					<div>
						<label for="frequency-select" class="block text-sm font-medium text-gray-700 mb-2"
							>Alert Frequency</label
						>
						<select
							id="frequency-select"
							bind:value={editingConfig.alert_frequency}
							class="w-full p-2 border border-gray-300 rounded"
						>
							{#each frequencyOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</div>

					<!-- Monitoring Enabled -->
					<div>
						<label class="flex items-center">
							<input type="checkbox" bind:checked={editingConfig.monitoring_enabled} class="mr-2" />
							<span class="text-sm font-medium text-gray-700">Enable monitoring for this ASIN</span>
						</label>
					</div>
				</div>

				<div class="flex justify-end gap-3 mt-6">
					<button
						on:click={() => {
							showConfigModal = false;
							editingConfig = null;
						}}
						class="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
					>
						Cancel
					</button>
					<button
						on:click={saveConfig}
						class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
					>
						Save Configuration
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Custom styles for better UX */
	.truncate {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
