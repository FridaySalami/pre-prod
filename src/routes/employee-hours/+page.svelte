<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import { goto } from '$app/navigation';
import { tweened } from 'svelte/motion';
import { cubicOut } from 'svelte/easing';
import { userSession } from '$lib/stores/sessionStore';
import type { Session } from '@supabase/supabase-js';
import { getEmployees, type Employee } from '$lib/services/employeeHoursService';
import {
saveDailyHours,
getDailyHours,
type DailyEmployeeHour
} from '$lib/services/dailyHoursService';
import { 
Users, 
Clock, 
TrendingUp, 
AlertTriangle, 
CheckCircle2, 
RotateCcw, 
Save,
Plus,
Minus,
CalendarDays,
Package
} from 'lucide-svelte';
import { 
Badge, 
Card, 
CardContent, 
CardHeader, 
CardTitle 
} from '$lib/shadcn/components/ui/index.js';
import DocumentationLink from '$lib/components/DocumentationLink.svelte';

// Authentication check
let session = $state<Session | null | undefined>(undefined);
const unsubscribe = userSession.subscribe((s) => {
session = s;
});

onDestroy(() => {
unsubscribe();
});

onMount(async () => {
const sessionTimeout = new Promise((resolve) => setTimeout(() => resolve(null), 5000));
let currentSession;
try {
const unsubscribePromise = new Promise<any>((resolve) => {
const unsub = userSession.subscribe((s) => {
if (s !== undefined) {
currentSession = s;
resolve(s);
unsub();
}
});
});
await Promise.race([unsubscribePromise, sessionTimeout]);
if (currentSession === null) {
goto('/login');
return;
}
if (currentSession) {
await loadEmployees();
await loadExistingHours();
}
} catch (error) {
goto('/login');
}
});

// Reactive state
let employees: Employee[] = $state([]);
let selectedDate = $state(new Date().toISOString().split('T')[0]);
let employeeHours: Record<string, number> = $state({});
let estimatedPackagesShipped = $state(0);
let loading = $state(false);
let saving = $state(false);
let saveStatus = $state('');
let error = $state('');
let hasExistingData = $state(false);
let savedHours: Record<string, number> = $state({});
let savedPackagesShipped = $state(0);

// Animation state
const animatedTotal = tweened(0, { duration: 500, easing: cubicOut });
const animatedProductivity = tweened(0, { duration: 500, easing: cubicOut });

// Derived calculations
let sortedEmployees = $derived.by(() => {
return [...employees]
.map((employee) => ({
...employee,
hours: employeeHours[employee.id] || 0
}))
.sort((a, b) => {
const roleOrder: Record<string, number> = {
'Manager': 1, 'Supervisor': 1, 'B2C Accounts Manager': 1,
'Associate': 2, 'Picking': 3
};
const aOrder = roleOrder[a.role || ''] || 4;
const bOrder = roleOrder[b.role || ''] || 4;
if (aOrder !== bOrder) return aOrder - bOrder;
if (a.id === 'extra-associate-hours') return 1;
if (b.id === 'extra-associate-hours') return -1;
return (a.name.split(' ').pop() || '').localeCompare(b.name.split(' ').pop() || '');
});
});

let roleBreakdown = $derived.by(() => {
const breakdown: Record<string, { employees: number; totalHours: number }> = {};
sortedEmployees.forEach((emp) => {
const role = emp.role || 'Unknown';
if (!breakdown[role]) breakdown[role] = { employees: 0, totalHours: 0 };
breakdown[role].employees += 1;
breakdown[role].totalHours += emp.hours;
});
return breakdown;
});

let totalHours = $derived(Object.values(roleBreakdown).reduce((sum, r) => sum + r.totalHours, 0));
let associateHours = $derived(roleBreakdown['Associate']?.totalHours || 0);
let activeCount = $derived(sortedEmployees.filter(e => e.hours > 0).length);

