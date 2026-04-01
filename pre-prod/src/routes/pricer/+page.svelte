<script lang="ts">
	// No reactive variables needed for this static dashboard
</script>

<svelte:head>
	<title>Dashboard - Pricer</title>
</svelte:head>

<div class="container mx-auto px-4 py-6">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900 mb-2">Operations Dashboard</h1>
		<p class="text-gray-600">
			Manage pricing, inventory, and business operations from one central location
		</p>
	</div>

	<!-- Main Content - Two Column Layout -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
		<!-- Admin Section -->
		<div class="bg-white rounded-lg shadow-lg p-6">
			<div class="flex items-center mb-6">
				<div class="bg-red-100 rounded-full p-3 mr-4">
					<svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z"
						/>
					</svg>
				</div>
				<div>
					<h2 class="text-xl font-bold text-gray-900">Admin</h2>
					<p class="text-gray-600">Data management and uploads</p>
				</div>
			</div>

			<div class="space-y-4">
				<a
					href="/linnworks-composition"
					class="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
				>
					<div class="flex items-center justify-between">
						<div>
							<h3 class="font-semibold text-gray-900">Linnworks Composition</h3>
							<p class="text-sm text-gray-600">Upload and manage product composition data</p>
						</div>
						<svg
							class="w-5 h-5 text-gray-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5l7 7-7 7"
							/>
						</svg>
					</div>
				</a>

				<a
					href="/amazon-listings"
					class="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
				>
					<div class="flex items-center justify-between">
						<div>
							<h3 class="font-semibold text-gray-900">Amazon Listings</h3>
							<p class="text-sm text-gray-600">Import and manage Amazon product listings</p>
						</div>
						<svg
							class="w-5 h-5 text-gray-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5l7 7-7 7"
							/>
						</svg>
					</div>
				</a>

				<a
					href="/inventory"
					class="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
				>
					<div class="flex items-center justify-between">
						<div>
							<h3 class="font-semibold text-gray-900">Inventory Management</h3>
							<p class="text-sm text-gray-600">Upload and manage inventory data</p>
						</div>
						<svg
							class="w-5 h-5 text-gray-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5l7 7-7 7"
							/>
						</svg>
					</div>
				</a>

				<a
					href="/sage-reports"
					class="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
				>
					<div class="flex items-center justify-between">
						<div>
							<h3 class="font-semibold text-gray-900">Sage Reports</h3>
							<p class="text-sm text-gray-600">Import cost and pricing data from Sage</p>
						</div>
						<svg
							class="w-5 h-5 text-gray-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5l7 7-7 7"
							/>
						</svg>
					</div>
				</a>

				<a
					href="/linnworks-composition/summary"
					class="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
				>
					<div class="flex items-center justify-between">
						<div>
							<h3 class="font-semibold text-gray-900">Composition Summary</h3>
							<p class="text-sm text-gray-600">View product composition analysis and costs</p>
						</div>
						<svg
							class="w-5 h-5 text-gray-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5l7 7-7 7"
							/>
						</svg>
					</div>
				</a>
			</div>
		</div>

		<!-- Calculator Section -->
		<div class="bg-white rounded-lg shadow-lg p-6">
			<div class="flex items-center mb-6">
				<div class="bg-blue-100 rounded-full p-3 mr-4">
					<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
						/>
					</svg>
				</div>
				<div>
					<h2 class="text-xl font-bold text-gray-900">Calculator</h2>
					<p class="text-gray-600">Pricing and profit analysis tools</p>
				</div>
			</div>

			<div class="space-y-4">
				<a
					href="/inventory-profit-calculator"
					class="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
				>
					<div class="flex items-center justify-between">
						<div>
							<h3 class="font-semibold text-gray-900">Inventory Profit Calculator</h3>
							<p class="text-sm text-gray-600">Analyze product profitability and costs</p>
						</div>
						<svg
							class="w-5 h-5 text-gray-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5l7 7-7 7"
							/>
						</svg>
					</div>
				</a>

				<a
					href="/inventory-profit-calculator/scenario-analysis"
					class="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
				>
					<div class="flex items-center justify-between">
						<div>
							<h3 class="font-semibold text-gray-900">SKU Shipping Calculator</h3>
							<p class="text-sm text-gray-600">
								Calculate shipping costs and scenarios for individual SKUs
							</p>
						</div>
						<svg
							class="w-5 h-5 text-gray-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5l7 7-7 7"
							/>
						</svg>
					</div>
				</a>
			</div>
		</div>
	</div>
</div>

<style>
	.container {
		max-width: 1200px;
	}

	/* Ensure consistent card heights */
	.space-y-4 > a {
		min-height: 80px;
		display: flex;
		align-items: center;
	}
</style>
