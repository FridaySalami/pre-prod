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
} from '$lib/shadcn/ui/command/index.js';
import { goto } from '$app/navigation';
import { createEventDispatcher } from 'svelte';
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
User,
Settings,
Lock
} from 'lucide-svelte';

let { open = $bindable(false) }: { open: boolean } = $props();

const dispatch = createEventDispatcher();

// Navigation items synced with AppSidebar.svelte
const navigationGroups = [
{
group: 'General',
items: [
{ name: 'Home', href: '/landing', icon: Home },
]
},
{
group: 'Dashboard',
items: [
{ name: 'Employee Hours', href: '/employee-hours', icon: Clock },
{ name: 'Stats Overview', href: '/dashboard', icon: LayoutDashboard },
{ name: 'Amazon Orders', href: '/dashboard/amazon/orders', icon: ShoppingCart },
{ name: 'Dolphin Logs', href: '/dashboard/dolphin-logs', icon: ReceiptText },
]
},
{
group: 'Core Operations',
items: [
{ name: 'Packing Supplies', href: '/dashboard/tools/packing-supplies', icon: Package },
{ name: 'Buy Box Monitor', href: '/buy-box-monitor', icon: BarChart3 },
{ name: 'Holiday Calendar', href: '/holiday-calendar', icon: Calendar },
{ name: 'Pricer Tool', href: '/pricer', icon: Calculator },
{ name: 'Sales Comparison', href: '/sales-comparison', icon: TrendingUp },
]
},
{
group: 'Documentation',
items: [
{ name: 'User Guide', href: '/documentation', icon: FileText },
]
},
{
group: 'Account',
items: [
{ name: 'Profile', href: '/profile', icon: User },
{ name: 'Settings', href: '/account-settings', icon: Settings },
{ name: 'Change Password', href: '/change-password', icon: Lock },
]
}
];

function handleSelect(href: string) {
open = false;
goto(href);
dispatch('close');
}

// Keyboard shortcut handling
function handleKeydown(event: KeyboardEvent) {
if (event.key === 'Escape') {
open = false;
dispatch('close');
}

// Toggle search with Meta+K or Ctrl+K
if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
event.preventDefault();
open = !open;
}
}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
<div 
class="command-overlay" 
role="button" 
tabindex="0"
onclick={() => { open = false; dispatch('close'); }}
onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { open = false; dispatch('close'); } }}
>
<div 
class="command-dialog-wrapper" 
role="none"
onclick={(e) => e.stopPropagation()}
>
<Command class="rounded-xl border shadow-2xl bg-white overflow-hidden w-full max-w-[550px]">
<div class="flex items-center border-b px-3">
<CommandInput placeholder="Search navigation..." class="h-12 border-none focus:ring-0 text-sm" />
</div>
<CommandList class="max-h-[400px] overflow-y-auto p-2">
<CommandEmpty class="py-6 text-center text-sm text-slate-500">No results found.</CommandEmpty>

{#each navigationGroups as group}
<CommandGroup heading={group.group} value={group.group} class="px-2 py-1.5">
{#each group.items as item}
<CommandItem
value={item.name}
onSelect={() => handleSelect(item.href)}
class="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-100 aria-selected:bg-slate-100 transition-colors"
>
<item.icon class="w-4 h-4 text-slate-500" />
<span class="text-sm font-medium text-slate-700">{item.name}</span>
</CommandItem>
{/each}
</CommandGroup>
{#if group !== navigationGroups[navigationGroups.length - 1]}
<CommandSeparator class="my-2" />
{/if}
{/each}
</CommandList>
<div class="flex items-center justify-between px-4 py-2 border-t bg-slate-50/50 text-[10px] text-slate-400">
<div class="flex gap-3">
<span class="flex items-center gap-1"><kbd class="bg-white border rounded px-1">↑↓</kbd> Navigate</span>
<span class="flex items-center gap-1"><kbd class="bg-white border rounded px-1">↵</kbd> Select</span>
</div>
<span class="flex items-center gap-1"><kbd class="bg-white border rounded px-1">esc</kbd> Close</span>
</div>
</Command>
</div>
</div>
{/if}

<style>
/* Modal-style centering for Command Menu */
.command-overlay {
position: fixed;
inset: 0;
background: rgba(15, 23, 42, 0.4);
backdrop-filter: blur(4px);
z-index: 9999;
display: flex;
align-items: flex-start;
justify-content: center;
padding-top: 20vh;
}

.command-dialog-wrapper {
width: 100%;
display: flex;
justify-content: center;
padding: 0 16px;
}

:global(.command-dialog-wrapper input) {
width: 100%;
background: transparent;
outline: none;
border: none !important;
}

:global(.command-dialog-wrapper [data-command-group-heading]) {
font-size: 10px;
font-weight: 700;
text-transform: uppercase;
letter-spacing: 0.05em;
color: #94a3b8;
padding: 8px 12px 4px;
}
</style>