let productivity = $derived(associateHours > 0 ? estimatedPackagesShipped / associateHours : 0);
let targetProductivity = 18;

$effect(() => {
animatedTotal.set(totalHours);
animatedProductivity.set(productivity);
});

let recommendation = $derived.by(() => {
if (estimatedPackagesShipped === 0 || associateHours === 0) return { reduction: 0, show: false };
const optimalHours = estimatedPackagesShipped / targetProductivity;
const reduction = associateHours - optimalHours;
return { reduction: Math.max(0, reduction), show: productivity < targetProductivity };
});

async function loadEmployees() {
try {
loading = true;
employees = await getEmployees();
employees = [...employees, { id: 'extra-associate-hours', name: 'Extra Hours', role: 'Associate' }];
employees.forEach(emp => { employeeHours[emp.id] = 0; });
} finally {
loading = false;
}
}

async function loadExistingHours() {
try {
const existing = await getDailyHours(selectedDate);
hasExistingData = existing.length > 0;
const hoursMap: Record<string, number> = {};
existing.forEach(r => { hoursMap[r.employee_id] = r.hours_worked; });
employeeHours = { ...employeeHours, ...hoursMap };
savedHours = { ...hoursMap };
} catch (err) { console.error(err); }
}

function adjustHours(id: string, delta: number) {
const current = employeeHours[id] || 0;
employeeHours[id] = Math.max(0, current + delta);
}

function setHours(id: string, val: number) {
employeeHours[id] = val;
}

async function saveHours() {
try {
saving = true;
const employeesForSave = employees.map(e => ({ id: e.id, name: e.name, role: e.role || 'Unknown' }));
const result = await saveDailyHours(employeeHours, employeesForSave, selectedDate, 'system');
if (result.success) {
saveStatus = 'success';
hasExistingData = true;
savedHours = { ...employeeHours };
setTimeout(() => { saveStatus = ''; }, 3000);
} else {
error = result.error || 'Failed to save';
}
} finally {
saving = false;
}
}
</script>

