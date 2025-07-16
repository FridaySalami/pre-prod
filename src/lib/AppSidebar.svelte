<script lang="ts">
	import * as Sidebar from '$lib/shadcn/ui/sidebar/index.js';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { userSession } from '$lib/sessionStore';
	import { supabase } from '$lib/supabaseClient';

	let currentPath = $state('');
	let isMobile = $state(false);

	// Subscribe to the page store to get the current path
	page.subscribe((value) => {
		currentPath = value.url.pathname;
		// Close sidebar when navigating on mobile by triggering the sidebar state
		if (isMobile && typeof document !== 'undefined') {
			// Use a small delay to ensure navigation has started
			setTimeout(() => {
				const trigger = document.querySelector('[data-sidebar="trigger"]') as HTMLButtonElement;
				if (trigger && document.querySelector('[data-state="open"]')) {
					trigger.click();
				}
			}, 50);
		}
	});

	// Check if we're on mobile
	onMount(() => {
		const checkMobile = () => {
			isMobile = window.innerWidth < 768;
		};

		checkMobile();
		window.addEventListener('resize', checkMobile);

		// Add click outside handler for mobile
		const handleClickOutside = (event: MouseEvent) => {
			if (!isMobile) return;

			const sidebar = document.querySelector('[data-sidebar="sidebar"]');
			const trigger = document.querySelector('[data-sidebar="trigger"]');
			const content = document.querySelector('[data-sidebar="content"]');

			// Check if sidebar is open
			const isOpen = document.querySelector('[data-state="open"]');
			if (!isOpen) return;

			// If click is outside sidebar, trigger, and content - close sidebar
			if (
				sidebar &&
				!sidebar.contains(event.target as Node) &&
				trigger &&
				!trigger.contains(event.target as Node) &&
				content &&
				!content.contains(event.target as Node)
			) {
				const triggerBtn = trigger as HTMLButtonElement;
				triggerBtn.click();
			}
		};

		document.addEventListener('click', handleClickOutside);

		return () => {
			window.removeEventListener('resize', checkMobile);
			document.removeEventListener('click', handleClickOutside);
		};
	});

	// Handle navigation link clicks
	function handleNavClick() {
		if (isMobile && typeof document !== 'undefined') {
			// Close sidebar on mobile by triggering the sidebar button
			setTimeout(() => {
				const trigger = document.querySelector('[data-sidebar="trigger"]') as HTMLButtonElement;
				if (trigger && document.querySelector('[data-state="open"]')) {
					trigger.click();
				}
			}, 100); // Small delay to allow navigation to start
		}
	}

	// Type definitions for navigation items
	type NavigationItem = {
		title: string;
		url: string;
		icon: string;
	};

	type SeparatorItem = {
		type: 'separator';
	};

	type MenuItem = NavigationItem | SeparatorItem;

	// Type guard functions
	const isSeparator = (item: MenuItem): item is SeparatorItem => 'type' in item;
	const isNavigationItem = (item: MenuItem): item is NavigationItem => !('type' in item);

	// Navigation items
	const items: MenuItem[] = [
		{
			title: 'Home',
			url: '/landing',
			icon: 'home'
		},
		{
			type: 'separator'
		},
		{
			title: 'Employee Hours',
			url: '/employee-hours',
			icon: 'schedule'
		},
		{
			title: 'Dashboard',
			url: '/dashboard',
			icon: 'dashboard'
		},
		{
			title: 'Buy Box Monitor',
			url: '/buy-box-monitor',
			icon: 'visibility'
		},
		{
			title: 'Buy Box Manager',
			url: '/buy-box-manager',
			icon: 'manage_search'
		},
		{
			type: 'separator'
		},
		{
			title: 'Analytics',
			url: '/analytics',
			icon: 'analytics'
		},
		{
			title: 'Monthly Analytics',
			url: '/analytics/monthly',
			icon: 'trending_up'
		},
		{
			title: 'Sales Analytics',
			url: '/sales-analytics',
			icon: 'bar_chart'
		},
		{
			type: 'separator'
		},
		{
			title: 'Kaizen Projects',
			url: '/kaizen-projects',
			icon: 'assignment'
		},
		{
			title: 'Process Map',
			url: '/process-map',
			icon: 'account_tree'
		},
		{
			title: 'Schedules',
			url: '/schedules',
			icon: 'calendar_today'
		},
		{
			title: 'Pricer Tool',
			url: '/pricer',
			icon: 'calculate'
		},
		{
			type: 'separator'
		},
		{
			title: 'Documentation',
			url: '/documentation',
			icon: 'description'
		}
	];

	async function handleLogout() {
		console.log('🔴 AppSidebar handleLogout called');

		// Try direct logout first
		try {
			// Clear session immediately
			userSession.set(null);
			console.log('🔴 Session cleared in AppSidebar');

			// Clear localStorage
			if (typeof localStorage !== 'undefined') {
				Object.keys(localStorage).forEach((key) => {
					if (key.includes('supabase') || key.includes('sb-')) {
						console.log(`🔴 Removing localStorage item: ${key}`);
						localStorage.removeItem(key);
					}
				});
			}

			// Sign out from Supabase
			console.log('🔴 Calling Supabase signOut');
			await supabase.auth.signOut();

			// Navigate immediately
			console.log('🔴 Navigating to login');
			window.location.href = '/login';
		} catch (error) {
			console.error('🔴 Error in direct logout:', error);
			// Fallback to event-based logout
			const event = new MouseEvent('click');
			window.dispatchEvent(new CustomEvent('app-logout', { detail: event }));
		}

		// Close sidebar on mobile after logout
		if (isMobile && typeof document !== 'undefined') {
			setTimeout(() => {
				const trigger = document.querySelector('[data-sidebar="trigger"]') as HTMLButtonElement;
				if (trigger && document.querySelector('[data-state="open"]')) {
					trigger.click();
				}
			}, 100);
		}
	}
