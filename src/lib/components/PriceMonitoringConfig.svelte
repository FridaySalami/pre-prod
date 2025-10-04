<!--
Price Monitoring Configuration Component

Add this component to your buy-box-manager page to allow users to:
- Enable/disable monitoring for specific ASINs/SKUs
- Set custom alert thresholds
- View monitoring status and alerts
-->

<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';

	export let asin: string;
	export let sku: string;
	export let itemName: string = ''; // Used for alert display
	export let userEmail: string;
	export let currentPrice: number | null = null; // Used for context

	interface AlertConfig {
		priority: number;
		price_change_threshold: number;
		alert_types: string[];
		alert_frequency: string;
	}

	interface Alert {
		id: string;
		type: string;
		severity: string;
		message: string;
		created_at: string;
	}

	let isMonitored: boolean = false;
	let config: AlertConfig = {
		priority: 2,
		price_change_threshold: 5.0,
		alert_types: ['email', 'database'],
		alert_frequency: 'immediate'
	};
	let isLoading: boolean = false;
	let recentAlerts: Alert[] = [];
	let showConfig: boolean = false;

	onMount(() => {
		loadMonitoringConfig();
		loadRecentAlerts();
	});

	async function loadMonitoringConfig() {
		try {
			const { data, error } = await supabase
				.from('price_monitoring_config')
				.select('*')
				.eq('asin', asin)
				.eq('sku', sku)
				.eq('user_email', userEmail)
				.single();

			if (data) {
				isMonitored = data.monitoring_enabled;
				config = {
					priority: data.priority,
					price_change_threshold: data.price_change_threshold,
					alert_types: data.alert_types,
					alert_frequency: data.alert_frequency
				};
			}
		} catch (error) {
			console.log('No existing monitoring config found');
		}
	}

	async function loadRecentAlerts() {
		try {
			const { data, error } = await supabase
				.from('price_monitoring_alerts')
				.select('*')
				.eq('asin', asin)
				.eq('sku', sku)
				.eq('user_email', userEmail)
				.order('created_at', { ascending: false })
				.limit(5);

			if (data) {
				recentAlerts = data;
			}
		} catch (error) {
			console.error('Error loading alerts:', error);
		}
	}

	async function toggleMonitoring() {
		isLoading = true;

		try {
			if (!isMonitored) {
				// Enable monitoring - create config
				const { error } = await supabase.from('price_monitoring_config').upsert({
					user_email: userEmail,
					asin,
					sku,
					monitoring_enabled: true,
					...config
				});

				if (error) throw error;
				isMonitored = true;
			} else {
				// Disable monitoring
				const { error } = await supabase
					.from('price_monitoring_config')
					.update({ monitoring_enabled: false })
					.eq('asin', asin)
					.eq('sku', sku)
					.eq('user_email', userEmail);

				if (error) throw error;
				isMonitored = false;
			}
		} catch (error) {
			console.error('Error toggling monitoring:', error);
			alert('Error updating monitoring status');
		}

		isLoading = false;
	}

	async function updateConfig() {
		isLoading = true;

		try {
			const { error } = await supabase.from('price_monitoring_config').upsert({
				user_email: userEmail,
				asin,
				sku,
				monitoring_enabled: isMonitored,
				...config
			});

			if (error) throw error;
			alert('Monitoring configuration updated!');
			showConfig = false;
		} catch (error) {
			console.error('Error updating config:', error);
			alert('Error updating configuration');
		}

		isLoading = false;
	}

	const getPriorityLabel = (priority: number): string => {
		const labels: { [key: number]: string } = {
			1: 'Critical',
			2: 'High',
			3: 'Medium',
			4: 'Low',
			5: 'Monitor Only'
		};
		return labels[priority] || 'Medium';
	};

	const getSeverityColor = (severity: string): string => {
		const colors: { [key: string]: string } = {
			critical: 'bg-red-100 text-red-800',
			high: 'bg-orange-100 text-orange-800',
			medium: 'bg-yellow-100 text-yellow-800',
			low: 'bg-blue-100 text-blue-800'
		};
		return colors[severity] || 'bg-gray-100 text-gray-800';
	};
</script>