<div class="min-h-screen bg-slate-50/50 p-4 lg:p-6 pb-24">
<div class="max-w-7xl mx-auto space-y-6">
<!-- Header with Global Actions -->
<div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
<div class="flex items-center gap-3">
<div class="bg-indigo-600 p-2 rounded-lg text-white">
<Clock size={24} />
</div>
<div>
<h1 class="text-xl font-bold text-slate-900">Labor Performance</h1>
<p class="text-xs text-slate-500 font-medium uppercase tracking-wider flex items-center gap-1">
<CalendarDays size={12} /> {new Date(selectedDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
</p>
</div>
</div>

<div class="flex items-center gap-3 w-full md:w-auto">
<input type="date" bind:value={selectedDate} onchange={loadExistingHours} class="px-3 py-2 border rounded-lg text-sm bg-slate-50 font-medium outline-none focus:ring-2 focus:ring-indigo-500/20" />
<button 
onclick={saveHours} 
disabled={saving}
class="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-bold text-sm transition-all shadow-lg shadow-indigo-200"
>
{#if saving} <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> {/if}
<Save size={16} /> {hasExistingData ? 'Update Records' : 'Save Records'}
</button>
</div>
</div>

{#if saveStatus === 'success'}
<div class="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
<CheckCircle2 size={18} /> <span class="text-sm font-bold">Records synchronized successfully.</span>
</div>
{/if}

<!-- KPI Dashboard -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
<Card class="border-slate-200 shadow-sm">
<CardContent class="p-5">
<div class="flex items-center justify-between">
<p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Labor</p>
<Clock class="text-indigo-500" size={16} />
</div>
<div class="mt-2 flex items-baseline gap-2">
<span class="text-3xl font-black text-slate-900">{$animatedTotal.toFixed(1)}</span>
<span class="text-sm font-bold text-slate-400">Hours</span>
</div>
<p class="text-[10px] text-slate-400 mt-1 font-medium">{activeCount} staff active today</p>
</CardContent>
</Card>

<Card class="border-slate-200 shadow-sm">
<CardContent class="p-5">
<div class="flex items-center justify-between">
<p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Shipment Volume</p>
<Package class="text-blue-500" size={16} />
</div>
<div class="mt-2">
<input type="number" bind:value={estimatedPackagesShipped} class="text-3xl font-black text-slate-900 w-full bg-transparent outline-none focus:text-indigo-600 transition-colors" placeholder="0" />
</div>
<p class="text-[10px] text-slate-400 mt-1 font-medium">Est. units for productivity tracking</p>
</CardContent>
</Card>

<Card class="overflow-hidden {productivity >= 18 ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}">
<CardContent class="p-5">
<div class="flex items-center justify-between">
<p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Units / Hour</p>
<TrendingUp class={productivity >= 18 ? 'text-emerald-500' : 'text-slate-400'} size={16} />
</div>
<div class="mt-2 flex items-baseline gap-2">
<span class="text-3xl font-black {productivity >= 18 ? 'text-emerald-600' : 'text-slate-900'}">{$animatedProductivity.toFixed(1)}</span>
<Badge variant="outline" class="ml-auto text-[9px] {productivity >= 18 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600'}">Target: 18.0</Badge>
</div>
<div class="mt-3 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
<div class="h-full transition-all duration-1000 {productivity >= 18 ? 'bg-emerald-500' : productivity >= 15 ? 'bg-amber-500' : 'bg-rose-500'}" style="width: {Math.min((productivity/18)*100, 100)}%"></div>
</div>
</CardContent>
</Card>

<Card class="border-amber-200 bg-amber-50/30">
<CardContent class="p-5">
<div class="flex items-center justify-between">
<p class="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Labor Optimization</p>
<AlertTriangle class="text-amber-500" size={16} />
</div>
{#if recommendation.show}
<div class="mt-2 flex items-baseline gap-2">
<span class="text-3xl font-black text-amber-600">{recommendation.reduction.toFixed(1)}</span>
<span class="text-sm font-bold text-amber-500">Hr Redux</span>
</div>
<p class="text-[9px] text-amber-600 mt-1 font-bold leading-tight">Reduce associate hours to hit 18.0/hr target</p>
{:else if estimatedPackagesShipped > 0 && associateHours > 0}
<div class="mt-2 flex items-center gap-2 text-emerald-600">
<CheckCircle2 size={24} />
<span class="text-sm font-bold">Standard Met</span>
</div>
<p class="text-[10px] text-slate-400 mt-1 font-medium">Labor allocation is optimized</p>
{:else}
<div class="mt-2 flex items-center gap-2 text-slate-400">
<AlertTriangle size={24} class="opacity-40" />
<span class="text-sm font-bold tracking-tight">Pending Data</span>
</div>
<p class="text-[10px] text-slate-400 mt-1 font-medium italic">Enter volume & hours</p>
{/if}
</CardContent>
</Card>
</div>

<!-- Main Entry Grid -->
<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
<!-- Staff List -->
<div class="lg:col-span-8 space-y-4">
<Card class="border-slate-200 shadow-sm overflow-hidden">
<div class="bg-slate-50 border-b px-4 py-3 flex justify-between items-center">
<h2 class="text-sm font-bold text-slate-700 uppercase tracking-tight">Staff Time Entries</h2>
<button onclick={() => { employees.forEach(e => employeeHours[e.id] = 0); estimatedPackagesShipped = 0; }} class="text-[10px] font-bold text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors">
<RotateCcw size={12} /> Clear Page
</button>
</div>
<div class="divide-y">
{#each sortedEmployees as employee, index}
{#if index === 0 || sortedEmployees[index - 1].role !== employee.role}
<div class="bg-slate-50/80 px-4 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest border-y">
{employee.role || 'Unassigned'} Team
</div>
{/if}
<div class="group flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors {employee.hours > 0 ? 'bg-indigo-50/20' : ''}">
<div class="flex-1 min-w-0">
<p class="text-sm font-bold text-slate-800 truncate">{employee.name}</p>
<p class="text-[10px] text-slate-400 font-medium">{employee.role || 'Staff'}</p>
</div>

<div class="flex items-center gap-3">
<!-- Quick Entry Buttons -->
<div class="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
<button onclick={() => setHours(employee.id, 8)} class="px-2 py-1 text-[9px] font-bold border rounded bg-white hover:bg-indigo-50 text-slate-500 transition-colors">8h</button>
<button onclick={() => setHours(employee.id, 4)} class="px-2 py-1 text-[9px] font-bold border rounded bg-white hover:bg-indigo-50 text-slate-500 transition-colors">4h</button>
</div>

<div class="flex items-center border rounded-lg bg-white shadow-sm overflow-hidden">
<button 
onclick={() => adjustHours(employee.id, -0.5)}
class="p-2 hover:bg-slate-50 text-slate-400 transition-colors"
>
<Minus size={14} />
</button>
<input 
type="number" 
step="0.5" 
min="0"
value={employee.hours}
oninput={(e) => employeeHours[employee.id] = parseFloat(e.currentTarget.value) || 0}
class="w-12 text-center text-sm font-bold bg-transparent outline-none border-x py-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
/>
<button 
onclick={() => adjustHours(employee.id, 0.5)}
class="p-2 hover:bg-slate-50 text-indigo-500 transition-colors"
>
<Plus size={14} />
</button>
</div>
</div>
</div>
{/each}
</div>
</Card>
</div>

<!-- Role Breakdown & Insights -->
<div class="lg:col-span-4 space-y-6">
<Card class="border-slate-200 shadow-sm">
<CardHeader class="pb-2 border-b mb-4">
<CardTitle class="text-[11px] font-black text-slate-500 uppercase tracking-widest">Hrs by Department</CardTitle>
</CardHeader>
<CardContent class="p-0">
<div class="divide-y px-4">
{#each Object.entries(roleBreakdown) as [role, data]}
<div class="flex items-center justify-between py-3">
<div>
<p class="text-sm font-bold text-slate-700">{role}</p>
<p class="text-[10px] text-slate-400 font-medium">{data.employees} active</p>
</div>
<div class="text-right">
<p class="text-sm font-black text-slate-900">{data.totalHours.toFixed(1)}</p>
<p class="text-[9px] font-bold text-slate-400">Total Hrs</p>
</div>
</div>
{/each}
</div>
<div class="bg-indigo-600 p-4 mt-2">
<div class="flex justify-between items-center text-white">
<span class="text-xs font-bold uppercase tracking-wider opacity-80">Shift Aggregate</span>
<span class="text-xl font-black">{totalHours.toFixed(1)} hrs</span>
</div>
</div>
</CardContent>
</Card>

<div class="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 flex items-start gap-3">
<TrendingUp class="text-indigo-600 shrink-0 mt-0.5" size={18} />
<div>
<p class="text-sm font-bold text-indigo-900 leading-tight">Operational Insight</p>
<p class="text-[11px] text-indigo-700/80 mt-1 font-medium italic">
"Maintaining {targetProductivity} units/hr ensures labor efficiency is aligned with warehouse capacity. Monitor Red/Amber gauges during volume spikes."
</p>
</div>
</div>

<div class="text-center px-4">
<DocumentationLink section="employee-hours" />
</div>
</div>
</div>
</div>
</div>

<style>
:global(input[type="number"]::-webkit-outer-spin-button),
:global(input[type="number"]::-webkit-inner-spin-button) {
-webkit-appearance: none;
margin: 0;
}
:global(input[type="date"]::-webkit-calendar-picker-indicator) {
cursor: pointer;
opacity: 0.6;
transition: opacity 0.2s;
}
:global(input[type="date"]::-webkit-calendar-picker-indicator:hover) {
opacity: 1;
}
</style>
