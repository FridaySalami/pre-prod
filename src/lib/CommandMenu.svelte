<!-- CommandMenu.svelte -->
<script lang="ts">
	import {
		Command,
		CommandEmpty,
		CommandGroup,
		CommandInput,
		CommandItem,
		CommandList,
		CommandSeparator,
		CommandShortcut
	} from '$lib/components';
	import { goto } from '$app/navigation';
	import { createEventDispatcher } from 'svelte';

	export let open = false;

	const dispatch = createEventDispatcher();

	// Navigation items with keyboard shortcuts and icons
	const navigationItems = [
		{
			group: 'Navigation',
			items: [
				{ name: 'Home', href: '/landing', shortcut: '⌘H', icon: 'home' },
				{ name: 'Dashboard', href: '/dashboard', shortcut: '⌘D', icon: 'dashboard' },
				{ name: 'Analytics', href: '/analytics', shortcut: '⌘A', icon: 'analytics' },
				{
					name: 'Monthly Analytics',
					href: '/analytics/monthly',
					shortcut: '⌘M',
					icon: 'trending_up'
				},
				{ name: 'Schedules', href: '/schedules', shortcut: '⌘S', icon: 'calendar_today' }
			]
		},
		{
			group: 'Projects & Processes',
			items: [
				{ name: 'Kaizen Projects', href: '/kaizen-projects', shortcut: '⌘K', icon: 'assignment' },
				{ name: 'Process Map', href: '/process-map', shortcut: '⌘P', icon: 'account_tree' }
			]
		},
		{
			group: 'Account',
			items: [
				{ name: 'Profile', href: '/profile', shortcut: '⌘U', icon: 'person' },
				{ name: 'Account Settings', href: '/account-settings', shortcut: '⌘,', icon: 'settings' },
				{ name: 'Change Password', href: '/change-password', shortcut: '', icon: 'lock' }
			]
		}
	];

	function handleSelect(href: string) {
		open = false;
		goto(href);
		dispatch('close');
	}

	function handleOpenChange(newOpen: boolean) {
		open = newOpen;
		if (!newOpen) {
			dispatch('close');
		}
	}

	// Keyboard shortcut handling
	function handleKeydown(event: KeyboardEvent) {
		// Close on Escape
		if (event.key === 'Escape') {
			open = false;
			dispatch('close');
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
	<div class="command-dropdown">
		<Command class="rounded-lg border shadow-md bg-white">
			<CommandInput placeholder="Type a command or search..." class="border-none" />
			<CommandList class="max-h-80 overflow-y-auto">
				<CommandEmpty class="">No results found.</CommandEmpty>

				{#each navigationItems as group}
					<CommandGroup heading={group.group} class="" value={group.group}>
						{#each group.items as item}
							<CommandItem
								onSelect={() => handleSelect(item.href)}
								class="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
							>
								<div class="flex items-center gap-2">
									<i class="material-icons-outlined text-sm text-gray-500">{item.icon}</i>
									<span class="text-sm">{item.name}</span>
								</div>
								{#if item.shortcut}
									<CommandShortcut class="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded"
										>{item.shortcut}</CommandShortcut
									>
								{/if}
							</CommandItem>
						{/each}
					</CommandGroup>
					{#if group !== navigationItems[navigationItems.length - 1]}
						<CommandSeparator class="my-1" />
					{/if}
				{/each}
			</CommandList>
		</Command>
	</div>
{/if}

<style>
	/* Command dropdown positioned below button */
	.command-dropdown {
		position: fixed;
		top: 72px; /* Position below header */
		right: 20px; /* Align with button position */
		width: 280px; /* Match button width */
		background: white;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		border: 1px solid #e5e7eb;
		overflow: hidden;
		z-index: 1000;
	}

	/* Make sure Material Icons work properly */
	:global(.material-icons-outlined) {
		font-family: 'Material Icons Outlined';
		font-weight: normal;
		font-style: normal;
		font-size: 16px;
		line-height: 1;
		letter-spacing: normal;
		text-transform: none;
		display: inline-block;
		white-space: nowrap;
		word-wrap: normal;
		direction: ltr;
		-webkit-font-smoothing: antialiased;
	}

	/* Override some command component styles for better dropdown appearance */
	:global(.command-dropdown .bits-command-input) {
		border: none !important;
		border-bottom: 1px solid #e5e7eb !important;
		border-radius: 0 !important;
		padding: 12px 16px !important;
		font-size: 14px !important;
	}

	:global(.command-dropdown .bits-command-group-heading) {
		font-size: 11px !important;
		color: #6b7280 !important;
		font-weight: 600 !important;
		text-transform: uppercase !important;
		letter-spacing: 0.05em !important;
		padding: 8px 16px 4px !important;
	}

	:global(.command-dropdown .bits-command-item) {
		border-radius: 0 !important;
		margin: 0 !important;
		padding: 8px 16px !important;
	}

	:global(.command-dropdown .bits-command-separator) {
		margin: 4px 0 !important;
		border-color: #f3f4f6 !important;
	}
</style>