</script>

<Sidebar.Root collapsible="icon" class="min-h-screen" data-sidebar="sidebar">
	<Sidebar.Header class="">
		<div
			class="flex flex-col items-center px-4 py-3 gap-2 transition-all duration-200 hover:bg-sidebar-accent/50 rounded-lg mx-2"
		>
			<div class="app-icon transition-all duration-200 hover:scale-105 hover:shadow-lg">P</div>
			<div class="app-name group-data-[collapsible=icon]:sr-only text-center">
				<div class="font-semibold text-sidebar-foreground text-sm leading-tight">
					Parkers Foodservice
				</div>
				<div class="text-xs text-sidebar-foreground/60">Operations Dashboard</div>
			</div>
		</div>
	</Sidebar.Header>

	<Sidebar.Content class="" data-sidebar="content">
		<Sidebar.Group class="">
			<Sidebar.GroupContent class="">
				<Sidebar.Menu class="">
					{#each items as item, index (isSeparator(item) ? `sep-${index}` : item.title)}
						{#if isSeparator(item)}
							<div class="separator-container px-3 py-1 group-data-[collapsible=icon]:px-2">
								<div class="separator-line"></div>
							</div>
						{:else}
							<Sidebar.MenuItem class="">
								<Sidebar.MenuButton
									isActive={currentPath === item.url ||
										(item.url !== '/landing' && currentPath.startsWith(item.url))}
									class="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
									children={() => {}}
									tooltipContent={item.title}
									tooltipContentProps={{}}
								>
									{#snippet child({ props }: { props: any })}
										<a
											href={item.url}
											{...props}
											class="flex items-center gap-3 w-full group"
											onclick={handleNavClick}
										>
											<i
												class="material-icons-outlined text-lg shrink-0 transition-all duration-200 group-hover:scale-110"
												>{item.icon}</i
											>
											<span
												class="group-data-[collapsible=icon]:sr-only transition-all duration-200"
												>{item.title}</span
											>
										</a>
									{/snippet}
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
						{/if}
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Footer class="">
		<Sidebar.Menu class="">
			<Sidebar.MenuItem class="">
				<Sidebar.MenuButton
					class="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
					children={() => {}}
					tooltipContent="Logout"
					tooltipContentProps={{}}
				>
					{#snippet child({ props }: { props: any })}
						<button
							{...props}
							onclick={handleLogout}
							class="flex items-center gap-3 w-full text-left hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group transition-all duration-200"
						>
							<i
								class="material-icons-outlined text-lg shrink-0 transition-all duration-200 group-hover:scale-110 group-hover:rotate-12"
								>logout</i
							>
							<span class="group-data-[collapsible=icon]:sr-only transition-all duration-200"
								>Logout</span
							>
						</button>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>
</Sidebar.Root>

<style>
	.app-icon {
		width: 28px;
		height: 28px;
		background-color: #004225;
		color: white;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 16px;
		letter-spacing: 0.02em;
		box-shadow: 0 2px 4px rgba(0, 66, 37, 0.2);
		flex-shrink: 0;
		transition: all 0.2s ease-in-out;
		position: relative;
		overflow: hidden;
	}

	.app-icon::before {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
		transition: left 0.5s;
	}

	.app-icon:hover::before {
		left: 100%;
	}

	.app-icon:hover {
		background-color: #005a32;
		box-shadow: 0 4px 8px rgba(0, 66, 37, 0.3);
	}

	.app-name {
		overflow: hidden;
		white-space: nowrap;
		transition: all 0.2s ease-in-out;
	}

	/* Enhanced active state for menu items */
	:global(.sidebar-menu-button[data-active='true']) {
		background-color: hsl(var(--sidebar-accent)) !important;
		color: hsl(var(--sidebar-accent-foreground)) !important;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		border-left: 3px solid #004225;
		font-weight: 500;
	}

	/* Subtle pulse animation for active items */
	:global(.sidebar-menu-button[data-active='true']::before) {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: hsl(var(--sidebar-accent));
		opacity: 0;
		animation: pulse 2s infinite;
		border-radius: inherit;
		z-index: -1;
	}

	@keyframes pulse {
		0% {
			opacity: 0;
			transform: scale(1);
		}
		50% {
			opacity: 0.1;
			transform: scale(1.02);
		}
		100% {
			opacity: 0;
			transform: scale(1);
		}
	}

	/* Ripple effect on click */
	:global(.sidebar-menu-button) {
		position: relative;
		overflow: hidden;
	}

	:global(.sidebar-menu-button::after) {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: 0;
		height: 0;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.2);
		transform: translate(-50%, -50%);
		transition:
			width 0.3s ease,
			height 0.3s ease;
	}

	:global(.sidebar-menu-button:active::after) {
		width: 100px;
		height: 100px;
	}

	/* Ensure text is hidden when sidebar is collapsed */
	:global([data-collapsible='icon']) span:not(.sr-only) {
		display: none !important;
	}

	/* Make sure icons are centered when collapsed */
	:global([data-collapsible='icon']) .flex.items-center {
		justify-content: center;
	}

	/* Hide the app-name completely when collapsed */
	:global([data-collapsible='icon']) .app-name {
		display: none !important;
	}

	/* Smooth transitions for collapsing */
	:global(.sidebar-root) {
		transition: width 0.3s ease-in-out;
	}

	/* Icon scaling animation */
	@keyframes iconBounce {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.1);
		}
	}

	/* Apply bounce animation on hover for navigation icons - more specific */
	:global(.sidebar-menu-button:hover:not(:active) i.material-icons-outlined) {
		animation: iconBounce 0.3s ease-in-out;
	}

	/* Prevent cascade hover effects */
	:global(.sidebar-menu) {
		pointer-events: auto;
	}

	:global(.sidebar-menu-item) {
		pointer-events: auto;
		isolation: isolate;
	}

	/* More specific hover states to prevent cascading */
	:global(.sidebar-menu-button:hover) {
		transform: scale(1.02) !important;
	}

	:global(.sidebar-menu-button:active) {
		transform: scale(0.98) !important;
	}

	/* Separator styles */
	.separator-container {
		margin: 4px 0;
		transition: all 0.2s ease-in-out;
		position: relative;
	}

	.separator-line {
		height: 1px;
		background-color: rgba(148, 163, 184, 0.4); /* fallback color */
		background: linear-gradient(
			90deg,
			transparent,
			rgba(148, 163, 184, 0.6) 20%,
			rgba(148, 163, 184, 0.6) 80%,
			transparent
		);
		opacity: 1;
		transition: all 0.2s ease-in-out;
		border-radius: 1px;
		min-height: 1px;
		display: block;
		width: 100%;
	}

	/* Alternative approach - use border instead of background */
	.separator-line::after {
		content: '';
		display: block;
		width: 100%;
		height: 1px;
		border-top: 1px solid rgba(148, 163, 184, 0.3);
		background: transparent;
	}

	/* Hide separators when sidebar is collapsed */
	:global([data-collapsible='icon']) .separator-container {
		display: none;
	}

	/* Subtle animation for separators */
	.separator-container:hover .separator-line {
		background-color: rgba(148, 163, 184, 0.6);
		opacity: 1;
	}
</style>
