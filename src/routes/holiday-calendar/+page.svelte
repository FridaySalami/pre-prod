<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		format,
		startOfMonth,
		endOfMonth,
		startOfWeek,
		endOfWeek,
		eachDayOfInterval,
		isSameMonth,
		isSameDay,
		addMonths,
		subMonths,
		isWithinInterval,
		startOfDay,
		endOfDay
	} from 'date-fns';
	import {
		ChevronLeft,
		ChevronRight,
		RefreshCw,
		Calendar as CalendarIcon,
		List as ListIcon,
		UserPlus,
		UserMinus
	} from 'lucide-svelte';

	export let data;

	let syncing = false;
	let syncMessage = '';
	let viewMode: 'calendar' | 'list' = 'calendar';

	// Employee Add State
	let isAddEmployeeOpen = false;
	let availableUsers: any[] = [];
	let loadingUsers = false;
	let fetchError = '';
	let selectedUser: any = null;
	let selectedRole = 'Warehouse Operative';
	let addingEmployee = false;

	async function openAddEmployee() {
		isAddEmployeeOpen = true;
		availableUsers = [];
		selectedUser = null;
		loadingUsers = true;
		fetchError = '';

		try {
			const res = await fetch('/api/employees/fetch-external', { method: 'POST' });
			if (res.ok) {
				const data = await res.json();
				console.log('Received users from API:', data.users);
				availableUsers = data.users || [];
			} else {
				const err = await res.json().catch(() => ({}));
				fetchError = err.error || 'Failed to fetch external users';
				console.error('Failed to fetch external users', err);
			}
		} catch (e) {
			console.error(e);
			fetchError = 'Network error fetching users';
		} finally {
			loadingUsers = false;
		}
	}

	async function handleAddEmployee() {
		if (!selectedUser) return;
		addingEmployee = true;

		try {
			const fullName = `${selectedUser.firstname} ${selectedUser.surname}`;

			// 1. Add Employee to DB
			const addRes = await fetch('/api/employees/add', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: fullName, role: selectedRole })
			});

			if (!addRes.ok) {
				const err = await addRes.json();
				if (addRes.status === 409) {
					alert(`Employee ${fullName} is already tracked.`);
				} else {
					alert('Error adding employee: ' + err.error);
				}
				return;
			}

			// 2. Trigger Sync
			await syncHolidays();
			isAddEmployeeOpen = false;
		} catch (e) {
			console.error('Error adding employee:', e);
			alert('An error occurred.');
		} finally {
			addingEmployee = false;
		}
	}

	// Employee Remove State
	let isStopTrackingOpen = false;
	let trackedUsers: any[] = [];
	let loadingTrackedUsers = false;
	let selectedTrackedUser: any = null;
	let removingEmployee = false;

	async function openStopTracking() {
		isStopTrackingOpen = true;
		trackedUsers = [];
		selectedTrackedUser = null;
		loadingTrackedUsers = true;

		try {
			const res = await fetch('/api/employees/list');
			if (res.ok) {
				const data = await res.json();
				trackedUsers = data.employees || [];
			} else {
				console.error('Failed to fetch tracked employees');
			}
		} catch (e) {
			console.error(e);
		} finally {
			loadingTrackedUsers = false;
		}
	}

	async function handleStopTracking() {
		if (!selectedTrackedUser) return;
		if (
			!confirm(
				`Are you sure you want to stop tracking ${selectedTrackedUser.name}? This will remove them from the system.`
			)
		)
			return;
		removingEmployee = true;

		try {
			const res = await fetch('/api/employees/delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: selectedTrackedUser.id })
			});

			if (!res.ok) {
				const err = await res.json();
				alert('Error removing employee: ' + err.error);
				return;
			}

			// Trigger Sync to refresh
			await syncHolidays();
			isStopTrackingOpen = false;
		} catch (e) {
			console.error('Error removing employee:', e);
			alert('An error occurred.');
		} finally {
			removingEmployee = false;
		}
	}

	// Calendar state
	let currentDate = new Date();
	$: monthStart = startOfMonth(currentDate);
	$: monthEnd = endOfMonth(currentDate);
	$: startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
	$: endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

	$: calendarDays = eachDayOfInterval({
		start: startDate,
		end: endDate
	});

	// Process holidays for calendar view
	function getHolidaysForDay(day: Date, holidays: any[]) {
		return holidays.filter((h) => {
			// Parse dates safely
			if (!h.from_date || !h.to_date) return false;

			const start = startOfDay(new Date(h.from_date));
			const end = endOfDay(new Date(h.to_date));
			const current = startOfDay(day);

			// Check if within basic range
			const inRange = isWithinInterval(current, { start, end });
			if (!inRange) return false;

			// Check if explicitly excluded
			if (h.dates_to_exclude) {
				// dates_to_exclude looks like " 2026-01-08 2026-01-11 "
				// Format current day to YYYY-MM-DD
				const dayStr = format(current, 'yyyy-MM-dd');
				if (h.dates_to_exclude.includes(dayStr)) {
					return false;
				}
			}

			return true;
		});
	}

	function previousMonth() {
		currentDate = subMonths(currentDate, 1);
	}

	function nextMonth() {
		currentDate = addMonths(currentDate, 1);
	}

	function goToToday() {
		currentDate = new Date();
	}

	async function syncHolidays() {
		syncing = true;
		syncMessage = 'Syncing...';
		try {
			const res = await fetch('/api/holidays/sync', { method: 'POST' });
			const result = await res.json();

			if (res.ok) {
				syncMessage = `Success! ${result.message}`;
				await invalidateAll(); // Refresh data
				setTimeout(() => (syncMessage = ''), 3000);
			} else {
				syncMessage = `Error: ${result.error}`;
			}
		} catch (e) {
			syncMessage = 'Error connecting to server';
			console.error(e);
		} finally {
			syncing = false;
		}
	}

	function getStatusStyles(status: string, isList = false) {
		const s = status?.toLowerCase() || '';
		if (s === 'accepted') {
			return isList ? 'bg-green-100 text-green-800' : 'bg-green-50 text-green-800 border-green-100';
		} else if (s.includes('rejected') || s.includes('declined')) {
			return isList ? 'bg-red-100 text-red-800' : 'bg-red-50 text-red-800 border-red-100';
		} else if (s.includes('withdrawn') || s.includes('cancelled') || s.includes('removed')) {
			return isList
				? 'bg-gray-100 text-gray-600'
				: 'bg-gray-50 text-gray-600 border-gray-100 decoration-line-through';
		} else {
			// Pending / Requested
			return isList
				? 'bg-yellow-100 text-yellow-800'
				: 'bg-yellow-50 text-yellow-800 border-yellow-100';
		}
	}
