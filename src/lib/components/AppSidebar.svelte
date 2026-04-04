<script lang="ts">
	import * as Sidebar from '$lib/shadcn/ui/sidebar/index.js';
	import { page } from '$app/stores';
	import { onMount, getContext } from 'svelte';
	import { userSession } from '$lib/stores/sessionStore';
	import { supabase } from '$lib/supabase/supabaseClient';
	import { syncStore } from '$lib/stores/syncStore';
	import { 
		Home, 
		Clock, 
		LayoutDashboard, 
		ShoppingCart, 
		ReceiptText, 
		Package, 
		BarChart3, 
		Calendar, 
		Calculator, 
		TrendingUp, 
		FileText,
		LogOut,
		Search,
		RefreshCw,
		History
	} from 'lucide-svelte';

	// Accept user data as prop from layout
	interface Props {
		user?: {
			id: string;
			email: string;
			profile?: {
				role?: string;
			} | null;
		} | null;
		onSearchClick?: () => void;
	}

	let { user = null, onSearchClick }: Props = $props();

	let currentPath = $state('');
	let isMobile = $state(false);

	// Get user role for menu filtering
	const userRole = $derived(user?.profile?.role || 'user');

	// Sidebar state from context to check if collapsed
	const sidebar = Sidebar.useSidebar();

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

			const sidebarElement = document.querySelector('[data-sidebar="sidebar"]');
			const trigger = document.querySelector('[data-sidebar="trigger"]');
			const content = document.querySelector('[data-sidebar="content"]');

			// Check if sidebar is open
			const isOpen = document.querySelector('[data-state="open"]');
			if (!isOpen) return;

			// If click is outside sidebar, trigger, and content - close sidebar
			if (
				sidebarElement &&
				!sidebarElement.contains(event.target as Node) &&
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
		icon: any; // Use Lucide component
		requiredRole?: 'user' | 'manager' | 'admin';
		children?: NavigationItem[];
	};

	type SeparatorItem = {
		type: 'separator';
	};

	type SectionHeaderItem = {
		type: 'section';
		title: string;
	};

	type MenuItem = NavigationItem | SeparatorItem | SectionHeaderItem;

	// Type guard functions
	const isSeparator = (item: MenuItem): item is SeparatorItem =>
		'type' in item && item.type === 'separator';
	const isSectionHeader = (item: MenuItem): item is SectionHeaderItem =>
		'type' in item && item.type === 'section';
	const isNavigationItem = (item: MenuItem): item is NavigationItem => !('type' in item);

	// Navigation items with role requirements
	const allItems: MenuItem[] = [
		{
			type: 'section',
			title: 'General'
		},
		{
			title: 'Home',
			url: '/landing',
			icon: Home,
			requiredRole: 'user'
		},
		{
			type: 'section',
			title: 'Dashboard'
		},
		{
			title: 'Employee Hours',
			url: '/employee-hours',
			icon: Clock,
			requiredRole: 'user'
		},
		{
			title: 'Stats Overview',
			url: '/dashboard',
			icon: LayoutDashboard,
			requiredRole: 'user'
		},
		{
			title: 'Amazon Orders',
			url: '/dashboard/amazon/orders',
			icon: ShoppingCart,
			requiredRole: 'user'
		},
		{
			title: 'Dolphin Logs',
			url: '/dashboard/dolphin-logs',
			icon: ReceiptText,
			requiredRole: 'user'
		},
		{
			type: 'section',
			title: 'Core Operations'
		},
		{
			title: 'Packing Supplies',
			url: '/dashboard/tools/packing-supplies',
			icon: Package,
			requiredRole: 'user'
		},
		
		{
			title: 'Buy Box Monitor',
			url: '/buy-box-monitor',
			icon: BarChart3,
			requiredRole: 'user'
		},
		{
			title: 'Holiday Calendar',
			url: '/holiday-calendar',
			icon: Calendar,
			requiredRole: 'user'
		},
		{
			title: 'Pricer Tool',
			url: '/pricer',
			icon: Calculator,
			requiredRole: 'user'
		},
		{
			title: 'Sales Comparison',
			url: '/sales-comparison',
			icon: TrendingUp,
			requiredRole: 'user'
		},
		{
			type: 'section',
			title: 'Documentation'
		},
		{
			title: 'User Guide',
			url: '/documentation',
			icon: FileText,
			requiredRole: 'user'
		}
	];

	// Function to check if user has required role
	function hasRole(requiredRole: string, userRole: string): boolean {
		const roleHierarchy = {
			admin: ['admin', 'manager', 'user'],
			manager: ['manager', 'user'],
			user: ['user']
		};

		const allowedRoles = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || [];
		return allowedRoles.includes(userRole);
	}

	// Filter items based on user role
	const items = $derived(() => {
		const filteredItems: MenuItem[] = [];
		let lastWasSeparator = false;

		for (const item of allItems) {
			if (isSeparator(item)) {
				// Only add separator if the last item wasn't a separator
				if (!lastWasSeparator && filteredItems.length > 0) {
					filteredItems.push(item);
					lastWasSeparator = true;
				}
			} else if (isSectionHeader(item)) {
				filteredItems.push(item);
				lastWasSeparator = false;
			} else {
				// Check if user has required role
				if (!item.requiredRole || hasRole(item.requiredRole, userRole)) {
					filteredItems.push(item);
					lastWasSeparator = false;
				}
			}
		}

		return filteredItems;
	});

	async function handleLogout() {
		try {
			// Trigger a custom event for the layout to handle
			if (typeof document !== 'undefined') {
				const event = new CustomEvent('app-logout', { 
					detail: { originalEvent: null } 
				});
				document.dispatchEvent(event);
			}
		} catch (err) {
			console.error('Error triggering logout:', err);
		}
	}
