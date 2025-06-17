<script lang="ts">
	import * as Sidebar from '$lib/shadcn/ui/sidebar/index.js';
	import { page } from '$app/stores';

	let currentPath = '';

	// Subscribe to the page store to get the current path
	page.subscribe((value) => {
		currentPath = value.url.pathname;
	});

	// Navigation items
	const items = [
		{
			title: 'Home',
			url: '/landing',
			icon: 'home'
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
	];

	async function handleLogout() {
		// Import the logout functionality from the layout
		const event = new MouseEvent('click');
		window.dispatchEvent(new CustomEvent('app-logout', { detail: event }));
	}
</script>

<Sidebar.Root collapsible="icon" class="min-h-screen">
	<Sidebar.Header class="">
		<div class="flex flex-col items-center px-4 py-3 gap-2">
			<div class="app-icon">P</div>
			<div class="app-name group-data-[collapsible=icon]:sr-only text-center">
				<div class="font-semibold text-sidebar-foreground text-sm leading-tight">
					Parkers Foodservice
				</div>
				<div class="text-xs text-sidebar-foreground/60">Operations Dashboard</div>
			</div>
		</div>
	</Sidebar.Header>

	<Sidebar.Content class="">
		<Sidebar.Group class="">
			<Sidebar.GroupContent class="">
				<Sidebar.Menu class="">
					{#each items as item (item.title)}
						<Sidebar.MenuItem class="">
							<Sidebar.MenuButton
								isActive={currentPath === item.url ||
									(item.url !== '/landing' && currentPath.startsWith(item.url))}
								class="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
								children={() => {}}
								tooltipContent={item.title}
								tooltipContentProps={{}}
							>
								{#snippet child({ props }: { props: any })}
									<a href={item.url} {...props} class="flex items-center gap-3 w-full">
										<i class="material-icons-outlined text-lg shrink-0">{item.icon}</i>
										<span class="group-data-[collapsible=icon]:sr-only">{item.title}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Footer class="">
		<Sidebar.Menu class="">
			<Sidebar.MenuItem class="">
				<Sidebar.MenuButton
					class="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
					children={() => {}}
					tooltipContent="Logout"
					tooltipContentProps={{}}
				>
					{#snippet child({ props }: { props: any })}
						<button
							{...props}
							onclick={handleLogout}
							class="flex items-center gap-3 w-full text-left hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
						>
							<i class="material-icons-outlined text-lg shrink-0">logout</i>
							<span class="group-data-[collapsible=icon]:sr-only">Logout</span>
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
	}

	.app-name {
		overflow: hidden;
		white-space: nowrap;
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
</style>