</script>

<div class="container mx-auto py-8 px-4">
	<div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
		<div class="flex items-center gap-4">
			<h1 class="text-2xl font-bold flex items-center gap-2">
				<CalendarIcon class="w-6 h-6" />
				Holiday Calendar
			</h1>

			<div class="flex items-center bg-gray-100 rounded-lg p-1 border">
				<button
					class="px-3 py-1 rounded-md text-sm font-medium transition-colors {viewMode === 'calendar'
						? 'bg-white shadow text-blue-600'
						: 'text-gray-600 hover:text-gray-900'}"
					onclick={() => (viewMode = 'calendar')}
				>
					Calendar
				</button>
				<button
					class="px-3 py-1 rounded-md text-sm font-medium transition-colors {viewMode === 'list'
						? 'bg-white shadow text-blue-600'
						: 'text-gray-600 hover:text-gray-900'}"
					onclick={() => (viewMode = 'list')}
				>
					List
				</button>
			</div>
		</div>

		<div class="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
			<button
				onclick={openAddEmployee}
				class="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg border transition-colors shadow-sm"
			>
				<UserPlus class="w-4 h-4" />
				Add Employee
			</button>
			<button
				onclick={openStopTracking}
				class="flex items-center gap-2 bg-white hover:bg-gray-50 text-red-600 px-4 py-2 rounded-lg border border-red-200 transition-colors shadow-sm"
			>
				<UserMinus class="w-4 h-4" />
				Stop Tracking
			</button>
			{#if syncMessage}
				<span
					class="text-sm {syncMessage.includes('Error')
						? 'text-red-600'
						: 'text-green-600'} animate-pulse">{syncMessage}</span
				>
			{/if}
			<button
				onclick={syncHolidays}
				disabled={syncing}
				class="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 transition-colors shadow-sm"
			>
				<RefreshCw class="w-4 h-4 {syncing ? 'animate-spin' : ''}" />
				{syncing ? 'Syncing...' : 'Sync Data'}
			</button>
		</div>
	</div>

	<!-- Legend -->
	<div class="flex flex-wrap gap-4 mb-6 px-1">
		<div class="flex items-center gap-2 text-sm text-gray-600">
			<span class="w-3 h-3 rounded-full bg-green-100 border border-green-200"></span>
			<span>Accepted</span>
		</div>
		<div class="flex items-center gap-2 text-sm text-gray-600">
			<span class="w-3 h-3 rounded-full bg-yellow-100 border border-yellow-200"></span>
			<span>Pending</span>
		</div>
		<div class="flex items-center gap-2 text-sm text-gray-600">
			<span class="w-3 h-3 rounded-full bg-red-100 border border-red-200"></span>
			<span>Declined</span>
		</div>
		<div class="flex items-center gap-2 text-sm text-gray-600">
			<span class="w-3 h-3 rounded-full bg-gray-100 border border-gray-200 relative">
				<div
					class="absolute inset-0 top-1/2 border-t border-gray-400 transform -translate-y-1/2"
				></div>
			</span>
			<span>Withdrawn/Cancelled</span>
		</div>
	</div>

	{#if viewMode === 'calendar'}
		<div class="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
			<!-- Calendar Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
				<div class="flex items-center gap-4">
					<h2 class="text-lg font-semibold text-gray-900">
						{format(currentDate, 'MMMM yyyy')}
					</h2>
					<div class="flex items-center bg-white rounded-md border shadow-sm">
						<button class="p-1.5 hover:bg-gray-100 rounded-l-md border-r" onclick={previousMonth}>
							<ChevronLeft class="w-5 h-5 text-gray-600" />
						</button>
						<button
							class="px-3 py-1.5 text-sm font-medium hover:bg-gray-100 text-gray-700"
							onclick={goToToday}
						>
							Today
						</button>
						<button class="p-1.5 hover:bg-gray-100 rounded-r-md border-l" onclick={nextMonth}>
							<ChevronRight class="w-5 h-5 text-gray-600" />
						</button>
					</div>
				</div>
			</div>

			<!-- Days Header -->
			<div class="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
				{#each ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as day}
					<div
						class="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider"
					>
						{day}
					</div>
				{/each}
			</div>

			<!-- Calendar Grid -->
			<div class="grid grid-cols-7 auto-rows-fr bg-gray-200 gap-px">
				{#each calendarDays as day}
					{@const isCurrentMonth = isSameMonth(day, currentDate)}
					{@const isToday = isSameDay(day, new Date())}
					{@const dayHolidays = getHolidaysForDay(day, data.holidays)}

					<div
						class="min-h-[120px] bg-white p-2 relative group {isCurrentMonth
							? ''
							: 'bg-gray-50 text-gray-400'}"
					>
						<div class="flex justify-between items-start mb-1 h-6">
							<span
								class="text-sm font-medium rounded-full w-6 h-6 flex items-center justify-center
                            {isToday
									? 'bg-blue-600 text-white'
									: isCurrentMonth
										? 'text-gray-700'
										: 'text-gray-400'}"
							>
								{format(day, 'd')}
							</span>
							{#if dayHolidays.length > 0}
								<span
									class="text-xs font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full"
								>
									{dayHolidays.length}
								</span>
							{/if}
						</div>

						<div class="space-y-1 overflow-y-auto max-h-[85px] custom-scrollbar">
							{#each dayHolidays.slice(0, 3) as holiday}
								{@const isHalfDay = parseFloat(holiday.duration) === 0.5}
								<div
									class="px-1.5 py-1 text-xs rounded border truncate {getStatusStyles(
										holiday.status,
										false
									)}"
									title="{holiday.employee_name}{isHalfDay ? ' (Half Day)' : ''} - {holiday.notes ||
										'Holiday'}"
								>
									{holiday.employee_name.split(' ')[0]}
									{holiday.employee_name
										.split(' ')
										.slice(1)
										.map((n: string) => n[0])
										.join('')}
									{isHalfDay ? ' (Half Day)' : ''}
								</div>
							{/each}
							{#if dayHolidays.length > 3}
								<div
									class="text-xs text-center text-gray-500 font-medium bg-gray-50 rounded py-0.5 mt-0.5 hover:bg-gray-100 cursor-help"
									title="Total {dayHolidays.length} holidays"
								>
									+{dayHolidays.length - 3} more
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<!-- List View -->
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Employee</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Dates</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Duration</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Status</th
						>
						<th
							class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
							>Notes</th
						>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#if data.holidays.length === 0}
						<tr>
							<td colspan="5" class="px-6 py-4 text-center text-gray-500">
								No holidays found. Click "Sync Data" to fetch data.
							</td>
						</tr>
					{:else}
						{#each data.holidays as holiday}
							<tr>
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="text-sm font-medium text-gray-900">{holiday.employee_name}</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="text-sm text-gray-900">
										{format(new Date(holiday.from_date), 'MMM d, yyyy')}
										{#if holiday.from_date !== holiday.to_date}
											- {format(new Date(holiday.to_date), 'MMM d, yyyy')}
										{/if}
									</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="text-sm text-gray-900">{holiday.duration} {holiday.units}</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<span
										class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full {getStatusStyles(
											holiday.status,
											true
										)}"
									>
										{holiday.status}
									</span>
								</td>
								<td class="px-6 py-4">
									<div class="text-sm text-gray-500 truncate max-w-xs">{holiday.notes || '-'}</div>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	{/if}
</div>

{#if isAddEmployeeOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl space-y-6 relative">
			<div class="space-y-1.5">
				<h3 class="text-lg font-semibold leading-none tracking-tight">
					Add Employee to Monitoring
				</h3>
				<p class="text-sm text-gray-500">
					Select an employee from HR Toolkit to add to the holiday tracking system.
				</p>
			</div>

			{#if fetchError}
				<div class="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
					{fetchError}
				</div>
			{/if}

			<div class="space-y-2">
				<label
					for="employee"
					class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
				>
					Select Employee
				</label>
				<select
					id="employee"
					bind:value={selectedUser}
					disabled={loadingUsers}
					class="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<option value="">{loadingUsers ? 'Loading employees...' : 'Select an employee...'}</option>
					{#each availableUsers.sort((a, b) => a.firstname.localeCompare(b.firstname)) as user}
						<option value={user}>
							{user.firstname}
							{user.surname}
						</option>
					{/each}
				</select>
			</div>

			<div class="flex justify-end gap-3">
				<button
					type="button"
					class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-gray-200 bg-white hover:bg-gray-100 hover:text-gray-900 h-10 px-4 py-2"
					onclick={() => (isAddEmployeeOpen = false)}
				>
					Cancel
				</button>
				<button
					type="button"
					class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gray-900 text-gray-50 hover:bg-gray-900/90 h-10 px-4 py-2"
					onclick={handleAddEmployee}
					disabled={!selectedUser || addingEmployee}
				>
					{addingEmployee ? 'Adding...' : 'Add Employee'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if isStopTrackingOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl space-y-6 relative">
			<div class="space-y-1.5">
				<h3 class="text-lg font-semibold leading-none tracking-tight">Stop Tracking Employee</h3>
				<p class="text-sm text-gray-500">
					Select an employee to remove from the holiday tracking system.
				</p>
			</div>

			<div class="space-y-2">
				<label
					for="tracked-employee"
					class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
				>
					Select Employee
				</label>
				<select
					id="tracked-employee"
					bind:value={selectedTrackedUser}
					disabled={loadingTrackedUsers}
					class="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<option value="">{loadingTrackedUsers ? 'Loading employees...' : 'Select an employee...'}</option>
					{#each trackedUsers as user}
						<option value={user}>
							{user.name}
							({user.role})
						</option>
					{/each}
				</select>
			</div>

			<div class="flex justify-end gap-3">
				<button
					type="button"
					class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-gray-200 bg-white hover:bg-gray-100 hover:text-gray-900 h-10 px-4 py-2"
					onclick={() => (isStopTrackingOpen = false)}
				>
					Cancel
				</button>
				<button
					type="button"
					class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-red-600 text-white hover:bg-red-700 h-10 px-4 py-2"
					onclick={handleStopTracking}
					disabled={!selectedTrackedUser || removingEmployee}
				>
					{removingEmployee ? 'Removing...' : 'Stop Tracking'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background-color: #e5e7eb;
		border-radius: 20px;
	}
</style>
