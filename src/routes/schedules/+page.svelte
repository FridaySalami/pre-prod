<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { goto } from '$app/navigation';
	import { userSession } from '$lib/sessionStore';
	import { supabase } from '$lib/supabaseClient';
	import ScheduleManager from '$lib/schedule/ScheduleManager.svelte';
	import EmployeeLeaveModal from '$lib/schedule/EmployeeLeaveModal.svelte';
	import BulkLeaveModal from '$lib/schedule/BulkLeaveModal.svelte';
	import { toastStore, showToast } from '$lib/toastStore';
	import { updateScheduledHoursForDate } from '$lib/schedule/hours-service';
	import { updateScheduledHoursBatch } from '$lib/schedule/batchUpdateService';
	import { populateCalendar as populateCalendarExternal } from '$lib/schedule/PopulateCalendar.svelte';
	import './style.css';

	let session: any = undefined;
	const unsubscribe = userSession.subscribe((s) => {
		session = s;
	});

	interface Employee {
		id: string;
		name: string;
		role: string;
	}

	interface ScheduleItem {
		id: string;
		employeeId: string;
		date: string;
		shift: 'morning' | 'afternoon' | 'night';
	}

	interface EmployeeSchedule {
		id: string;
		name: string;
		role: string;
		shifts: Record<string, string>;
	}

	interface CalendarDay {
		date: Date;
		isCurrentMonth: boolean;
		employees: {
			id: string;
			name: string;
			role: string;
			shift: string;
			onLeave?: boolean;
			leaveType?: string;
			leaveColor?: string;
		}[];
		totalWorkingHours?: number; // Add this property
	}

	// Add this type for weekly patterns
	interface WeeklyPattern {
		id: string;
		employee_id: string;
		day_of_week: number;
		is_working: boolean;
	}

	interface LeaveType {
		id: number;
		name: string;
		color: string;
	}

	interface LeaveRequest {
		id: string;
		employee_id: string;
		start_date: string;
		end_date: string;
		leave_type_id: number;
		leave_type_name: string;
		leave_type_color: string;
		status: string;
		notes: string;
	}

	let employees: Employee[] = [];
	let scheduleItems: ScheduleItem[] = [];
	let employeeSchedules: EmployeeSchedule[] = [];
	let leaveRequests: LeaveRequest[] = [];
	let leaveTypes: LeaveType[] = [];
	let loading = true;
	let error: string | null = null;

	// Calendar state
	let currentMonth = new Date().getMonth();
	let currentYear = new Date().getFullYear();
	let calendarDays: CalendarDay[] = [];
	let daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	// Modal state
	let showAddForm = false;
	let newScheduleItem: {
		employeeId: string;
		date: string;
		shift: 'morning' | 'afternoon' | 'night';
	} = {
		employeeId: '',
		date: '',
		shift: 'morning'
	};

	// Flag to control which view is active (calendar or manager)
	let showManager = false;

	// Function to reload schedules when the manager saves changes
	function handleScheduleUpdate() {
		// Refetch data to update the calendar
		fetchData();
	}

	// Helper function to get initials from a name
	function getInitials(name: string): string {
		if (!name || typeof name !== 'string') return '??';

		return name
			.split(' ')
			.filter((part) => part.length > 0)
			.map((part) => part[0])
			.join('')
			.toUpperCase()
			.substring(0, 2); // Limit to 2 characters max
	}

	// Update the showTooltip function with proper types
	function showTooltip(event: MouseEvent) {
		const container = event.currentTarget as HTMLElement;
		const tooltip = container.querySelector('.employee-tooltip');
		if (!tooltip) return;

		// Get position info
		const rect = container.getBoundingClientRect();
		const spaceAbove = rect.top;
		const spaceBelow = window.innerHeight - rect.bottom;

		// Clear existing position classes
		tooltip.classList.remove('tooltip-top', 'tooltip-bottom');

		// Decide where to show tooltip
		if (spaceBelow >= 100 || spaceBelow > spaceAbove) {
			// Show below if there's enough space or more than above
			tooltip.classList.add('tooltip-bottom');
		} else {
			// Otherwise show above
			tooltip.classList.add('tooltip-top');
		}

		// Make tooltip visible
		tooltip.classList.add('tooltip-visible');
	}

	// Update the hideTooltip function with proper types
	function hideTooltip(event: MouseEvent) {
		const container = event.currentTarget as HTMLElement;
		const tooltip = container.querySelector('.employee-tooltip');
		if (tooltip) {
			tooltip.classList.remove('tooltip-visible');
		}
	} // Generate calendar days for a month
	function generateCalendar(year: number, month: number) {
		const firstDayOfMonth = new Date(year, month, 1);
		const lastDayOfMonth = new Date(year, month + 1, 0);

		// Get the day of the week (0 = Sunday, 1 = Monday, etc.)
		// Adjust to make Monday the first day of the week
		let firstDayWeekday = firstDayOfMonth.getDay() - 1;
		if (firstDayWeekday < 0) firstDayWeekday = 6; // Sunday becomes the last day

		const days: CalendarDay[] = [];

		// Add days from previous month to start on Monday
		const prevMonth = month === 0 ? 11 : month - 1;
		const prevMonthYear = month === 0 ? year - 1 : year;
		const prevMonthLastDay = new Date(prevMonthYear, prevMonth + 1, 0).getDate();

		for (let i = 0; i < firstDayWeekday; i++) {
			const date = new Date(prevMonthYear, prevMonth, prevMonthLastDay - firstDayWeekday + i + 1);
			days.push({
				date,
				isCurrentMonth: false,
				employees: []
			});
		}

		// Add days of current month
		for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
			const date = new Date(year, month, i);
			days.push({
				date,
				isCurrentMonth: true,
				employees: []
			});
		}

		// Add days from next month to complete the grid (6 rows of 7 days = 42)
		const nextMonth = month === 11 ? 0 : month + 1;
		const nextMonthYear = month === 11 ? year + 1 : year;

		const daysNeeded = 42 - days.length;
		for (let i = 1; i <= daysNeeded; i++) {
			const date = new Date(nextMonthYear, nextMonth, i);
			days.push({
				date,
				isCurrentMonth: false,
				employees: []
			});
		}

		return days;
	}

	// Format date for display
	function formatDate(date: Date): string {
		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	// Format month for display
	function formatMonth(date: Date): string {
		return date.toLocaleDateString('en-US', {
			month: 'long',
			year: 'numeric'
		});
	}

	// Format date for API
	function formatApiDate(date: Date): string {
		return date.toISOString().split('T')[0];
	}

	// Add this helper function for timezone safety
	function getLocalISODate(date: Date): string {
		// Get YYYY-MM-DD without timezone shifting
		const offset = date.getTimezoneOffset();
		const adjustedDate = new Date(date.getTime() - offset * 60 * 1000);
		return adjustedDate.toISOString().split('T')[0];
	}

	// Fetch employees and schedules data
	async function fetchData() {
		try {
			loading = true;

			// Generate calendar days first for immediate rendering
			calendarDays = generateCalendar(currentYear, currentMonth);

			// Get start and end dates for the current month view
			const startDate = formatApiDate(calendarDays[0].date);
			const endDate = formatApiDate(calendarDays[calendarDays.length - 1].date);

			// Fetch essential data first
			const employeesPromise = supabase.from('employees').select('*');

			// Get employees first and start rendering
			const { data: empData, error: empError } = await employeesPromise;

			if (empError) throw empError;
			employees = empData || [];

			// Only after employees are loaded, get schedules and patterns
			const [scheduleResult, patternResult] = await Promise.all([
				supabase.from('schedules').select('*').gte('date', startDate).lte('date', endDate),

				supabase.from('employee_schedules').select('*')
			]);

			if (scheduleResult.error) throw scheduleResult.error;
			if (patternResult.error) throw patternResult.error;

			// Transform data
			scheduleItems =
				scheduleResult.data?.map((item) => ({
					id: item.id,
					employeeId: item.employee_id,
					date: item.date,
					shift: item.shift
				})) || [];

			const weeklyPatterns: WeeklyPattern[] = patternResult.data || [];

			// Add this section to fetch leave requests
			const { data: leaveData, error: leaveError } = await supabase
				.from('leave_requests')
				.select(
					`
          id, employee_id, start_date, end_date, status, notes,
          leave_types(id, name, color)
        `
				)
				.gte('start_date', startDate)
				.lte('end_date', endDate)
				.eq('status', 'approved');

			console.log('Leave data from API:', JSON.stringify(leaveData, null, 2));

			if (leaveError) throw leaveError;

			// Transform leave data for easier use - fix the object access
			leaveRequests = (leaveData || []).map((leave) => {
				// Check if leave_types is an array or an object and handle appropriately
				let leaveType;
				if (Array.isArray(leave.leave_types)) {
					// Handle case where it might be an array
					leaveType = leave.leave_types[0] || {};
				} else {
					// Handle case where it's an object
					leaveType = leave.leave_types || {};
				}

				console.log('Leave type for request:', leave.id, leaveType);

				return {
					id: leave.id,
					employee_id: leave.employee_id,
					start_date: leave.start_date,
					end_date: leave.end_date,
					leave_type_id: leaveType.id || null,
					leave_type_name: leaveType.name || 'Unknown',
					leave_type_color: leaveType.color || '#9ca3af',
					status: leave.status,
					notes: leave.notes
				};
			});

			// Use the imported PopulateCalendar function directly
			calendarDays = populateCalendarExternal(
				calendarDays,
				employees,
				scheduleItems,
				leaveRequests,
				formatApiDate,
				getLocalISODate,
				saveScheduledHours,
				weeklyPatterns
			);

			organizeCalendarWeeks();

			showToast('Schedule updated successfully', 'success');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error occurred';
			console.error(error);
			showToast('Failed to load schedule: ' + error, 'error');
		} finally {
			loading = false;
		}
	}

	// Add this function to get the role priority for sorting
	function getRolePriority(role: string): number {
		const priorities: Record<string, number> = {
			Manager: 1,
			Supervisor: 2,
			'Team Lead': 3,
			Associate: 4,
			Trainee: 5
		};
		return priorities[role] || 99; // Unknown roles go at the end
	}
	// Toggle week expansion
	function toggleWeek(weekIndex: number) {
		const index = expandedWeeks.indexOf(weekIndex);
		if (index > -1) {
			// Only collapse if it's not the current week
			const today = new Date();
			const weekStart = weekIndex * 7;
			const weekDays = calendarDays.slice(weekStart, weekStart + 7);
			const isCurrentWeek = weekDays.some(
				(day) => day.date.toDateString() === today.toDateString()
			);

			if (!isCurrentWeek) {
				expandedWeeks.splice(index, 1);
				expandedWeeks = [...expandedWeeks]; // Trigger reactivity
			}
		} else {
			expandedWeeks.push(weekIndex);
			expandedWeeks = [...expandedWeeks]; // Trigger reactivity
		}
	}

	// Switch between view modes
	function switchView(view: 'month' | 'week' | 'day') {
		calendarView = view;

		if (view === 'week') {
			// Find the current week
			const today = new Date();
			const currentWeekIndex = Math.floor(
				calendarDays.findIndex((day) => day.date.toDateString() === today.toDateString()) / 7
			);

			// Only expand the current week
			expandedWeeks = [currentWeekIndex];
		} else if (view === 'month') {
			// Expand current and next week in month view
			const today = new Date();
			const currentWeekIndex = Math.floor(
				calendarDays.findIndex((day) => day.date.toDateString() === today.toDateString()) / 7
			);

			expandedWeeks = [currentWeekIndex];
			if (currentWeekIndex + 1 < 6) {
				// Assuming 6 weeks max in calendar view
				expandedWeeks.push(currentWeekIndex + 1);
			}
		} else if (view === 'day') {
			// Default to today for day view
			selectedDate = new Date();
		}
	}

	// Add this function to check if an employee is on leave
	function getEmployeeLeave(employeeId: string, date: Date): LeaveRequest | null {
		const dateStr = formatApiDate(date);
		const leave = leaveRequests.find(
			(leave) =>
				leave.employee_id === employeeId && leave.start_date <= dateStr && leave.end_date >= dateStr
		);

		if (leave) {
			console.log('Found leave for employee:', employeeId, 'Leave type:', leave.leave_type_name);
		}

		return leave || null;
	}

	// Change month
	function changeMonth(delta: number) {
		const newMonth = currentMonth + delta;

		// Handle year change when navigating months
		if (newMonth < 0) {
			currentMonth = 11;
			currentYear--;
		} else if (newMonth > 11) {
			currentMonth = 0;
			currentYear++;
		} else {
			currentMonth = newMonth;
		}

		// Fetch data for the new month
		fetchData();
	}

	// Initialize
	onMount(() => {
		// Once we know the session, if it's null then redirect
		if (session === null) {
			goto('/login');
		} else if (session) {
			// Only fetch data if we have a valid session
			fetchData();
		}
	});

	onDestroy(() => {
		unsubscribe();
	});

	// Employee management modal state
	let showEmployeeModal = false;
	let newEmployee = {
		name: '',
		role: ''
	};
	let employeeError: string | null = null;

	// Calendar view state
	let calendarView: 'month' | 'week' | 'day' = 'month';
	let currentDay = new Date().getDate();
	let expandedWeeks: number[] = []; // Track which weeks are expanded
	let weekHeaders: { weekNum: number; monthName: string }[] = [];

	// Add employee function
	async function addEmployee() {
		if (!newEmployee.name || !newEmployee.role) {
			employeeError = 'Please fill out all fields';
			return;
		}

		try {
			const { data, error: insertError } = await supabase
				.from('employees')
				.insert({
					name: newEmployee.name,
					role: newEmployee.role
				})
				.select();

			if (insertError) throw insertError;

			// Refresh employee data
			await fetchData();
			showToast(`Added employee: ${newEmployee.name}`, 'success');
			hideEmployeeModal();
		} catch (err) {
			employeeError = err instanceof Error ? err.message : 'Failed to add employee';
			console.error(employeeError);
			showToast('Failed to add employee: ' + employeeError, 'error');
		}
	}

	// Show employee modal
	function showAddEmployeeModal() {
		employeeError = null;
		newEmployee = {
			name: '',
			role: ''
		};
		showEmployeeModal = true;
	}

	// Group calendar days into weeks and add week headers
	function organizeCalendarWeeks() {
		// Reset week headers
		weekHeaders = [];

		// Today's date for highlighting current week
		const today = new Date();

		// Find the week containing today
		let currentWeekIndex = -1;

		// Process calendar days into weeks
		for (let i = 0; i < calendarDays.length; i += 7) {
			const weekStartDate = calendarDays[i].date;
			const weekIndex = Math.floor(i / 7);

			// Get week number and month for header
			const weekNum = getWeekNumber(weekStartDate);
			const monthName = weekStartDate.toLocaleDateString('en-US', { month: 'long' });

			weekHeaders.push({ weekNum, monthName });

			// Check if this week contains today
			const weekEndDate = new Date(weekStartDate);
			weekEndDate.setDate(weekStartDate.getDate() + 6);

			if (today >= weekStartDate && today <= weekEndDate) {
				currentWeekIndex = weekIndex;
			}
		}

		// Set default expanded weeks to current week and next week
		expandedWeeks = [];
		if (currentWeekIndex >= 0) {
			expandedWeeks.push(currentWeekIndex);
			if (currentWeekIndex + 1 < weekHeaders.length) {
				expandedWeeks.push(currentWeekIndex + 1);
			}
		} else {
			// If we couldn't find current week (rare edge case), expand first two weeks
			expandedWeeks = [0, 1].filter((i) => i < weekHeaders.length);
		}

		return expandedWeeks;
	}
	// Helper function to get week number
	function getWeekNumber(date: Date): number {
		const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
		const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
		return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
	}

	// Hide employee modal
	function hideEmployeeModal() {
		showEmployeeModal = false;
	}

	// Get role class for styling
	function getRoleClass(role: string): string {
		const roleClasses: Record<string, string> = {
			Manager: 'role-manager',
			Supervisor: 'role-supervisor',
			'Team Lead': 'role-team-lead',
			Associate: 'role-associate',
			Trainee: 'role-trainee'
		};

		return roleClasses[role] || 'role-default';
	}

	// Get shift display name
	function getShiftName(shift: string): string {
		const shiftNames: Record<string, string> = {
			morning: '08:00 - 16:30',
			afternoon: '16:00 - 00:30',
			night: '00:00 - 08:30'
		};
		return shiftNames[shift] || shift;
	}

	// Get short abbreviation for role badge
	function getRoleBadge(role: string): string {
		const roleBadges: Record<string, string> = {
			Manager: 'M',
			Supervisor: 'S',
			'Team Lead': 'TL',
			Associate: 'A',
			Trainee: 'T'
		};

		return roleBadges[role] || '?';
	}

	// Show add schedule form
	function showAddScheduleForm(selectedDate?: Date) {
		newScheduleItem = {
			employeeId: '',
			date: selectedDate ? formatApiDate(selectedDate) : '',
			shift: 'morning'
		};
		showAddForm = true;
	}

	// Hide add schedule form
	function hideAddScheduleForm() {
		showAddForm = false;
	}

	// Add these variables to track viewport
	let visibleMonthStart = 0;
	let visibleMonthEnd = 5; // Show all weeks initially
	let calendarViewport: HTMLElement;

	onMount(() => {
		// Check if IntersectionObserver is available for optimization
		if ('IntersectionObserver' in window) {
			const options = {
				root: calendarViewport,
				rootMargin: '0px',
				threshold: 0.1
			};

			const observer = new IntersectionObserver((entries) => {
				entries.forEach((entry) => {
					const weekIndex = parseInt(entry.target.getAttribute('data-week-index') || '0');

					if (entry.isIntersecting) {
						// Week is visible, ensure it's rendered
						if (weekIndex < visibleMonthStart) visibleMonthStart = weekIndex;
						if (weekIndex > visibleMonthEnd) visibleMonthEnd = weekIndex;
					}
				});
			}, options);

			// Observe all week elements
			document.querySelectorAll('.calendar-week').forEach((week) => {
				observer.observe(week);
			});
		}
	});

	// Add these functions to handle employee click and leave management
	let showLeaveModal = false;
	let showBulkLeaveModal = false;
	let selectedEmployee: any = null;
	let selectedDate: Date | null = null;
	let selectedLeave: any = null;

	function handleEmployeeClick(employee: any, date: Date) {
		selectedEmployee = employee;
		selectedDate = date;
		selectedLeave = getEmployeeLeave(employee.id, date);
		showLeaveModal = true;
	}

	function handleLeaveModalClose() {
		showLeaveModal = false;
		selectedEmployee = null;
		selectedDate = null;
		selectedLeave = null;
	}

	function handleLeaveSaved() {
		showLeaveModal = false;
		showBulkLeaveModal = false;

		// Get employee name for better message
		const employeeName = selectedEmployee?.name || 'Employee';

		showToast(`Leave updated for ${employeeName}`, 'success');

		selectedEmployee = null;
		selectedDate = null;
		selectedLeave = null;
		fetchData(); // Refresh data
	}

	// Function to update all scheduled hours in the database

	async function updateAllScheduledHours() {
		try {
			showToast('Starting database update...', 'info');

			// Get date range (2 months before and after)
			const today = new Date();
			const startDate = new Date(today);
			startDate.setMonth(today.getMonth() - 2);

			const endDate = new Date(today);
			endDate.setMonth(today.getMonth() + 2);

			// Use the batch update service
			const updatedCount = await updateScheduledHoursBatch(startDate, endDate);

			showToast(`Successfully updated hours for ${updatedCount} days`, 'success');
		} catch (err) {
			console.error('Error updating hours:', err);
			showToast(
				'Failed to update hours: ' + (err instanceof Error ? err.message : String(err)),
				'error'
			);
		}
	}

	function showBulkLeaveForm() {
		showBulkLeaveModal = true;
	}

	function hideBulkLeaveForm() {
		showBulkLeaveModal = false;
	}

	// Add this near your other state variables
	let showOnlyLeave = false;

	// Add these constants for shift durations (in hours)
	const SHIFT_DURATIONS = {
		morning: 8.5, // 8:00 - 16:30 with paid break
		afternoon: 8.5, // Assuming same duration for afternoon shift
		night: 8.5 // Assuming same duration for night shift
	};

	// Function to calculate total working hours for a day
	function calculateDayWorkingHours(employees: any[]): number {
		// Only count employees who are not on leave
		return employees
			.filter((emp) => !emp.onLeave)
			.reduce((total, emp) => {
				return total + (SHIFT_DURATIONS[emp.shift as keyof typeof SHIFT_DURATIONS] || 8.5);
			}, 0);
	}

	// Add this function to save scheduled hours to the database
	// Updated saveScheduledHours with validation and better logging
	async function saveScheduledHours(date: Date, hours: number) {
		try {
			// Validate the date is valid
			if (!(date instanceof Date) || isNaN(date.getTime())) {
				console.error('Invalid date provided to saveScheduledHours:', date);
				return;
			}

			const dateStr = getLocalISODate(date);
			const formattedDate = new Date(date).toLocaleDateString('en-US', {
				weekday: 'short',
				month: 'short',
				day: 'numeric'
			});

			console.log(`Saving ${hours} hours for ${formattedDate} (${dateStr})`);

			// Update the scheduled_hours table
			const { data: savedData, error: hoursError } = await supabase
				.from('scheduled_hours')
				.upsert(
					{
						date: dateStr,
						hours: hours,
						updated_at: new Date()
					},
					{
						onConflict: 'date'
					}
				)
				.select();

			if (hoursError) {
				console.error(`Error saving to scheduled_hours for ${formattedDate}:`, hoursError);
				throw hoursError;
			}

			console.log(`Successfully saved to scheduled_hours: ${JSON.stringify(savedData)}`);

			// Also update daily_metrics for backward compatibility
			const { error: metricsError } = await supabase.from('daily_metrics').upsert(
				{
					date: dateStr,
					scheduled_hours: hours
				},
				{
					onConflict: 'date'
				}
			);

			if (metricsError) {
				console.error(`Error saving to daily_metrics for ${formattedDate}:`, metricsError);
			} else {
				console.log(`Successfully saved to daily_metrics for ${formattedDate}`);
			}
		} catch (err) {
			console.error(`Error in saveScheduledHours for ${date.toLocaleDateString()}:`, err);
		}
	}

	// Add a new schedule
	async function addScheduleItem() {
		if (!newScheduleItem.employeeId || !newScheduleItem.date || !newScheduleItem.shift) {
			showToast('Please fill out all required fields', 'error');
			return;
		}

		try {
			const { data, error: insertError } = await supabase
				.from('schedules')
				.insert({
					employee_id: newScheduleItem.employeeId,
					date: newScheduleItem.date,
					shift: newScheduleItem.shift
				})
				.select();

			if (insertError) throw insertError;

			// Refresh data
			await fetchData();
			const employee = employees.find((emp) => emp.id === newScheduleItem.employeeId);
			// Calculate the new hours after schedule change
			const hours = await updateScheduledHoursForDate(new Date(newScheduleItem.date));
			console.log(`Updated hours for ${newScheduleItem.date} to ${hours}`);

			// Show success message
			showToast(
				`Scheduled ${employee?.name || 'Employee'} for ${new Date(newScheduleItem.date).toLocaleDateString()}`,
				'success'
			);
			hideAddScheduleForm();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to add schedule';
			console.error(error);
			showToast('Failed to add schedule: ' + error, 'error');
		}
	}

	// Update the handleViewAllEmployees function with proper type
	function handleViewAllEmployees(day: CalendarDay) {
		// You could implement a modal that shows all employees for the selected day
		console.log('View all employees for', day.date.toDateString());

		// For now, let's just use the existing handler to add a schedule on this day
		showAddScheduleForm(day.date);
	}

	// Add this function for debugging
	async function checkScheduledHours() {
		try {
			showToast('Checking database records...', 'info');

			// Get current month dates
			const firstDay = new Date(currentYear, currentMonth, 1);
			const lastDay = new Date(currentYear, currentMonth + 1, 0);

			const startDateStr = formatApiDate(firstDay);
			const endDateStr = formatApiDate(lastDay);

			// Get data from both tables
			const [hoursResult, metricsResult] = await Promise.all([
				supabase
					.from('scheduled_hours')
					.select('date, hours, updated_at')
					.gte('date', startDateStr)
					.lte('date', endDateStr)
					.order('date'),

				supabase
					.from('daily_metrics')
					.select('date, scheduled_hours')
					.gte('date', startDateStr)
					.lte('date', endDateStr)
					.order('date')
			]);

			// Format for comparison
			const hoursData = (hoursResult.data || []).reduce(
				(acc, item) => {
					acc[item.date] = item.hours;
					return acc;
				},
				{} as Record<string, number>
			);

			const metricsData = (metricsResult.data || []).reduce(
				(acc, item) => {
					acc[item.date] = item.scheduled_hours;
					return acc;
				},
				{} as Record<string, number>
			);

			// Compare the data
			const allDates = new Set([...Object.keys(hoursData), ...Object.keys(metricsData)]);
			const discrepancies = [];

			for (const dateStr of allDates) {
				const date = new Date(dateStr);
				const dayOfWeek = date.getDay();
				const dayName = [
					'Sunday',
					'Monday',
					'Tuesday',
					'Wednesday',
					'Thursday',
					'Friday',
					'Saturday'
				][dayOfWeek];

				if (hoursData[dateStr] !== metricsData[dateStr]) {
					discrepancies.push({
						date: dateStr,
						dayOfWeek: dayName,
						scheduledHours: hoursData[dateStr],
						metricsHours: metricsData[dateStr]
					});
				}
			}

			console.log('Data comparison:');
			console.table(discrepancies);

			if (discrepancies.length > 0) {
				showToast(`Found ${discrepancies.length} discrepancies. Check console.`, 'warning');
			} else {
				showToast('All data matches between tables!', 'success');
			}
		} catch (err) {
			console.error('Error checking hours data:', err);
			showToast('Error checking data', 'error');
		}
	}
</script>

{#if session === undefined || loading}
	<div class="loading">
		<svg class="spinner" viewBox="0 0 50 50">
			<circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
		</svg>
		<p>Loading...</p>
	</div>
{:else if session === null}
	<!-- When session is null, onMount should have redirected already -->
	<div>Redirecting to login...</div>
{:else if error}
	<div class="error">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<circle cx="12" cy="12" r="10"></circle>
			<line x1="12" y1="8" x2="12.01" y2="12"></line>
			<line x1="12" y1="16" x2="12.01" y2="16"></line>
		</svg>
		<p>Error loading schedule: {error}</p>
		<button on:click={fetchData}>Retry</button>
	</div>
{:else}
	<!-- Your existing calendar container with schedule content -->
	<div class="calendar-container">
		<div class="dashboard-header">
			<h1>Work Schedule</h1>

			<div class="month-navigation">
				<button on:click={() => changeMonth(-1)}>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polyline points="15 18 9 12 15 6"></polyline>
					</svg>
					Previous
				</button>
				<span class="current-month">
					{formatMonth(new Date(currentYear, currentMonth, 1))}
				</span>
				<button on:click={() => changeMonth(1)}>
					Next
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polyline points="9 18 15 12 9 6"></polyline>
					</svg>
				</button>
			</div>

			<div class="view-filter">
				<button
					class="toggle-button {showOnlyLeave ? 'active' : ''}"
					on:click={() => (showOnlyLeave = !showOnlyLeave)}
					aria-pressed={showOnlyLeave}
				>
					<span class="toggle-icon">
						{#if showOnlyLeave}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<polyline points="9 11 12 14 22 4"></polyline>
								<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
							</svg>
						{:else}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
								<path d="M8 9v2"></path>
								<path d="M8 15v2"></path>
								<path d="M12 9v2"></path>
								<path d="M12 15v2"></path>
								<path d="M16 9v2"></path>
								<path d="M16 15v2"></path>
							</svg>
						{/if}
					</span>
					<span>{showOnlyLeave ? 'Show All Employees' : 'Show Only Leave'}</span>
				</button>
			</div>

			<div class="header-buttons">
				<button class="add-button" on:click={() => showAddEmployeeModal()}>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
						<circle cx="12" cy="7" r="4"></circle>
					</svg>
					Add Employee
				</button>

				<button class="add-button" on:click={() => showAddScheduleForm()}>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="12" y1="5" x2="12" y2="19"></line>
						<line x1="5" y1="12" x2="19" y2="12"></line>
					</svg>
					Add Schedule
				</button>

				<button class="add-button" on:click={showBulkLeaveForm}>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
						<line x1="16" y1="2" x2="16" y2="6"></line>
						<line x1="8" y1="2" x2="8" y2="6"></line>
						<line x1="3" y1="10" x2="21" y2="10"></line>
						<path d="M8 14h.01"></path>
						<path d="M12 14h.01"></path>
						<path d="M16 14h.01"></path>
						<path d="M8 18h.01"></path>
						<path d="M12 18h.01"></path>
						<path d="M16 18h.01"></path>
					</svg>
					Bulk Leave
				</button>
			</div>
		</div>
		<div class="header-buttons">
			<!-- Add this new update button -->
			<button class="add-button update-button" on:click={updateAllScheduledHours}>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M21 2v6h-6"></path>
					<path d="M3 12a9 9 0 0 1-15-6.7L21 8"></path>
					<path d="M3 12a9 9 0 0 0 6 8.5l2-4.5"></path>
					<path d="M12 16l-2 4.5"></path>
					<path d="M16 20a9 9 0 0 0 5-7.5"></path>
				</svg>
				Update Hours
			</button>

			<!-- Add this button next to your Update Hours button -->
			<button class="add-button debug-button" on:click={checkScheduledHours}>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="12" y1="16" x2="12.01" y2="16"></line>
					<line x1="12" y1="8" x2="12.01" y2="8"></line>
				</svg>
				Check Hours
			</button>
		</div>
		<div class="view-toggle">
			<button class={!showManager ? 'active' : ''} on:click={() => (showManager = false)}>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
					<line x1="16" y1="2" x2="16" y2="6"></line>
					<line x1="8" y1="2" x2="8" y2="6"></line>
					<line x1="3" y1="10" x2="21" y2="10"></line>
				</svg>
				Calendar View
			</button>
			<button class={showManager ? 'active' : ''} on:click={() => (showManager = true)}>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="8" y1="6" x2="21" y2="6"></line>
					<line x1="8" y1="12" x2="21" y2="12"></line>
					<line x1="8" y1="18" x2="21" y2="18"></line>
					<line x1="3" y1="6" x2="3.01" y2="6"></line>
					<line x1="3" y1="12" x2="3.01" y2="12"></line>
					<line x1="3" y1="18" x2="3.01" y2="18"></line>
				</svg>
				Manage Schedule Patterns
			</button>
		</div>
		<!-- Add this right after the view-toggle div -->
		<div class="calendar-legend">
			<div class="legend-item">
				<span class="legend-icon">✅</span>
				<span class="legend-label">Available</span>
			</div>
			<div class="legend-item">
				<span class="legend-icon">🌴</span>
				<span class="legend-label">Holiday/Leave</span>
			</div>
			<div class="legend-item">
				<span class="legend-icon">🤒</span>
				<span class="legend-label">Sick</span>
			</div>
			<div class="legend-item">
				<span class="legend-icon">👤</span>
				<span class="legend-label">Click on employee for details</span>
			</div>
		</div>

		{#if loading}
			<div class="loading">
				<svg class="spinner" viewBox="0 0 50 50">
					<circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
				</svg>
				<p>Loading schedule...</p>
			</div>
		{:else if error}
			<div class="error">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="12" y1="8" x2="12.01" y2="8"></line>
					<line x1="12" y1="16" x2="12.01" y2="16"></line>
				</svg>
				<p>Error loading schedule: {error}</p>
				<button on:click={fetchData}>Retry</button>
			</div>
		{:else if showManager}
			<!-- Show the Schedule Manager component -->
			<ScheduleManager {employees} onScheduleUpdate={handleScheduleUpdate} />
		{:else if employees.length === 0}
			<div class="card empty-state">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="48"
					height="48"
					viewBox="0 0 24 24"
					fill="none"
					stroke="#9ca3af"
					stroke-width="1"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
					<circle cx="9" cy="7" r="4"></circle>
					<path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
					<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
				</svg>
				<h3>No Employees Yet</h3>
				<p>Add employees to start creating schedules.</p>
				<button class="add-button" on:click={showAddEmployeeModal}>Add Employee</button>
			</div>
		{:else}
			<!-- Show your existing calendar -->
			<div class="card">
				<div class="calendar {showOnlyLeave ? 'leave-only-mode' : ''}">
					<div class="calendar-header">
						{#each daysOfWeek as day}
							<div class="weekday-header">{day}</div>
						{/each}
					</div>

					<!-- Updated calendar grid with virtual scrolling optimization -->
					<div class="calendar-grid" bind:this={calendarViewport}>
						{#if calendarView === 'day' && selectedDate}
							<!-- Day view -->
							<div class="day-view">
								<h2 class="day-title">
									{selectedDate.toLocaleDateString('en-US', {
										weekday: 'long',
										month: 'long',
										day: 'numeric'
									})}
								</h2>
								<div class="day-schedule">
									{#if selectedDate}
										{@const selectedDayData = calendarDays.find(
											(day) => day.date.toDateString() === selectedDate?.toDateString()
										)}
										{#if selectedDayData}
											<!-- Day employees -->
											<div class="employee-list-detailed">
												{#each selectedDayData.employees as employee}
													<div
														class="employee-card {employee.onLeave
															? 'employee-on-leave'
															: getRoleClass(employee.role)}"
													>
														<div class="employee-card-header">
															<span class="employee-name-full">{employee.name}</span>
															<span class="employee-status">
																{#if employee.onLeave}
																	<span class="status-emoji"
																		>{employee.leaveType === 'Sick' ? '🤒' : '🌴'}</span
																	>
																	{employee.leaveType}
																{:else}
																	<span class="status-emoji">✅</span> Available
																{/if}
															</span>
														</div>
														<div class="employee-card-details">
															<div class="employee-role">{employee.role}</div>
															<div class="employee-shift">{getShiftName(employee.shift)}</div>
														</div>
													</div>
												{/each}

												{#if selectedDayData.employees.length === 0}
													<p class="no-employees">No employees scheduled for this day.</p>
												{/if}
											</div>
										{:else}
											<p>No data available for this day.</p>
										{/if}
									{/if}
								</div>
							</div>
						{:else}
							<!-- Week/Month view -->
							{#each Array(6) as _, weekIndex}
								{@const weekHeader = weekHeaders[weekIndex] || { weekNum: 0, monthName: '' }}
								{@const isExpanded = expandedWeeks.includes(weekIndex)}
								{@const startDay = weekIndex * 7}
								{@const endDay = startDay + 6}
								{@const weekDays = calendarDays.slice(startDay, endDay + 1)}
								{@const hasLeave = weekDays.some((day) => day.employees.some((emp) => emp.onLeave))}
								{@const hasData = weekDays.some((day) => day.employees.length > 0)}
								{@const isCurrentWeek = weekDays.some(
									(day) => day.date.toDateString() === new Date().toDateString()
								)}

								<div class="calendar-week-wrapper">
									<!-- Week header -->
									<button
										class="week-header {isExpanded ? 'expanded' : ''} {hasLeave
											? 'has-leave'
											: ''} {hasData ? 'has-data' : ''} {isCurrentWeek ? 'current-week' : ''}"
										on:click={() => toggleWeek(weekIndex)}
									>
										<span class="week-num">Week {weekHeader.weekNum}</span>
										<span class="week-month">{weekHeader.monthName}</span>
										<span class="week-expand-icon">
											{#if isExpanded}
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="16"
													height="16"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
												>
													<polyline points="18 15 12 9 6 15"></polyline>
												</svg>
											{:else}
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="16"
													height="16"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
												>
													<polyline points="6 9 12 15 18 9"></polyline>
												</svg>
											{/if}
										</span>
									</button>

									<!-- Week content (only shown when expanded) -->
									{#if isExpanded}
										<div class="calendar-week" data-week-index={weekIndex}>
											{#each weekDays as day, dayIndex}
												{@const isToday = day.date.toDateString() === new Date().toDateString()}
												{@const isSunday = day.date.getDay() === 0}
												{@const isSaturday = day.date.getDay() === 6}
												{@const isWeekday = day.date.getDay() > 0 && day.date.getDay() < 6}

												<div
													class="calendar-day {day.isCurrentMonth
														? 'current-month'
														: 'other-month'} {isToday ? 'current-day' : ''} {isSunday
														? 'weekend sunday'
														: isSaturday
															? 'weekend saturday'
															: 'weekday'}"
													on:click={() => {
														if (calendarView === 'day') {
															selectedDate = day.date;
														} else {
															showAddScheduleForm(day.date);
														}
													}}
													on:keydown={(e) => {
														if (e.key === 'Enter' || e.key === ' ') {
															e.preventDefault();
															if (calendarView === 'day') {
																selectedDate = day.date;
															} else {
																showAddScheduleForm(day.date);
															}
														}
													}}
													role="button"
													tabindex="0"
												>
													<div class="day-header">
														<span class="day-date">{day.date.getDate()}</span>
														<span class="day-name"
															>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
																day.date.getDay()
															]}</span
														>
													</div>

													<div class="day-content">
														{#if day.employees.length === 0}
															<div class="no-schedule">
																<span class="status-emoji">✅</span> Available
															</div>
														{:else}
															{@const filteredEmployees = showOnlyLeave
																? day.employees.filter((emp) => emp.onLeave)
																: day.employees}
															{@const displayEmployees = filteredEmployees.slice(0, 6)}
															{@const remainingCount = filteredEmployees.length - 6}

															<div class="employee-list">
																{#each displayEmployees as employee (employee.id)}
																	<div
																		class="employee-tooltip-container"
																		on:mouseenter={showTooltip}
																		on:mouseleave={hideTooltip}
																		role="presentation"
																	>
																		<button
																			class="employee-row {employee.onLeave
																				? 'employee-on-leave'
																				: getRoleClass(employee.role)}"
																			on:click|stopPropagation={() =>
																				handleEmployeeClick(employee, day.date)}
																			data-role={employee.role}
																			data-shift={getShiftName(employee.shift)}
																		>
																			<span class="employee-name">
																				{employee.name}
																			</span>
																			<span class="employee-time">
																				{getShiftName(employee.shift)}
																			</span>
																			{#if employee.onLeave}
																				<span class="status-indicator">
																					{employee.leaveType === 'Sick' ? '🤒' : '🌴'}
																				</span>
																			{/if}
																		</button>
																		<!-- Tooltip will be positioned by JS -->
																		<div class="employee-tooltip">
																			<div class="tooltip-name">{employee.name}</div>
																			<div class="tooltip-role">{employee.role}</div>
																			<div class="tooltip-shift">
																				<div class="shift-name">{getShiftName(employee.shift)}</div>
																			</div>
																			{#if employee.onLeave}
																				<div class="tooltip-leave">{employee.leaveType}</div>
																			{/if}
																		</div>
																	</div>
																{/each}

																{#if remainingCount > 0}
																	<button
																		class="employee-more"
																		on:click|stopPropagation={() => handleViewAllEmployees(day)}
																		aria-label="View {remainingCount} more employees"
																		type="button"
																	>
																		+{remainingCount} more
																	</button>
																{/if}
															</div>
														{/if}
													</div>

													{#if !showOnlyLeave && day.employees.length > 0}
														{@const visibleEmployees = day.employees}
														{@const activeCount = visibleEmployees.filter(
															(emp) => !emp.onLeave
														).length}

														<div
															class="employee-count"
															class:has-leave={day.employees.some((emp) => emp.onLeave)}
														>
															{activeCount}
														</div>

														<!-- Always show hours badge when there are employees -->
														<div class="hours-badge">
															{(day.totalWorkingHours ?? 0).toFixed(1)}h
														</div>
													{:else if showOnlyLeave && day.employees.some((emp) => emp.onLeave)}
														<!-- Leave count badge in leave-only mode -->
														{@const leaveCount = day.employees.filter((emp) => emp.onLeave).length}
														<div class="employee-count leave-count">
															{leaveCount}
														</div>
													{/if}
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						{/if}
					</div>
				</div>
			</div>
		{/if}

		{#if showAddForm}
			<div class="modal-overlay" tabindex="-1">
				<div class="modal" role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title">
					<!-- Close button outside the modal content -->
					<button
						class="overlay-close-button sr-only"
						on:click={hideAddScheduleForm}
						aria-label="Close modal"
					>
						Close
					</button>

					<div class="modal-header">
						<h2 id="schedule-modal-title">Add Schedule</h2>
						<button class="close-button" on:click={hideAddScheduleForm} aria-label="Close modal">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<line x1="18" y1="6" x2="6" y2="18"></line>
								<line x1="6" y1="6" x2="18" y2="18"></line>
							</svg>
						</button>
					</div>
					<!-- Rest of your modal content stays the same -->
					<form on:submit|preventDefault={addScheduleItem}>
						<div class="form-group">
							<label for="employee">Employee</label>
							<select id="employee" bind:value={newScheduleItem.employeeId} required>
								<option value="">Select Employee</option>
								{#each employees as emp}
									<option value={emp.id}>{emp.name}</option>
								{/each}
							</select>
						</div>

						<div class="form-group">
							<label for="date">Date</label>
							<input id="date" type="date" bind:value={newScheduleItem.date} required />
						</div>

						<div class="form-group">
							<label for="shift">Shift</label>
							<select id="shift" bind:value={newScheduleItem.shift}>
								<option value="morning">Morning (8am-4pm)</option>
								<option value="afternoon">Afternoon (4pm-12am)</option>
								<option value="night">Night (12am-8am)</option>
							</select>
						</div>

						<div class="form-actions">
							<button type="button" class="cancel-button" on:click={hideAddScheduleForm}
								>Cancel</button
							>
							<button type="submit" class="save-button">Save Schedule</button>
						</div>
					</form>
				</div>

				<!-- Add an explicit overlay click handler -->
				<button
					class="modal-backdrop-button"
					on:click={hideAddScheduleForm}
					on:keydown={(e) => e.key === 'Escape' && hideAddScheduleForm()}
					aria-label="Close modal"
				></button>
			</div>
		{/if}

		{#if showEmployeeModal}
			<div class="modal-overlay" tabindex="-1">
				<div class="modal" role="dialog" aria-modal="true" aria-labelledby="employee-modal-title">
					<div class="modal-header">
						<h2 id="employee-modal-title">Add Employee</h2>
						<button class="close-button" on:click={hideEmployeeModal} aria-label="Close modal">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<line x1="18" y1="6" x2="6" y2="18"></line>
								<line x1="6" y1="6" x2="18" y2="18"></line>
							</svg>
						</button>
					</div>

					<!-- Rest of your modal content stays the same -->
					<form on:submit|preventDefault={addEmployee}>
						{#if employeeError}
							<div class="form-error">
								<p>{employeeError}</p>
							</div>
						{/if}

						<div class="form-group">
							<label for="employeeName">Employee Name</label>
							<input
								id="employeeName"
								type="text"
								bind:value={newEmployee.name}
								placeholder="John Smith"
								required
							/>
						</div>

						<div class="form-group">
							<label for="employeeRole">Role</label>
							<select id="employeeRole" bind:value={newEmployee.role} required>
								<option value="">Select Role</option>
								<option value="Manager">Manager</option>
								<option value="Supervisor">Supervisor</option>
								<option value="Team Lead">Team Lead</option>
								<option value="Associate">Associate</option>
								<option value="Trainee">Trainee</option>
							</select>
						</div>

						<div class="form-actions">
							<button type="button" class="cancel-button" on:click={hideEmployeeModal}
								>Cancel</button
							>
							<button type="submit" class="save-button">Add Employee</button>
						</div>
					</form>
				</div>

				<!-- Add explicit backdrop button for handling clicks outside the modal -->
				<button
					class="modal-backdrop-button"
					on:click={hideEmployeeModal}
					on:keydown={(e) => e.key === 'Escape' && hideEmployeeModal()}
					aria-label="Close modal"
				></button>
			</div>
		{/if}
	</div>
{/if}

{#if showLeaveModal && selectedEmployee && selectedDate}
	<div class="modal-overlay" tabindex="-1">
		<div class="modal-wrapper" role="dialog" aria-modal="true">
			<EmployeeLeaveModal
				employee={selectedEmployee}
				date={selectedDate}
				existingLeave={selectedLeave}
				on:close={handleLeaveModalClose}
				on:saved={handleLeaveSaved}
			/>
		</div>

		<!-- Add explicit backdrop button for handling clicks outside the modal -->
		<button
			class="modal-backdrop-button"
			on:click={handleLeaveModalClose}
			on:keydown={(e) => e.key === 'Escape' && handleLeaveModalClose()}
			aria-label="Close leave modal"
		></button>
	</div>
{/if}

{#if showBulkLeaveModal}
	<div class="modal-overlay" tabindex="-1">
		<div
			class="modal-wrapper"
			role="dialog"
			aria-modal="true"
			aria-labelledby="bulk-leave-modal-title"
		>
			<BulkLeaveModal {employees} on:close={hideBulkLeaveForm} on:saved={handleLeaveSaved} />
		</div>

		<!-- Add explicit backdrop button for handling clicks outside the modal -->
		<button
			class="modal-backdrop-button"
			on:click={hideBulkLeaveForm}
			on:keydown={(e) => e.key === 'Escape' && hideBulkLeaveForm()}
			aria-label="Close bulk leave modal"
		></button>
	</div>
{/if}

<!-- Toast notification -->
{#if $toastStore.show}
	<div class="toast-container">
		<div class="toast toast-{$toastStore.type}">
			<div class="toast-icon">
				{#if $toastStore.type === 'success'}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
						<polyline points="22 4 12 14.01 9 11.01"></polyline>
					</svg>
				{:else if $toastStore.type === 'error'}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="12" cy="12" r="10"></circle>
						<line x1="12" y1="8" x2="12.01" y2="8"></line>
						<line x1="12" y1="16" x2="12.01" y2="16"></line>
					</svg>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="12" cy="12" r="10"></circle>
						<line x1="12" y1="16" x2="12.01" y2="16"></line>
						<line x1="12" y1="8" x2="12.01" y2="8"></line>
					</svg>
				{/if}
			</div>
			<div class="toast-message">{$toastStore.message}</div>
		</div>
	</div>
{/if}
