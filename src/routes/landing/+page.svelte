<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { userSession } from '$lib/sessionStore';
	import {
		format,
		addDays,
		isWeekend,
		startOfMonth,
		startOfWeek,
		endOfMonth,
		endOfWeek,
		eachDayOfInterval,
		isSameMonth,
		isSameDay,
		isWithinInterval,
		startOfDay,
		endOfDay,
		addMonths,
		subMonths
	} from 'date-fns';
	import { supabase } from '$lib/supabaseClient';
	import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-svelte';
	import { getHoursByRoleForDate } from '$lib/employeeHoursService';
	import {
		Card,
		CardHeader,
		CardTitle,
		CardContent,
		Skeleton,
		Alert,
		AlertTitle,
		AlertDescription,
		Badge
	} from '$lib/shadcn/components';
	import DocumentationLink from '$lib/components/DocumentationLink.svelte';

	let holidays: any[] = [];
	let calendarDate = new Date();

	// Calendar reactive variables
	$: monthStart = startOfMonth(calendarDate);
	$: monthEnd = endOfMonth(calendarDate);
	$: startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
	$: endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
	$: calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

	function getHolidaysForDay(day: Date, holidays: any[]) {
		return holidays.filter((h) => {
			if (!h.from_date || !h.to_date) return false;
			const start = startOfDay(new Date(h.from_date));
			const end = endOfDay(new Date(h.to_date));
			const current = startOfDay(day);

			const inRange = isWithinInterval(current, { start, end });
			if (!inRange) return false;

			if (h.dates_to_exclude) {
				const dayStr = format(current, 'yyyy-MM-dd');
				if (h.dates_to_exclude.includes(dayStr)) return false;
			}
			return true;
		});
	}

	function previousMonth() {
		calendarDate = subMonths(calendarDate, 1);
	}
	function nextMonth() {
		calendarDate = addMonths(calendarDate, 1);
	}
	function goToToday() {
		calendarDate = new Date();
	}

	function getStatusStyles(status: string) {
		const s = status?.toLowerCase() || '';
		if (s === 'accepted') return 'bg-green-50 text-green-800 border-green-100';
		if (s.includes('rejected') || s.includes('declined'))
			return 'bg-red-50 text-red-800 border-red-100';
		if (s.includes('withdrawn') || s.includes('cancelled') || s.includes('removed'))
			return 'bg-gray-50 text-gray-600 border-gray-100 decoration-line-through';
		return 'bg-yellow-50 text-yellow-800 border-yellow-100';
	}

	// Add authentication check
	// Start with session as undefined (unknown)
	let session: any = undefined;
	const unsubscribe = userSession.subscribe((s) => {
		session = s;
	});

	interface Employee {
		id: string;
		name: string;
		shift: string;
		role?: string;
		onLeave?: boolean; // Add this field
	}

	interface LeaveEmployee {
		id: string;
		name: string;
		leaveType: string;
	}

	interface LeaveDay {
		date: Date;
		staff: LeaveEmployee[];
	}

	interface Metrics {
		// B2C Amazon Fulfillment (1.x series)
		shipmentsPacked: number;
		actualHoursWorked: number;
		laborEfficiency: number;
		laborUtilization: number;

		// B2C Amazon Financials (2.0 series)
		totalSales: number;
		amazonSales: number;
		ebaySales: number;
		shopifySales: number;

		// Orders (2.1 series)
		linnworksTotalOrders: number;
		linnworksAmazonOrders: number;
		linnworksEbayOrders: number;
		linnworksShopifyOrders: number;

		// Order Distribution Percentages (2.2 series)
		amazonOrdersPercent: number;
		ebayOrdersPercent: number;
		shopifyOrdersPercent: number;

		// Legacy fields for backward compatibility
		shipmentsPerHour: number;
		labourUtilisation: number;
	}

	interface LoadingState {
		staff: boolean;
		leave: boolean;
		weather: boolean;
		metrics: boolean;
	}

	interface WeatherData {
		location: {
			name: string;
			country: string;
		};
		current: {
			last_updated: string;
			temp_c: number;
			temp_f: number;
			feelslike_c: number;
			feelslike_f: number;
			condition: {
				text: string;
				icon: string;
				code: number;
			};
			wind_mph: number;
			wind_kph: number;
			wind_dir: string;
			humidity: number;
			pressure_mb: number;
			uv: number;
			vis_miles: number;
		};
		forecast: {
			forecastday: Array<{
				date: string;
				day: {
					maxtemp_c: number;
					mintemp_c: number;
					maxtemp_f: number;
					condition: {
						text: string;
						icon: string;
						code: number;
					};
					daily_chance_of_rain: number;
				};
				astro: {
					sunrise: string;
					sunset: string;
				};
				hour: Array<{
					time: string;
					temp_c: number;
					condition: {
						text: string;
						icon: string;
					};
				}>;
			}>;
		};
		alerts?: {
			alert: Array<{
				headline: string;
			}>;
		};
	}

	// State management with proper typing
	const today: Date = new Date();
	const tomorrow: Date = addDays(today, 1);
	let todayStaff: Employee[] = [];
	let tomorrowStaff: Employee[] = [];
	let upcomingLeave: LeaveDay[] = [];
	let weatherData: WeatherData | null = null;
	let weatherError: string | null = null;
	let metrics: Metrics = {
		// B2C Amazon Fulfillment (1.x series)
		shipmentsPacked: 0,
		actualHoursWorked: 0,
		laborEfficiency: 0,
		laborUtilization: 0,

		// B2C Amazon Financials (2.0 series)
		totalSales: 0,
		amazonSales: 0,
		ebaySales: 0,
		shopifySales: 0,

		// Orders (2.1 series)
		linnworksTotalOrders: 0,
		linnworksAmazonOrders: 0,
		linnworksEbayOrders: 0,
		linnworksShopifyOrders: 0,

		// Order Distribution Percentages (2.2 series)
		amazonOrdersPercent: 0,
		ebayOrdersPercent: 0,
		shopifyOrdersPercent: 0,

		// Legacy fields for backward compatibility
		shipmentsPerHour: 0,
		labourUtilisation: 0
	};
	let isLoading: LoadingState = {
		staff: true,
		leave: true,
		weather: true,
		metrics: true
	};

	// Add new variable for leave ranges
	let leaveRanges: Array<{
		startDate: Date;
		endDate: Date;
		isRange: boolean;
		staff: LeaveEmployee[];
	}> = [];

	// Define structure for weekly staffing
	let weeklyStaff: Array<{
		date: Date;
		dayOfWeek: string;
		staff: Employee[];
	}> = [];

	// Add next week's staffing
	let nextWeekStaff: Array<{
		date: Date;
		dayOfWeek: string;
		staff: Employee[];
	}> = [];

	// Add these to your script section
	let hasError = false;
	let errorMessage = '';
	let loadingStatus = '';
	let dataLoaded = false;
	let retryCount = 0;

	// Update the onMount function to properly sequence data loading
	onMount(async () => {
		// Create a timeout promise to ensure we don't wait forever
		const sessionTimeout = new Promise((resolve) => setTimeout(() => resolve(null), 5000));

		// Wait for session with a timeout
		let currentSession;
		try {
			// Use Promise.race to either get the session or timeout
			const unsubscribePromise = new Promise<any>((resolve) => {
				const unsub = userSession.subscribe((s) => {
					if (s !== undefined) {
						// Only resolve when session is decided (not undefined)
						currentSession = s;
						resolve(s);
						unsub();
					}
				});
			});

			await Promise.race([unsubscribePromise, sessionTimeout]);

			// Check if we have a valid session
			if (currentSession === null) {
				console.log('No session found, redirecting to login');
				goto('/login');
				return;
			}

			if (currentSession) {
				await loadAllData();
			}
		} catch (error) {
			console.error('Error during initialization:', error);
			// Show error state to user
			hasError = true;
			errorMessage = 'Failed to initialize. Please refresh the page.';
		}
	});

	// Create a separate function to load all data with retry logic
	async function loadAllData(retryCount = 0) {
		try {
			isLoading = {
				staff: true,
				leave: true,
				weather: true,
				metrics: true
			};

			// Show global loading state
			loadingStatus = 'Loading dashboard data...';

			// First request critical data in sequence to ensure dependencies are met
			await fetchWeeklyStaff();
			await fetchNextWeekStaff();

			// Fetch holidays for the calendar widget
			const { data: holidayData } = await supabase
				.from('holidays')
				.select('*')
				.not('internal_employee_id', 'is', null);
			if (holidayData) holidays = holidayData;

			// Then load other data in parallel
			await Promise.all([fetchUpcomingLeave(), fetchWeather(), fetchYesterdayMetrics()]);

			// Data loaded successfully
			dataLoaded = true;
		} catch (error) {
			console.error('Error loading data:', error);

			// Implement retry logic (max 3 retries)
			if (retryCount < 3) {
				loadingStatus = `Retrying... (${retryCount + 1}/3)`;
				await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s before retry
				return loadAllData(retryCount + 1);
			}

			// Show partial data with error notice
			hasError = true;
			errorMessage = "Some data couldn't be loaded. You can try refreshing the page.";
		} finally {
			// Clear loading status even if there was an error
			loadingStatus = '';
		}
	}

	onDestroy(() => {
		unsubscribe();
	});

	// Fix the staff filtering for leave - consolidate code

	// Enhanced pattern filtering that correctly handles day_of_week matching
	function isEmployeeScheduledForDay(pattern: any, dayOfWeek: number | null): boolean {
		if (dayOfWeek === null) return false;

		// Force numeric comparison and logging for debugging
		const patternDay = Number(pattern.day_of_week);
		const currentDay = Number(dayOfWeek);

		// Check if the day matches and the employee is marked as working
		const scheduled = patternDay === currentDay && pattern.is_working === true;

		console.log(
			`${pattern.employee_name || 'Employee'}: scheduled for day ${currentDay}? ${scheduled ? 'YES' : 'NO'} (day_of_week=${patternDay})`
		);

		return scheduled;
	}

	// Updated function to correctly fetch weekly staff from Supabase
	async function fetchWeeklyStaff(): Promise<void> {
		try {
			isLoading.staff = true;

			// Log the request
			console.log('Fetching weekly staff data...');

			// Get current week dates
			const weekDates = getWeekDays();
			console.log(
				'Fetching staff for dates:',
				weekDates.map((d) => format(d, 'yyyy-MM-dd'))
			);

			// Add timeouts to Supabase calls to prevent hanging
			const fetchTimeout = new Promise<{ data: null; error: Error }>((resolve) =>
				setTimeout(
					() =>
						resolve({
							data: null,
							error: new Error('Request timed out after 10s')
						}),
					10000
				)
			);

			// Query for specific date assignments with timeout
			const formattedDates = weekDates.map((date) => format(date, 'yyyy-MM-dd'));
			const schedulesPromise = supabase.from('schedules').select('*').in('date', formattedDates);

			// Use Promise.race to implement timeout
			const { data: schedulesData, error: schedulesError } = await Promise.race([
				schedulesPromise,
				fetchTimeout
			]);

			if (schedulesError) {
				console.error('Error fetching specific schedules:', schedulesError);
				throw schedulesError;
			}

			// Query for recurring patterns - removed active filter
			const { data: patternsData, error: patternsError } = await supabase
				.from('employee_schedules')
				.select('*');

			if (patternsError) {
				console.error('Error fetching schedule patterns:', patternsError);
				throw patternsError;
			}

			console.log('Specific schedules data:', schedulesData);
			console.log('Pattern data:', patternsData);

			// Fetch employee details
			const employeeIds = new Set<string>();

			// Add IDs from specific schedules
			if (schedulesData) {
				schedulesData.forEach((item) => {
					if (item.employee_id) employeeIds.add(item.employee_id);
				});
			}

			// Add IDs from pattern schedules
			if (patternsData) {
				patternsData.forEach((item) => {
					if (item.employee_id) employeeIds.add(item.employee_id);
				});
			}

			// Only proceed if we have employee IDs
			if (employeeIds.size === 0) {
				console.log('No employee IDs found in schedules');
				weeklyStaff = weekDates.map((date) => ({
					date,
					dayOfWeek: format(date, 'EEEE'),
					staff: []
				}));

				isLoading.staff = false;
				return;
			}

			const { data: employeeData, error: employeeError } = await supabase
				.from('employees')
				.select('*')
				.in('id', Array.from(employeeIds));

			if (employeeError) {
				console.error('Error fetching employees:', employeeError);
				throw employeeError;
			}

			// Corrected leave data query that finds any leave overlapping with the week
			const { data: leaveData, error: leaveError } = await supabase
				.from('leave_requests')
				.select('*')
				.lte('start_date', format(weekDates[5], 'yyyy-MM-dd')) // Leave starts before or on Saturday
				.gte('end_date', format(weekDates[0], 'yyyy-MM-dd')) // Leave ends after or on Monday
				.eq('status', 'approved');

			if (leaveError) {
				console.error('Error fetching leave data:', leaveError);
				throw leaveError;
			}

			console.log('Leave data for filtering:', leaveData);

			// Convert JavaScript day (0=Sunday, 1=Monday, ...) to your database format (0=Monday, 1=Tuesday, ...)
			function convertJsDayToDbDay(jsDay: number): number {
				// JavaScript: 0=Sunday, 1=Monday, ..., 6=Saturday
				// Database:   0=Monday, 1=Tuesday, ..., 6=Sunday
				return jsDay === 0 ? 6 : jsDay - 1;
			}

			// Process each day of the week
			weeklyStaff = weekDates.map((date) => {
				const formattedDate = format(date, 'yyyy-MM-dd');

				// Get JavaScript day (0=Sunday, 1=Monday, etc.)
				const jsDay = date.getDay();

				// Convert to database day format (0=Monday, 1=Tuesday, etc.)
				const dbDayOfWeek = convertJsDayToDbDay(jsDay);

				const dayName = format(date, 'EEEE');

				// Log both the JavaScript day and the DB day for debugging
				console.log(
					`Processing ${dayName}: JS day = ${jsDay}, DB day = ${dbDayOfWeek}, date = ${formattedDate}`
				);

				const specificSchedules =
					schedulesData?.filter((item) => item.date === formattedDate) || [];

				// Debug the day of week comparison
				console.log(`Filtering for day ${dayName} (db day=${dbDayOfWeek})`);

				// Get patterns for this day of week and where employee is working
				const dayPatterns =
					patternsData?.filter((pattern) => {
						// Compare pattern.day_of_week with the converted dbDayOfWeek
						const patternDay = Number(pattern.day_of_week);
						const scheduled = patternDay === dbDayOfWeek && pattern.is_working === true;

						if (pattern.employee_id && employeeData) {
							const emp = employeeData.find((e) => e.id === pattern.employee_id);
							console.log(
								`${emp?.name || 'Unknown'}: scheduled for db day ${dbDayOfWeek}? ${scheduled ? 'YES' : 'NO'} (day_of_week=${patternDay})`
							);
						}

						return scheduled;
					}) || [];

				console.log(
					`Day ${dayName} (db day=${dbDayOfWeek}): Found ${dayPatterns.length} pattern schedules`
				);

				// Combine schedules (specific overrides pattern)
				const scheduledEmployees = new Map();

				// Add pattern-based staff first (can be overridden)
				dayPatterns.forEach((pattern) => {
					scheduledEmployees.set(pattern.employee_id, {
						employee_id: pattern.employee_id,
						shift: pattern.shift || 'morning' // Default to morning if not specified
					});
				});

				// Override with specific assignments
				specificSchedules.forEach((schedule) => {
					scheduledEmployees.set(schedule.employee_id, {
						employee_id: schedule.employee_id,
						shift: schedule.shift
					});
				});

				// More reliable date comparison
				const isOnLeave = (employeeId: string, currentDate: Date) => {
					const formattedCurrentDate = format(currentDate, 'yyyy-MM-dd');

					return (
						leaveData?.some((leave) => {
							// Convert dates to yyyy-MM-dd format for comparison to avoid time issues
							const leaveStartFormatted = format(new Date(leave.start_date), 'yyyy-MM-dd');
							const leaveEndFormatted = format(new Date(leave.end_date), 'yyyy-MM-dd');

							const isOnLeaveThisDay =
								leave.employee_id === employeeId &&
								leaveStartFormatted <= formattedCurrentDate &&
								leaveEndFormatted >= formattedCurrentDate;

							if (isOnLeaveThisDay) {
								console.log(`Employee ${employeeId} is on leave on ${formattedCurrentDate}`);
							}

							return isOnLeaveThisDay;
						}) || false
					);
				};

				// Filter out employees on leave before mapping to full employee data
				let staffWithLeaveStatus: Employee[] = [];

				// Loop through each employee scheduled for this day
				Array.from(scheduledEmployees.entries()).forEach(([employeeId, schedule]) => {
					// Check if employee is on leave
					const onLeave = isOnLeave(employeeId, date);

					// Add all employees - mark if they're on leave
					const employee = employeeData?.find((emp) => emp.id === employeeId);
					staffWithLeaveStatus.push({
						id: employeeId,
						name: employee?.name || 'Unknown',
						shift: schedule.shift,
						role: employee?.role || undefined,
						onLeave: onLeave // Add this flag to track leave status
					});
				});

				// Use this as the final staff list
				const staffList = staffWithLeaveStatus;

				// Add this after your staff list is built
				console.log(
					`Day ${dayName} staff details:`,
					staffList.map((person) => ({
						name: person.name,
						role: person.role
					}))
				);

				return {
					date,
					dayOfWeek: dayName,
					staff: staffList
				};
			});

			// Add debug to ensure we're not mixing up the display order
			console.log(
				'Weekly staff before sorting:',
				weeklyStaff.map((day) => ({
					date: format(day.date, 'yyyy-MM-dd'),
					dayName: day.dayOfWeek,
					jsDay: day.date.getDay(),
					staffCount: day.staff.length
				}))
			);

			// Make sure weeklyStaff is properly sorted by date
			weeklyStaff = weeklyStaff.sort((a, b) => a.date.getTime() - b.date.getTime());

			// Remove Sunday if it exists
			weeklyStaff = weeklyStaff.filter((day) => format(day.date, 'EEEE') !== 'Sunday');

			console.log(
				'Final weekly staff schedule:',
				weeklyStaff.map((day) => ({
					date: format(day.date, 'yyyy-MM-dd'),
					dayName: day.dayOfWeek,
					staffCount: day.staff.length
				}))
			);
		} catch (error) {
			console.error('Error fetching weekly staff schedule:', error);
			// Re-throw the error to be handled by the main error handler
			throw error;
		} finally {
			isLoading.staff = false;
		}
	}
	// Helper function to get days of current week (Mon-Sat)
	// Improved getWeekDays function with more explicit day handling
	function getWeekDays(): Date[] {
		const today = new Date();
		const days = [];

		// Reset time to midnight to avoid any time-related issues
		today.setHours(0, 0, 0, 0);

		// Get current day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
		const currentDayOfWeek = today.getDay();

		// Calculate days to go back to reach Monday
		const daysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;

		// Create Monday date
		const monday = new Date(today);
		monday.setDate(today.getDate() - daysToMonday);

		// Create array of dates from Monday to Saturday (6 days)
		for (let i = 0; i < 6; i++) {
			const date = new Date(monday);
			date.setDate(monday.getDate() + i);
			days.push(date);

			// Add detailed logging
			console.log(
				`Week day ${i}: ${format(date, 'EEEE')} (${date.getDay()}) - ${format(date, 'yyyy-MM-dd')}`
			);
		}

		return days;
	}

	// Helper function to get days of next week (Mon-Sat)
	function getNextWeekDays(): Date[] {
		const today = new Date();
		const days = [];

		// Reset time to midnight to avoid any time-related issues
		today.setHours(0, 0, 0, 0);

		// Get current day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
		const currentDayOfWeek = today.getDay();

		// Calculate days to go back to reach Monday
		const daysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;

		// Create Monday date of current week
		const monday = new Date(today);
		monday.setDate(today.getDate() - daysToMonday);

		// Add 7 days to get next Monday
		const nextMonday = new Date(monday);
		nextMonday.setDate(monday.getDate() + 7);

		// Create array of dates from next Monday to next Saturday (6 days)
		for (let i = 0; i < 6; i++) {
			const date = new Date(nextMonday);
			date.setDate(nextMonday.getDate() + i);
			days.push(date);
		}

		return days;
	}

	// Fetch next week's staff schedule
	async function fetchNextWeekStaff(): Promise<void> {
		try {
			// Get next week dates
			const nextWeekDates = getNextWeekDays();

			// Add timeouts to Supabase calls to prevent hanging
			const fetchTimeout = new Promise<{ data: null; error: Error }>((resolve) =>
				setTimeout(
					() =>
						resolve({
							data: null,
							error: new Error('Request timed out after 10s')
						}),
					10000
				)
			);

			// Query for specific date assignments with timeout
			const formattedDates = nextWeekDates.map((date) => format(date, 'yyyy-MM-dd'));
			const schedulesPromise = supabase.from('schedules').select('*').in('date', formattedDates);

			// Use Promise.race to implement timeout
			const { data: schedulesData, error: schedulesError } = await Promise.race([
				schedulesPromise,
				fetchTimeout
			]);

			if (schedulesError) {
				console.error('Error fetching next week specific schedules:', schedulesError);
				throw schedulesError;
			}

			// Query for recurring patterns
			const { data: patternsData, error: patternsError } = await supabase
				.from('employee_schedules')
				.select('*');

			if (patternsError) {
				console.error('Error fetching next week schedule patterns:', patternsError);
				throw patternsError;
			}

			// Fetch employee details
			const employeeIds = new Set<string>();

			// Add IDs from specific schedules
			if (schedulesData) {
				schedulesData.forEach((item) => {
					if (item.employee_id) employeeIds.add(item.employee_id);
				});
			}

			// Add IDs from pattern schedules
			if (patternsData) {
				patternsData.forEach((item) => {
					if (item.employee_id) employeeIds.add(item.employee_id);
				});
			}

			// Only proceed if we have employee IDs
			if (employeeIds.size === 0) {
				nextWeekStaff = nextWeekDates.map((date) => ({
					date,
					dayOfWeek: format(date, 'EEEE'),
					staff: []
				}));
				return;
			}

			const { data: employeeData, error: employeeError } = await supabase
				.from('employees')
				.select('*')
				.in('id', Array.from(employeeIds));

			if (employeeError) {
				console.error('Error fetching employees for next week:', employeeError);
				throw employeeError;
			}

			// Get leave data for next week
			const { data: leaveData, error: leaveError } = await supabase
				.from('leave_requests')
				.select('*')
				.lte('start_date', format(nextWeekDates[5], 'yyyy-MM-dd'))
				.gte('end_date', format(nextWeekDates[0], 'yyyy-MM-dd'))
				.eq('status', 'approved');

			if (leaveError) {
				console.error('Error fetching next week leave data:', leaveError);
				throw leaveError;
			}

			// Convert JavaScript day to database day format
			function convertJsDayToDbDay(jsDay: number): number {
				return jsDay === 0 ? 6 : jsDay - 1;
			}

			// Process each day of next week
			nextWeekStaff = nextWeekDates.map((date) => {
				const formattedDate = format(date, 'yyyy-MM-dd');
				const jsDay = date.getDay();
				const dbDayOfWeek = convertJsDayToDbDay(jsDay);
				const dayName = format(date, 'EEEE');

				const specificSchedules =
					schedulesData?.filter((item) => item.date === formattedDate) || [];

				const dayPatterns =
					patternsData?.filter((pattern) => {
						const patternDay = Number(pattern.day_of_week);
						return patternDay === dbDayOfWeek && pattern.is_working === true;
					}) || [];

				// Combine schedules (specific overrides pattern)
				const scheduledEmployees = new Map();

				// Add pattern-based staff first
				dayPatterns.forEach((pattern) => {
					scheduledEmployees.set(pattern.employee_id, {
						employee_id: pattern.employee_id,
						shift: pattern.shift || 'morning'
					});
				});

				// Override with specific assignments
				specificSchedules.forEach((schedule) => {
					scheduledEmployees.set(schedule.employee_id, {
						employee_id: schedule.employee_id,
						shift: schedule.shift
					});
				});

				// Check for leave
				const isOnLeave = (employeeId: string, currentDate: Date) => {
					const formattedCurrentDate = format(currentDate, 'yyyy-MM-dd');
					return (
						leaveData?.some((leave) => {
							const leaveStartFormatted = format(new Date(leave.start_date), 'yyyy-MM-dd');
							const leaveEndFormatted = format(new Date(leave.end_date), 'yyyy-MM-dd');
							return (
								leave.employee_id === employeeId &&
								leaveStartFormatted <= formattedCurrentDate &&
								leaveEndFormatted >= formattedCurrentDate
							);
						}) || false
					);
				};

				// Build staff list with leave status
				let staffWithLeaveStatus: Employee[] = [];
				Array.from(scheduledEmployees.entries()).forEach(([employeeId, schedule]) => {
					const onLeave = isOnLeave(employeeId, date);
					const employee = employeeData?.find((emp) => emp.id === employeeId);
					staffWithLeaveStatus.push({
						id: employeeId,
						name: employee?.name || 'Unknown',
						shift: schedule.shift,
						role: employee?.role || undefined,
						onLeave: onLeave
					});
				});

				return {
					date,
					dayOfWeek: dayName,
					staff: staffWithLeaveStatus
				};
			});

			// Sort by date and remove Sunday if it exists
			nextWeekStaff = nextWeekStaff
				.sort((a, b) => a.date.getTime() - b.date.getTime())
				.filter((day) => format(day.date, 'EEEE') !== 'Sunday');
		} catch (error) {
			console.error('Error fetching next week staff schedule:', error);
			throw error;
		}
	}
	// Enhanced fetchUpcomingLeave function that properly preserves date ranges
	async function fetchUpcomingLeave(): Promise<void> {
		try {
			const todayFormatted = format(today, 'yyyy-MM-dd');

			// Fetch all leave entries starting from today
			const { data, error } = await supabase
				.from('leave_requests')
				.select('*, employee:employees(id, name)')
				.gte('start_date', todayFormatted)
				.order('start_date', { ascending: true });

			if (error) throw error;

			console.log('Raw leave data:', data);

			// Process each leave request directly into range groups
			const dateRangeGroups = new Map<
				string,
				{
					startDate: Date;
					endDate: Date;
					isRange: boolean;
					staff: LeaveEmployee[];
				}
			>();

			// Process each leave request
			(data as any[]).forEach((leave) => {
				// Skip if employee data is missing
				if (!leave.employee) return;

				const startDate = new Date(leave.start_date);
				const endDate = new Date(leave.end_date);

				// Check if this is a multi-day leave
				const isRange = format(startDate, 'yyyy-MM-dd') !== format(endDate, 'yyyy-MM-dd');

				// Create a key for this date range
				const rangeKey = `${leave.start_date}_${leave.end_date}`;

				if (!dateRangeGroups.has(rangeKey)) {
					dateRangeGroups.set(rangeKey, {
						startDate,
						endDate,
						isRange,
						staff: []
					});
				}

				// Add employee to this date range
				dateRangeGroups.get(rangeKey)!.staff.push({
					id: leave.employee.id,
					name: leave.employee.name,
					leaveType: leave.leave_type
				});
			});

			console.log('Processed leave groups:', Array.from(dateRangeGroups.values()));

			// Convert to array of leave groups sorted by start date
			upcomingLeave = [];

			// Sort the date ranges by start date and take first 8
			const sortedRanges = Array.from(dateRangeGroups.values())
				.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
				.slice(0, 8);

			// Create dummy structure to satisfy the LeaveDay[] type
			sortedRanges.forEach((range) => {
				upcomingLeave.push({
					date: range.startDate,
					staff: range.staff
				});
			});

			// Store the range data for display
			leaveRanges = sortedRanges;
		} catch (error) {
			console.error('Error fetching upcoming leave:', error);
		} finally {
			isLoading.leave = false;
		}
	}

	// Fetch weather data with forecast for today AND tomorrow
	async function fetchWeather(): Promise<void> {
		try {
			const apiKey = '29f822e1fd8345edb1354635253003';
			const location = 'BN18 0BF';

			// Updated to get 2 days of forecast data
			const response = await fetch(
				`https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${location}&days=2&aqi=no`
			);

			if (!response.ok) {
				throw new Error('Weather API request failed');
			}

			weatherData = (await response.json()) as WeatherData;
			console.log('Weather data:', weatherData);
		} catch (error) {
			console.error('Error fetching weather data:', error);
			weatherError = 'Unable to load weather data';
		} finally {
			isLoading.weather = false;
		}
	}

	// Fetch yesterday's metrics from daily_metric_review table
	async function fetchYesterdayMetrics(): Promise<void> {
		try {
			const yesterday = format(addDays(today, -1), 'yyyy-MM-dd');

			// Define metrics type based on daily_metric_review table structure
			interface MetricReviewData {
				// Sales metrics (2.0 series)
				total_sales: number;
				amazon_sales: number;
				ebay_sales: number;
				shopify_sales: number;

				// Orders metrics (2.1 series)
				linnworks_total_orders: number;
				linnworks_amazon_orders: number;
				linnworks_ebay_orders: number;
				linnworks_shopify_orders: number;

				// Percentage distribution (2.2 series)
				amazon_orders_percent: number;
				ebay_orders_percent: number;
				shopify_orders_percent: number;

				// Labor metrics (1.x series)
				actual_hours_worked: number;
				labor_efficiency: number;

				// Role-specific hours
				management_hours_used: number;
				packing_hours_used: number;
				picking_hours_used: number;
			}

			// Query the daily_metric_review table for comprehensive metrics
			const { data, error } = await supabase
				.from('daily_metric_review')
				.select('*')
				.eq('date', yesterday)
				.single();

			if (error) {
				console.error('Error fetching metrics from daily_metric_review:', error);
				// Fallback to daily_metrics for basic metrics if review data not available
				return fetchFallbackMetrics(yesterday);
			}

			if (data) {
				const typedData = data as MetricReviewData;

				// Use the role-specific hours directly from the daily_metric_review table
				const packingHoursValue = Number(typedData.packing_hours_used || 0);
				const pickingHoursValue = Number(typedData.picking_hours_used || 0);
				const associateHours = packingHoursValue + pickingHoursValue;

				// Calculate labor efficiency using only Packing + Picking hours
				const laborEfficiency =
					associateHours > 0
						? Math.round((typedData.linnworks_total_orders / associateHours) * 100) / 100
						: 0;

				// For display purposes, use the actual orders as shipments packed
				const shipmentsPacked = typedData.linnworks_total_orders || 0;

				// Calculate labor utilization (this would need to be added to upload if needed)
				const laborUtilization = 0; // Not available in review table yet

				metrics = {
					// B2C Amazon Fulfillment (1.x series)
					shipmentsPacked,
					actualHoursWorked: associateHours, // Use filtered hours instead of total hours
					laborEfficiency,
					laborUtilization,

					// B2C Amazon Financials (2.0 series)
					totalSales: typedData.total_sales || 0,
					amazonSales: typedData.amazon_sales || 0,
					ebaySales: typedData.ebay_sales || 0,
					shopifySales: typedData.shopify_sales || 0,

					// Orders (2.1 series)
					linnworksTotalOrders: typedData.linnworks_total_orders || 0,
					linnworksAmazonOrders: typedData.linnworks_amazon_orders || 0,
					linnworksEbayOrders: typedData.linnworks_ebay_orders || 0,
					linnworksShopifyOrders: typedData.linnworks_shopify_orders || 0,

					// Order Distribution Percentages (2.2 series)
					amazonOrdersPercent: typedData.amazon_orders_percent || 0,
					ebayOrdersPercent: typedData.ebay_orders_percent || 0,
					shopifyOrdersPercent: typedData.shopify_orders_percent || 0,

					// Legacy fields for backward compatibility
					shipmentsPerHour: laborEfficiency,
					labourUtilisation: laborUtilization
				};
			}
		} catch (error) {
			console.error('Error fetching metrics:', error);
			// Fallback to basic metrics
			await fetchFallbackMetrics(format(addDays(today, -1), 'yyyy-MM-dd'));
		} finally {
			isLoading.metrics = false;
		}
	}

	// Fallback function to get basic metrics from daily_metrics table
	async function fetchFallbackMetrics(yesterday: string): Promise<void> {
		try {
			console.log('Falling back to daily_metrics table for basic metrics');

			// Define basic metrics type
			interface BasicMetricData {
				shipments: number;
				hours_worked: number;
				scheduled_hours: number;
			}

			const { data, error } = await supabase
				.from('daily_metrics')
				.select('shipments, hours_worked, scheduled_hours')
				.eq('date', yesterday)
				.single();

			if (error) {
				console.error('Error fetching fallback metrics:', error);
				// Set default values if no data available
				metrics = {
					shipmentsPacked: 0,
					actualHoursWorked: 0,
					laborEfficiency: 0,
					laborUtilization: 0,
					totalSales: 0,
					amazonSales: 0,
					ebaySales: 0,
					shopifySales: 0,
					linnworksTotalOrders: 0,
					linnworksAmazonOrders: 0,
					linnworksEbayOrders: 0,
					linnworksShopifyOrders: 0,
					amazonOrdersPercent: 0,
					ebayOrdersPercent: 0,
					shopifyOrdersPercent: 0,
					shipmentsPerHour: 0,
					labourUtilisation: 0
				};
				return;
			}

			if (data) {
				const typedData = data as BasicMetricData;
				const laborEfficiency =
					typedData.hours_worked > 0
						? Math.round((typedData.shipments / typedData.hours_worked) * 100) / 100
						: 0;
				const laborUtilization =
					typedData.scheduled_hours > 0
						? Math.round((typedData.hours_worked / typedData.scheduled_hours) * 10000) / 100
						: 0;

				metrics = {
					// B2C Amazon Fulfillment (1.x series) - basic data available
					shipmentsPacked: typedData.shipments || 0,
					actualHoursWorked: typedData.hours_worked || 0,
					laborEfficiency,
					laborUtilization,

					// B2C Amazon Financials (2.0 series) - not available in basic table
					totalSales: 0,
					amazonSales: 0,
					ebaySales: 0,
					shopifySales: 0,

					// Orders (2.1 series) - not available in basic table
					linnworksTotalOrders: 0,
					linnworksAmazonOrders: 0,
					linnworksEbayOrders: 0,
					linnworksShopifyOrders: 0,

					// Order Distribution Percentages (2.2 series) - not available in basic table
					amazonOrdersPercent: 0,
					ebayOrdersPercent: 0,
					shopifyOrdersPercent: 0,

					// Legacy fields for backward compatibility
					shipmentsPerHour: laborEfficiency,
					labourUtilisation: laborUtilization
				};

				console.log('Loaded basic fallback metrics from daily_metrics:', metrics);
			}
		} catch (error) {
			console.error('Error in fallback metrics fetch:', error);
		}
	}

	// Format date for display with explicit return type
	function formatDate(date: Date): string {
		return format(date, 'EEEE, do MMMM');
	}

	// Helper function to sort staff by role/rank
	function sortStaffByRank(staff: Employee[]): Employee[] {
		// Define role priorities (higher number = higher rank)
		const rolePriorities: Record<string, number> = {
			Manager: 100,
			Supervisor: 90,
			'Team Lead': 80,
			Senior: 70,
			Associate: 50,
			Junior: 40,
			Intern: 30,
			Unknown: 0
		};

		// Helper function to determine priority of a role
		const getRolePriority = (role: string | undefined): number => {
			if (!role) return 0;

			// Check for partial matches
			for (const [key, value] of Object.entries(rolePriorities)) {
				if (role.toLowerCase().includes(key.toLowerCase())) {
					return value;
				}
			}

			return 20; // Default for roles not specifically listed
		};

		// Create a sorted copy of the staff array
		return [...staff].sort((a, b) => {
			const priorityA = getRolePriority(a.role);
			const priorityB = getRolePriority(b.role);

			// First sort by role priority (descending)
			if (priorityB !== priorityA) {
				return priorityB - priorityA;
			}

			// If same priority, sort alphabetically by name
			return a.name.localeCompare(b.name);
		});
	}

	// Helper function to group staff by role
	function groupStaffByRole(staff: Employee[]): Array<{ role: string; staff: Employee[] }> {
		// Define role priorities (higher number = higher rank)
		const rolePriorities: Record<string, number> = {
			Manager: 100,
			Supervisor: 90,
			'Team Lead': 80,
			Senior: 70,
			Associate: 50,
			Junior: 40,
			Intern: 30,
			Unknown: 0
		};

		// Helper function to determine priority of a role
		const getRolePriority = (role: string | undefined): { priority: number; roleGroup: string } => {
			if (!role) return { priority: 0, roleGroup: 'Staff' };

			// Check for partial matches
			for (const [key, value] of Object.entries(rolePriorities)) {
				if (role.toLowerCase().includes(key.toLowerCase())) {
					return { priority: value, roleGroup: key };
				}
			}

			return { priority: 20, roleGroup: 'Staff' };
		};

		// Create a map to group staff by role group
		const roleGroups = new Map<string, { priority: number; staff: Employee[] }>();

		// Group staff by their role
		for (const employee of staff) {
			const { priority, roleGroup } = getRolePriority(employee.role);

			if (!roleGroups.has(roleGroup)) {
				roleGroups.set(roleGroup, { priority, staff: [] });
			}

			roleGroups.get(roleGroup)?.staff.push(employee);
		}

		// Sort each group alphabetically
		for (const group of roleGroups.values()) {
			group.staff.sort((a, b) => a.name.localeCompare(b.name));
		}

		// Convert map to sorted array
		return Array.from(roleGroups.entries())
			.map(([role, { priority, staff }]) => ({ role, priority, staff }))
			.sort((a, b) => b.priority - a.priority)
			.map(({ role, staff }) => ({ role, staff }));
	}

	// Fixed groupLeaveByDateRange function to handle dates reliably
	function groupLeaveByDateRange(leaveData: LeaveDay[]): Array<{
		startDate: Date;
		endDate: Date;
		isRange: boolean;
		staff: LeaveEmployee[];
	}> {
		// Directly use the actual leave periods rather than trying to parse from text
		const employeeLeavePeriods = new Map<
			string,
			{
				id: string;
				name: string;
				startDate: Date;
				endDate: Date;
				leaveType: string;
			}
		>();

		// Process each leave day
		leaveData.forEach((leaveDay) => {
			// Get date as a string for lookup
			const dateKey = format(leaveDay.date, 'yyyy-MM-dd');

			// Process each person on leave
			leaveDay.staff.forEach((person) => {
				const employeeKey = `${person.id}-${dateKey}`;

				// Instead of trying to parse dates from text, initialize with known date
				if (!employeeLeavePeriods.has(employeeKey)) {
					// Extract clean name - remove any existing date patterns
					const cleanName = person.name.replace(/\s*\(until.*\)/, '');

					employeeLeavePeriods.set(employeeKey, {
						id: person.id,
						name: cleanName,
						startDate: new Date(leaveDay.date),
						endDate: new Date(leaveDay.date), // Start with single day period
						leaveType: person.leaveType
					});
				}
			});
		});

		// Consolidate consecutive days for the same employee
		const consolidatedLeave = new Map<
			string,
			{
				id: string;
				name: string;
				startDate: Date;
				endDate: Date;
				leaveType: string;
			}
		>();

		// Process each leave entry
		Array.from(employeeLeavePeriods.values()).forEach((period) => {
			const employeeKey = period.id;

			if (!consolidatedLeave.has(employeeKey)) {
				// First entry for this employee
				consolidatedLeave.set(employeeKey, { ...period });
			} else {
				// Update existing entry if needed
				const existing = consolidatedLeave.get(employeeKey)!;

				// Check if dates are within 1 day of each other (consecutive)
				const timeDiff = Math.abs(period.startDate.getTime() - existing.endDate.getTime());
				const dayDiff = timeDiff / (1000 * 3600 * 24);

				if (dayDiff <= 1) {
					// Extend period if this is a consecutive day
					if (period.startDate < existing.startDate) {
						existing.startDate = period.startDate;
					}
					if (period.endDate > existing.endDate) {
						existing.endDate = period.endDate;
					}
				}
				// Otherwise it's a separate period that we'll handle later
			}
		});

		// Group by date range
		const dateRangeGroups = new Map<
			string,
			{
				startDate: Date;
				endDate: Date;
				isRange: boolean;
				staff: LeaveEmployee[];
			}
		>();

		// Process each employee's consolidated leave period
		for (const period of consolidatedLeave.values()) {
			// Format dates safely
			const startStr = format(period.startDate, 'yyyy-MM-dd');
			const endStr = format(period.endDate, 'yyyy-MM-dd');
			const isRange = startStr !== endStr;

			const rangeKey = `${startStr}_${endStr}`;

			if (!dateRangeGroups.has(rangeKey)) {
				dateRangeGroups.set(rangeKey, {
					startDate: period.startDate,
					endDate: period.endDate,
					isRange,
					staff: []
				});
			}

			// Add employee to this date range group
			dateRangeGroups.get(rangeKey)!.staff.push({
				id: period.id,
				name: period.name,
				leaveType: period.leaveType
			});
		}

		// Convert to array, sort by start date
		return Array.from(dateRangeGroups.values()).sort(
			(a, b) => a.startDate.getTime() - b.startDate.getTime()
		);
	}