</script>

<Sidebar.Root
	collapsible="icon"
	class="bg-white border-r border-gray-200"
	data-sidebar="sidebar"
>
	<Sidebar.Header class="p-4">
		<div class="flex items-center gap-3 mb-6 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mb-4 transition-all duration-200">
			<div class="app-icon shrink-0">P</div>
			<div class="flex flex-col group-data-[collapsible=icon]:hidden overflow-hidden">
				<span class="font-bold text-gray-900 leading-tight truncate">Parker's</span>
				<span class="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Ops Dashboard</span>
			</div>
		</div>

		<!-- Global Search Button (Internalized) -->
		<button
			class="flex items-center gap-3 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center"
			onclick={onSearchClick}
			title="Search (⌘K)"
		>
			<Search class="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
			<span class="text-sm font-medium group-data-[collapsible=icon]:hidden">Search...</span>
			<kbd class="ml-auto text-[10px] font-sans bg-white px-1.5 py-0.5 rounded border border-gray-200 group-data-[collapsible=icon]:hidden text-gray-400">⌘K</kbd>
		</button>
	</Sidebar.Header>

	<Sidebar.Content class="px-2" data-sidebar="content">
		<!-- Sync Status (Integrated) -->
		{#if $syncStore.syncing || $syncStore.status}
			<div class="mx-2 mb-4 p-2 bg-slate-50 border border-slate-100 rounded-lg group-data-[collapsible=icon]:p-1.5 group-data-[collapsible=icon]:mx-0.5">
				<div class="flex items-center gap-2">
					<div class="relative">
						<RefreshCw class="w-3.5 h-3.5 text-blue-600 {$syncStore.syncing ? 'animate-spin' : ''}" />
						{#if $syncStore.syncing}
							<div class="absolute -top-1 -right-1 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
						{/if}
					</div>
					<div class="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
						<span class="text-[10px] font-bold text-slate-700 truncate capitalize">{$syncStore.status}</span>
						{#if $syncStore.duration > 0}
							<span class="text-[9px] text-slate-400">{$syncStore.duration.toFixed(1)}s elapsed</span>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<Sidebar.Group class="">
			<Sidebar.GroupContent class="">
				<Sidebar.Menu class="gap-0.5">
					{#each items() as item, index (isSeparator(item) ? `sep-${index}` : isSectionHeader(item) ? `sec-${index}` : item.title)}
						{#if isSeparator(item)}
							<div class="px-3 py-2 group-data-[collapsible=icon]:px-1">
								<div class="h-px bg-gray-100 w-full"></div>
							</div>
						{:else if isSectionHeader(item)}
							<div class="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest group-data-[collapsible=icon]:hidden mt-2">
								{item.title}
							</div>
						{:else}
							<Sidebar.MenuItem class="">
								<Sidebar.MenuButton
									isActive={currentPath === item.url || (item.url !== '/landing' && item.url !== '/dashboard' && currentPath.startsWith(item.url))}
									class="w-full transition-all duration-200 hover:bg-gray-50 py-2 group-data-[collapsible=icon]:justify-center"
									children={() => {}}
									tooltipContent={item.title}
									tooltipContentProps={{}}
								>
									{#snippet child({ props }: { props: any })}
										<a
											href={item.url}
											{...props}
											class="flex items-center gap-3 w-full px-3 relative group"
											onclick={handleNavClick}
										>
											<item.icon class="w-[18px] h-[18px] shrink-0 transition-transform group-hover:scale-115 {currentPath === item.url ? 'text-primary' : 'text-gray-500'}" />
											<span class="text-sm font-medium transition-colors group-data-[collapsible=icon]:hidden {currentPath === item.url ? 'text-primary font-bold' : 'text-gray-700'}">
												{item.title}
											</span>
											{#if currentPath === item.url}
												<div class="absolute left-0 w-1 h-5 bg-primary rounded-r-md group-data-[collapsible=icon]:h-6"></div>
											{/if}
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

	<Sidebar.Footer class="p-4 border-t border-gray-100">
		<div class="flex items-center justify-between group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-4">
			<button
				class="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all group relative"
				onclick={handleLogout}
				title="Logout"
			>
				<LogOut class="w-5 h-5 transition-transform group-hover:-translate-x-1" />
			</button>
			
			<div class="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
				<div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
					{user?.email?.substring(0, 1).toUpperCase() || 'U'}
				</div>
				<div class="flex flex-col min-w-0">
					<span class="text-xs font-bold text-gray-900 truncate tracking-tight">{user?.email?.split('@')[0]}</span>
					<span class="text-[10px] text-gray-500 lowercase px-1.5 bg-gray-100 rounded-full w-fit">{userRole}</span>
				</div>
			</div>
		</div>
	</Sidebar.Footer>
</Sidebar.Root>

<style>
	.app-icon {
		width: 32px;
		height: 32px;
		background-color: #004225;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		font-weight: 800;
		font-size: 1.2rem;
		box-shadow: 0 2px 4px rgba(0, 66, 37, 0.2);
		position: relative;
		overflow: hidden;
		transition: all 0.2s ease-in-out;
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

	/* Section Header */
	.section-header {
		text-transform: uppercase;
		font-size: 11px;
		color: #9ca3af;
		letter-spacing: 1px;
		padding: 24px 16px 8px 16px;
		font-weight: 600;
	}
</style>