<div class="bg-white border rounded-lg p-4 shadow-sm">
	<!-- Header -->
	<div class="flex items-center justify-between mb-3">
		<div class="flex items-center gap-2">
			<div>
				<h3 class="font-medium text-gray-900">Price Monitoring</h3>
				{#if itemName}
					<p class="text-sm text-gray-600 truncate max-w-xs">{itemName}</p>
				{/if}
			</div>
			{#if isMonitored}
				<span
					class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
				>
					Active
				</span>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			<label class="relative inline-flex items-center cursor-pointer">
				<input
					type="checkbox"
					class="sr-only peer"
					bind:checked={isMonitored}
					on:change={toggleMonitoring}
					disabled={isLoading}
				/>
				<div
					class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
				></div>
			</label>

			{#if isMonitored}
				<button
					on:click={() => (showConfig = !showConfig)}
					class="text-sm text-blue-600 hover:text-blue-800"
				>
					Configure
				</button>
			{/if}
		</div>
	</div>

	<!-- Configuration Panel -->
	{#if showConfig && isMonitored}
		<div class="border-t pt-3 space-y-4">
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="priority-select" class="block text-sm font-medium text-gray-700 mb-1">
						Priority Level
					</label>
					<select
						id="priority-select"
						bind:value={config.priority}
						class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
					>
						<option value={1}>1 - Critical (Instant alerts)</option>
						<option value={2}>2 - High (Check every 15 min)</option>
						<option value={3}>3 - Medium (Check every 30 min)</option>
						<option value={4}>4 - Low (Check hourly)</option>
						<option value={5}>5 - Monitor Only (Check daily)</option>
					</select>
				</div>

				<div>
					<label for="threshold-input" class="block text-sm font-medium text-gray-700 mb-1">
						Price Change Threshold (%)
					</label>
					<input
						id="threshold-input"
						type="number"
						step="0.1"
						min="0.1"
						max="50"
						bind:value={config.price_change_threshold}
						class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
						placeholder="5.0"
					/>
				</div>
			</div>

			<div>
				<fieldset>
					<legend class="block text-sm font-medium text-gray-700 mb-2">Alert Methods</legend>
					<div class="flex gap-4">
						{#each ['email', 'webhook', 'database'] as method}
							<label class="flex items-center">
								<input
									type="checkbox"
									checked={config.alert_types.includes(method)}
									on:change={(e) => {
										const target = e.target as HTMLInputElement;
										if (target.checked) {
											config.alert_types = [...config.alert_types, method];
										} else {
											config.alert_types = config.alert_types.filter((t) => t !== method);
										}
									}}
									class="mr-2"
								/>
								<span class="text-sm capitalize">{method}</span>
							</label>
						{/each}
					</div>
				</fieldset>
			</div>
			<div class="flex gap-2">
				<button
					on:click={updateConfig}
					disabled={isLoading}
					class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
				>
					{isLoading ? 'Saving...' : 'Save Configuration'}
				</button>
				<button
					on:click={() => (showConfig = false)}
					class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md text-sm hover:bg-gray-300"
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}

	<!-- Monitoring Status -->
	{#if isMonitored && !showConfig}
		<div class="text-sm text-gray-600 space-y-1">
			{#if currentPrice !== null}
				<div>Current Price: <span class="font-medium">£{currentPrice.toFixed(2)}</span></div>
			{/if}
			<div>Priority: <span class="font-medium">{getPriorityLabel(config.priority)}</span></div>
			<div>Threshold: <span class="font-medium">{config.price_change_threshold}%</span></div>
			<div>Alerts: <span class="font-medium">{config.alert_types.join(', ')}</span></div>
		</div>
	{/if}

	<!-- Recent Alerts -->
	{#if recentAlerts.length > 0}
		<div class="border-t pt-3 mt-3">
			<h4 class="text-sm font-medium text-gray-900 mb-2">Recent Alerts</h4>
			<div class="space-y-2 max-h-32 overflow-y-auto">
				{#each recentAlerts as alert}
					<div class="flex items-start gap-2 text-xs">
						<span class="px-2 py-1 rounded-full {getSeverityColor(alert.severity)}">
							{alert.severity}
						</span>
						<div class="flex-1">
							<div class="font-medium">{alert.message}</div>
							<div class="text-gray-500">
								{new Date(alert.created_at).toLocaleString()}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