</script>

<svelte:head>
	<title>Dashboard | Parker's Foodservice</title>
</svelte:head>

<!-- Add authentication check wrapper around landing content -->
{#if session === undefined}
	<div class="loading-container">
		<div class="loading-spinner"></div>
		<p>Initializing dashboard...</p>
	</div>
{:else if session}
	<div class="dashboard-container">
		<!-- Show any global messages -->
		{#if loadingStatus}
			<Alert variant="info" class="mb-6">
				<AlertDescription class="flex items-center gap-2">
					<div class="loading-spinner-small"></div>
					{loadingStatus}
				</AlertDescription>
			</Alert>
		{/if}

		{#if hasError}
			<Alert variant="destructive" class="mb-6">
				<AlertTitle>Error</AlertTitle>
				<AlertDescription class="flex items-center justify-between">
					<span>{errorMessage}</span>
					<button
						onclick={() => window.location.reload()}
						class="text-sm underline hover:no-underline ml-4"
					>
						Refresh Page
					</button>
				</AlertDescription>
			</Alert>
		{/if}

		<div class="dashboard-header flex justify-between items-end mb-8 border-b pb-6">
			<div>
				<h1 class="text-3xl font-bold tracking-tight text-gray-900 mb-2">
					Welcome{session?.user?.user_metadata?.name ? ', ' + session.user.user_metadata.name : ''}
				</h1>
				<div class="text-gray-500 font-medium">Today is {format(today, 'EEEE, do MMMM yyyy')}</div>
			</div>

			<!-- Simplified Weather Content -->
			{#if weatherData && !isLoading.weather}
				<div
					class="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200"
				>
					<img
						src={weatherData.current.condition.icon}
						alt={weatherData.current.condition.text}
						class="w-10 h-10"
					/>
					<div class="text-xl font-bold text-slate-700">
						{Math.round(weatherData.current.temp_c)}°C
					</div>
				</div>
			{/if}
		</div>

		<!-- Full Width Layout -->
		<div class="space-y-8">
			<!-- Performance Metrics (Full Width - Compact) -->
			<Card>
				<CardContent class="p-6">
					{#if isLoading.metrics}
						<div class="space-y-4">
							<Skeleton class="h-4 w-full" />
							<Skeleton class="h-4 w-3/4" />
							<Skeleton class="h-4 w-1/2" />
						</div>
					{:else}
						<div
							class="grid grid-cols-1 lg:grid-cols-3 gap-8 divide-y lg:divide-y-0 lg:divide-x divide-slate-100"
						>
							<!-- B2C Amazon Fulfillment (1.x series) -->
							<div class="lg:pr-8">
								<div class="flex items-center justify-between mb-4">
									<h3 class="text-sm font-semibold text-blue-800 uppercase tracking-wide">
										Fulfillment
									</h3>
									<Badge variant="secondary" class="text-[10px] px-1.5 py-0 h-5">
										{format(addDays(today, -1), 'do MMM')}
									</Badge>
								</div>
								<div class="grid grid-cols-4 gap-4">
									<div>
										<div
											class="text-[11px] text-slate-500 mb-0.5 font-medium uppercase tracking-wider"
										>
											Packed
										</div>
										<div class="text-lg font-bold text-slate-900">
											{metrics.shipmentsPacked}
										</div>
									</div>

									<div>
										<div
											class="text-[11px] text-slate-500 mb-0.5 font-medium uppercase tracking-wider"
										>
											Hours
										</div>
										<div class="text-lg font-bold text-slate-900">
											{metrics.actualHoursWorked.toFixed(1)}<span
												class="text-xs font-normal text-slate-400 ml-0.5">h</span
											>
										</div>
									</div>

									<div>
										<div
											class="text-[11px] text-slate-500 mb-0.5 font-medium uppercase tracking-wider"
										>
											Efficiency
										</div>
										<div class="text-lg font-bold text-slate-900">
											{metrics.laborEfficiency.toFixed(1)}<span
												class="text-xs font-normal text-slate-400 ml-0.5">/hr</span
											>
										</div>
									</div>

									{#if metrics.laborUtilization > 0}
										<div>
											<div
												class="text-[11px] text-slate-500 mb-0.5 font-medium uppercase tracking-wider"
											>
												Util %
											</div>
											<div class="text-lg font-bold text-slate-900">
												{metrics.laborUtilization.toFixed(0)}<span
													class="text-xs font-normal text-slate-400 ml-0.5">%</span
												>
											</div>
										</div>
									{/if}
								</div>
							</div>

							<!-- B2C Amazon Financials (2.0 series) -->
							<div class="pt-6 lg:pt-0 lg:px-8">
								<h3 class="text-sm font-semibold text-green-800 mb-4 uppercase tracking-wide">
									Financials
								</h3>
								<div class="grid grid-cols-3 gap-4">
									<div>
										<div
											class="text-[11px] text-slate-500 mb-0.5 font-medium uppercase tracking-wider"
										>
											Total Sales
										</div>
										<div class="text-lg font-bold text-slate-900">
											£{metrics.totalSales.toLocaleString('en-GB', {
												minimumFractionDigits: 0,
												maximumFractionDigits: 0
											})}
										</div>
									</div>

									<div>
										<div
											class="text-[11px] text-slate-500 mb-0.5 font-medium uppercase tracking-wider"
										>
											Amazon
										</div>
										<div class="text-lg font-bold text-slate-900">
											£{metrics.amazonSales.toLocaleString('en-GB', {
												minimumFractionDigits: 0,
												maximumFractionDigits: 0
											})}
										</div>
									</div>

									<div>
										<div
											class="text-[11px] text-slate-500 mb-0.5 font-medium uppercase tracking-wider"
										>
											Other
										</div>
										<div class="text-lg font-bold text-slate-900">
											£{(metrics.ebaySales + metrics.shopifySales).toLocaleString('en-GB', {
												minimumFractionDigits: 0,
												maximumFractionDigits: 0
											})}
										</div>
									</div>
								</div>
							</div>

							<!-- Orders (2.1 series) -->
							<div class="pt-6 lg:pt-0 lg:pl-8">
								<h3 class="text-sm font-semibold text-orange-800 mb-4 uppercase tracking-wide">
									Orders
								</h3>
								<div class="grid grid-cols-4 gap-4">
									<div>
										<div
											class="text-[11px] text-slate-500 mb-0.5 font-medium uppercase tracking-wider"
										>
											Total
										</div>
										<div class="text-lg font-bold text-slate-900">
											{metrics.linnworksTotalOrders}
										</div>
									</div>

									<div>
										<div
											class="text-[11px] text-slate-500 mb-0.5 font-medium uppercase tracking-wider"
										>
											Amazon
										</div>
										<div class="text-lg font-bold text-slate-900">
											{metrics.linnworksAmazonOrders}
										</div>
									</div>

									<div>
										<div
											class="text-[11px] text-slate-500 mb-0.5 font-medium uppercase tracking-wider"
										>
											eBay
										</div>
										<div class="text-lg font-bold text-slate-900">
											{metrics.linnworksEbayOrders}
										</div>
									</div>

									<div>
										<div
											class="text-[11px] text-slate-500 mb-0.5 font-medium uppercase tracking-wider"
										>
											Shopify
										</div>
										<div class="text-lg font-bold text-slate-900">
											{metrics.linnworksShopifyOrders}
										</div>
									</div>
								</div>
							</div>
						</div>
					{/if}
				</CardContent>
			</Card>

			<!-- Holiday Calendar Widget (Full Width) -->
			<Card class="h-[800px]">
				<CardHeader class="py-3 px-4 border-b">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-6">
							<CardTitle>Holiday Calendar</CardTitle>
							<div class="hidden md:flex items-center gap-3">
								<div class="flex items-center gap-1.5 text-xs text-slate-600">
									<div class="w-2.5 h-2.5 rounded-[2px] bg-green-50 border border-green-200"></div>
									<span class="font-medium">Approved</span>
								</div>
								<div class="flex items-center gap-1.5 text-xs text-slate-600">
									<div
										class="w-2.5 h-2.5 rounded-[2px] bg-yellow-50 border border-yellow-200"
									></div>
									<span class="font-medium">Pending</span>
								</div>
								<div class="flex items-center gap-1.5 text-xs text-slate-600">
									<div class="w-2.5 h-2.5 rounded-[2px] bg-red-50 border border-red-200"></div>
									<span class="font-medium">Rejected</span>
								</div>
								<div class="flex items-center gap-1.5 text-xs text-slate-600">
									<div class="w-2.5 h-2.5 rounded-[2px] bg-gray-50 border border-gray-200"></div>
									<span class="font-medium">Cancelled</span>
								</div>
							</div>
						</div>
						<div class="flex items-center gap-1 bg-gray-50 rounded-md p-1 border">
							<button
								class="p-1 hover:bg-white rounded hover:shadow-sm transition-all"
								onclick={previousMonth}
							>
								<ChevronLeft class="w-4 h-4 text-gray-600" />
							</button>
							<button
								class="px-2 py-0.5 text-xs font-semibold min-w-[90px] text-center"
								onclick={goToToday}
							>
								{format(calendarDate, 'MMMM yyyy')}
							</button>
							<button
								class="p-1 hover:bg-white rounded hover:shadow-sm transition-all"
								onclick={nextMonth}
							>
								<ChevronRight class="w-4 h-4 text-gray-600" />
							</button>
						</div>
					</div>
				</CardHeader>
				<div class="flex flex-col h-[calc(800px-57px)]">
					<div class="grid grid-cols-7 border-b bg-gray-50/50">
						{#each ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as day}
							<div
								class="py-2 text-center text-sm font-semibold text-gray-500 uppercase tracking-wider"
							>
								{day}
							</div>
						{/each}
					</div>
					<div class="grid grid-cols-7 auto-rows-fr h-full bg-gray-100 gap-px">
						{#each calendarDays as day}
							{@const isCurrentMonth = isSameMonth(day, calendarDate)}
							{@const isToday = isSameDay(day, new Date())}
							{@const dayHolidays = getHolidaysForDay(day, holidays)}

							<div
								class="bg-white p-2 relative h-full flex flex-col {isCurrentMonth
									? ''
									: 'bg-gray-50/50 text-gray-300'}"
							>
								<div class="flex justify-between items-start mb-1">
									<span
										class="text-sm font-medium rounded-full w-7 h-7 flex items-center justify-center {isToday
											? 'bg-blue-600 text-white'
											: isCurrentMonth
												? 'text-gray-700'
												: 'text-gray-400'}"
									>
										{format(day, 'd')}
									</span>
								</div>
								<div class="flex-1 overflow-hidden flex flex-col gap-1">
									{#each dayHolidays.slice(0, 5) as holiday}
										{@const nameParts = holiday.employee_name.split(' ')}
										{@const isHalfDay = parseFloat(holiday.duration) === 0.5}
										{@const displayName =
											nameParts.length > 1
												? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}`
												: nameParts[0]}
										<div
											class="px-1.5 py-1 text-xs rounded border truncate leading-tight {getStatusStyles(
												holiday.status
											)}"
											title="{holiday.employee_name}{isHalfDay ? ' (Half Day)' : ''}"
										>
											{displayName}{isHalfDay ? ' (Half Day)' : ''}
										</div>
									{/each}
									{#if dayHolidays.length > 5}
										<div class="text-xs text-gray-400 pl-1 leading-none">
											+{dayHolidays.length - 5}
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			</Card>
		</div>
	</div>

	<!-- Documentation Link -->
	<DocumentationLink section="landing-page" position="bottom-right" size="medium" />
{:else}
	<!-- When session is null, onMount should have redirected already -->
	<div class="loading-container">
		<p>Redirecting to login...</p>
	</div>
{/if}

<style>
	:global(:root) {
		--primary: #1a7f4c;
		--primary-hover: #166a3f;
		--accent: #f59e0b;
		--neutral-50: #f9fafb;
		--neutral-100: #f3f4f6;
		--neutral-200: #e5e7eb;
		--neutral-800: #1f2937;
		--neutral-900: #111827;
		--font-sans:
			ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
			'Helvetica Neue', Arial, sans-serif;
	}

	/* Global Button Styles */
	button {
		font-family: var(--font-sans);
	}

	/* Loading Styles */
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		color: var(--neutral-900);
		font-family: var(--font-sans);
	}

	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(26, 127, 76, 0.1);
		border-radius: 50%;
		border-top-color: var(--primary);
		animation: spin 1s ease-in-out infinite;
		margin-bottom: 16px;
	}

	.loading-spinner-small {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(26, 127, 76, 0.1);
		border-radius: 50%;
		border-top-color: var(--primary);
		animation: spin 1s ease-in-out infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Dashboard Container */
	.dashboard-container {
		padding: 32px;
		max-width: 100%;
		margin: 0 auto;
		font-family: var(--font-sans);
		color: var(--neutral-900);
	}

	/* Header */
	.dashboard-header {
		margin-bottom: 32px;
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		border-bottom: 1px solid var(--neutral-200);
		padding-bottom: 20px;
	}

	.dashboard-header h1 {
		font-size: 1.875rem; /* 30px */
		font-weight: 600;
		color: var(--neutral-900);
		margin: 0;
		letter-spacing: -0.025em;
	}

	.date-display {
		color: #6b7280;
		font-size: 1rem;
		font-weight: 500;
	}

	/* Grid Layout */
	.dashboard-grid {
		display: grid;
		grid-template-columns: 1fr 380px;
		gap: 32px;
		align-items: start;
	}

	/* Leave List */
	.leave-list-container {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.leave-section {
		background: var(--neutral-50);
		border-radius: 8px;
		padding: 12px 16px;
	}

	.leave-date-header {
		font-weight: 600;
		color: var(--neutral-900);
		margin-bottom: 8px;
		font-size: 0.9375rem;
	}

	.leave-staff-list.simple {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.leave-staff-item.simple {
		font-size: 0.9375rem;
		padding: 2px 0;
		color: #4b5563;
	}

	/* Weather Widget */
	.weather-content {
		padding: 4px 0;
	}

	.weather-main {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24px;
	}

	.weather-icon-temp {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.weather-icon {
		width: 64px;
		height: 64px;
		filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));
	}

	.weather-temp {
		font-size: 2.5rem;
		font-weight: 600;
		color: var(--neutral-900);
		line-height: 1;
	}

	.weather-condition {
		color: #6b7280;
		font-size: 1rem;
		margin-top: 4px;
	}

	.weather-updated {
		font-size: 0.75rem;
		color: #9ca3af;
		text-align: right;
	}

	.weather-details {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
		background: var(--neutral-50);
		border-radius: 12px;
		padding: 16px;
		margin-bottom: 24px;
	}

	.detail-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #6b7280;
		margin-bottom: 4px;
	}

	.detail-value {
		font-size: 1rem;
		font-weight: 600;
		color: var(--neutral-900);
	}

	.high-low {
		font-size: 0.875rem;
		margin-top: 6px;
		font-weight: 500;
	}

	.high {
		color: #ef4444;
		margin-right: 8px;
	}
	.low {
		color: #3b82f6;
	}

	/* Tomorrow Forecast */
	.tomorrow-forecast {
		background: #fff;
		border: 1px solid var(--neutral-200);
		border-radius: 12px;
		padding: 16px;
	}

	.tomorrow-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--neutral-900);
	}

	.tomorrow-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.tomorrow-icon-temp {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.tomorrow-icon {
		width: 40px;
		height: 40px;
	}

	.tomorrow-condition {
		font-size: 0.9375rem;
		color: #4b5563;
	}

	.tomorrow-temps {
		text-align: right;
		font-size: 0.9375rem;
		font-weight: 500;
	}

	.tomorrow-high {
		color: #ef4444;
	}
	.tomorrow-low {
		color: #3b82f6;
	}

	.tomorrow-rain {
		color: #6b7280;
		font-size: 0.875rem;
		margin-top: 4px;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 4px;
	}

	/* Responsive */
	@media (max-width: 640px) {
		.dashboard-container {
			padding: 16px;
		}

		.dashboard-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 8px;
		}
	}
</style>
