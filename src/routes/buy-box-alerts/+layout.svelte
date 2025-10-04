<script lang="ts">
	import { page } from '$app/stores';

	// Navigation items
	const navItems = [
		{ href: '/buy-box-alerts', label: 'Overview', icon: '📊' },
		{ href: '/buy-box-alerts/live', label: 'Live Alerts', icon: '🔔' },
		{ href: '/buy-box-alerts/real-time', label: 'Real-time Monitor', icon: '⚡' },
		{ href: '/buy-box-alerts/dashboard', label: 'Dashboard', icon: '📈' },
		{ href: '/buy-box-alerts/job-management', label: 'Jobs', icon: '⚙️' },
		{ href: '/buy-box-alerts/demo', label: 'Demo', icon: '🧪' }
	];

	$: currentPath = $page.url.pathname;
</script>

<div class="min-h-screen bg-gray-50">
	<!-- Navigation Header -->
	<nav class="bg-white shadow-sm border-b border-gray-200">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between h-16">
				<div class="flex items-center space-x-8">
					<!-- Section Title -->
					<div class="flex items-center space-x-2">
						<h1 class="text-xl font-semibold text-gray-900">📦 Buy Box Alerts</h1>
					</div>

					<!-- Navigation Links -->
					<div class="hidden md:flex space-x-1">
						{#each navItems as item}
							<a
								href={item.href}
								class="px-3 py-2 rounded-md text-sm font-medium transition-colors {currentPath ===
								item.href
									? 'bg-blue-100 text-blue-700'
									: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}"
							>
								<span class="mr-2">{item.icon}</span>
								{item.label}
							</a>
						{/each}
					</div>
				</div>

				<!-- Mobile Menu Button -->
				<div class="md:hidden flex items-center">
					<button class="text-gray-600 hover:text-gray-900 p-2" aria-label="Open mobile menu">
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 6h16M4 12h16M4 18h16"
							></path>
						</svg>
					</button>
				</div>
			</div>
		</div>

		<!-- Mobile Navigation (hidden by default) -->
		<div class="md:hidden bg-white border-t border-gray-200 px-4 py-2">
			{#each navItems as item}
				<a
					href={item.href}
					class="block px-3 py-2 rounded-md text-sm font-medium transition-colors {currentPath ===
					item.href
						? 'bg-blue-100 text-blue-700'
						: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}"
				>
					<span class="mr-2">{item.icon}</span>
					{item.label}
				</a>
			{/each}
		</div>
	</nav>

	<!-- Page Content -->
	<main>
		<slot />
	</main>
</div>
