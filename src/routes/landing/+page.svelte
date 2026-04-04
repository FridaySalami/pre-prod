<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { userSession } from '$lib/stores/sessionStore';
	import {
		format,
		addDays,
		startOfMonth,
		startOfWeek,
		endOfMonth,
		endOfWeek,
		eachDayOfInterval,
		startOfDay,
		endOfDay,
		addMonths,
		subMonths
	} from 'date-fns';
	import { supabase } from '$lib/supabase/supabaseClient';
	import {
		RefreshCw,
		Package,
		PoundSterling,
		Truck,
		Wind,
		AlertCircle,
		CloudRain
	} from 'lucide-svelte';
	import { getHoursByRoleForDate } from '$lib/services/employeeHoursService';
	import {
		Card,
		CardHeader,
		CardTitle,
		CardContent,
		Skeleton,
		Alert,
		AlertTitle,
		AlertDescription,
		Badge,
		Button
	} from '$lib/shadcn/components';
	import DocumentationLink from '$lib/components/DocumentationLink.svelte';
	import HolidayCalendarWidget from '$lib/components/HolidayCalendarWidget.svelte';

	let holidays: any[] = [];
	let pendingHolidays: any[] = [];
	let calendarDate = new Date();

	// Calendar reactive variables
	$: monthStart = startOfMonth(calendarDate);
	$: monthEnd = endOfMonth(calendarDate);
	$: startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
	$: endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
	$: calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

	function getConflicts(pendingHoliday: any) {
		if (!pendingHoliday || !holidays.length) return [];

		const pStart = startOfDay(new Date(pendingHoliday.from_date));
		const pEnd = endOfDay(new Date(pendingHoliday.to_date));

		return holidays.filter((h) => {
			// Skip self
			if (h.id === pendingHoliday.id) return false;
			// Skip same person (optional, but requested "anyone else")
			if (h.internal_employee_id === pendingHoliday.internal_employee_id) return false;

			// Only check Accepted or Requested
			const status = h.status?.toLowerCase() || '';
			// Check for 'accepted' or 'requested'
			if (!status.includes('accepted') && !status.includes('requested')) return false;

			const hStart = startOfDay(new Date(h.from_date));
			const hEnd = endOfDay(new Date(h.to_date));

			// Check overlap: start <= hEnd && end >= hStart
			return pStart <= hEnd && pEnd >= hStart;
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

	let unmappedOrdersCount = 0;

	// Fetch unmapped orders count from Supabase
	async function fetchUnmappedOrders() {
		try {
			const { count, error } = await supabase
				.from('unmapped_orders')
				.select('*', { count: 'exact', head: true });
			
			if (!error) {
				unmappedOrdersCount = count || 0;
			}
		} catch (e) {
			console.error('Error fetching unmapped orders:', e);
		}
	}

	// Fetch pending holidays for tracked employees
	async function fetchPendingHolidays() {
		try {
			const { data, error } = await supabase
				.from('holidays')
				.select(
					`
					*,
					employees!inner(id, name)
				`
				)
				.ilike('status', 'requested%')
				.not('internal_employee_id', 'is', null)
				.order('from_date', { ascending: true });

			if (error) {
				console.error('Error fetching pending holidays:', error);
				return;
			}

			pendingHolidays = data || [];
		} catch (error) {
			console.error('Error in fetchPendingHolidays:', error);
		}
	}

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
			await Promise.all([
				fetchUpcomingLeave(),
				fetchWeather(),
				fetchYesterdayMetrics(),
				fetchPendingHolidays(),
				fetchUnmappedOrders()
			]);

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
					class="flex items-center gap-6 bg-slate-50 px-5 py-3 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md"
				>
					<div class="flex items-center gap-3 pr-4 border-r border-slate-200">
						<img
							src={weatherData.current.condition.icon}
							alt={weatherData.current.condition.text}
							class="w-12 h-12 drop-shadow-sm"
						/>
						<div class="flex flex-col">
							<div class="text-2xl font-bold text-slate-800 tracking-tight leading-none">
								{Math.round(weatherData.current.temp_c)}°C
							</div>
							<div class="text-[11px] text-slate-500 font-medium uppercase tracking-wider mt-1">
								{weatherData.current.condition.text}
							</div>
						</div>
					</div>

					<div class="flex gap-4">
						<div class="flex flex-col items-center gap-1.5" title="Wind Speed">
							<div class="p-1.5 bg-slate-200/50 rounded-lg text-slate-600">
								<Wind class="w-4 h-4" />
							</div>
							<div class="text-xs font-bold text-slate-700">
								{Math.round(weatherData.current.wind_mph)}
								<span class="text-[10px] text-slate-400 font-normal ml-0.5">mph</span>
							</div>
						</div>

						<div class="flex flex-col items-center gap-1.5" title="Chance of Rain">
							<div class="p-1.5 bg-blue-100/50 rounded-lg text-blue-600">
								<CloudRain class="w-4 h-4" />
							</div>
							<div class="text-xs font-bold text-slate-700">
								{weatherData.forecast?.forecastday[0]?.day?.daily_chance_of_rain || 0}%
							</div>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Full Width Layout -->
		<div class="space-y-6">
			<!-- TOP ROW: Critical System Status Alerts -->
			{#if unmappedOrdersCount > 0}
				<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
					<div 
						class="col-span-1 rounded-lg border p-3 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 duration-500
						{unmappedOrdersCount > 20 ? 'bg-red-50 border-red-200 text-red-900' : 'bg-amber-50 border-amber-200 text-amber-900'}"
					>
						<div class="flex items-center gap-3">
							<div class="p-2 rounded-full {unmappedOrdersCount > 20 ? 'bg-red-100' : 'bg-amber-100'}">
								<AlertCircle class="w-5 h-5 {unmappedOrdersCount > 20 ? 'text-red-600' : 'text-amber-600'}" />
							</div>
							<div>
								<div class="text-[10px] font-bold uppercase tracking-widest opacity-70">Unmapped Orders</div>
								<div class="text-xl font-black leading-none">{unmappedOrdersCount}</div>
							</div>
						</div>
						<Button 
							size="sm" 
							variant="ghost" 
							class="h-8 px-3 font-bold text-[11px] {unmappedOrdersCount > 20 ? 'hover:bg-red-100' : 'hover:bg-amber-100'}"
							onclick={() => goto('/dashboard/amazon/unmapped')}
						>
							FIX NOW
						</Button>
					</div>
				</div>
			{/if}

			<div class="grid grid-cols-12 gap-8">
				<!-- Left Column: Holiday Calendar (Col 8) -->
				<div class="col-span-8 space-y-8">
					<HolidayCalendarWidget 
						{holidays} 
						{calendarDate} 
						{calendarDays} 
						onNextMonth={nextMonth} 
						onPrevMonth={previousMonth} 
						onGoToToday={goToToday} 
					/>
				</div>

				<!-- Right Column: Metrics and Pending (Col 4) -->
				<div class="col-span-4 space-y-6">
					<!-- Performance Metrics (Compact) -->
					<Card>
						<CardContent class="p-4">
							{#if isLoading.metrics}
								<div class="space-y-4">
									<Skeleton class="h-12 w-full" />
									<Skeleton class="h-12 w-full" />
									<Skeleton class="h-12 w-full" />
								</div>
							{:else}
								<div class="space-y-6 divide-y divide-slate-100">
									<!-- Fulfillment -->
									<div class="space-y-3">
										<div class="flex items-center justify-between">
											<div class="flex items-center gap-2">
												<div class="p-1 bg-blue-50 rounded">
													<Package class="w-3.5 h-3.5 text-blue-700" />
												</div>
												<span class="text-[10px] font-bold text-blue-800 uppercase tracking-tight">Fulfillment</span>
											</div>
											<Badge variant="secondary" class="text-[9px] px-1 py-0 h-4">{format(addDays(today, -1), 'do MMM')}</Badge>
										</div>
										<div class="grid grid-cols-3 gap-2">
											<div>
												<div class="text-[9px] text-slate-500 uppercase font-medium">Packed</div>
												<div class="text-base font-bold text-slate-900 leading-none">{metrics.shipmentsPacked}</div>
											</div>
											<div>
												<div class="text-[9px] text-slate-500 uppercase font-medium">Eff</div>
												<div class="text-base font-bold text-slate-900 leading-none">{metrics.laborEfficiency.toFixed(1)}</div>
											</div>
											<div>
												<div class="text-[9px] text-slate-500 uppercase font-medium">Util</div>
												<div class="text-base font-bold text-slate-900 leading-none">{metrics.laborUtilization.toFixed(0)}%</div>
											</div>
										</div>
									</div>

									<!-- Financials -->
									<div class="pt-4 space-y-3">
										<div class="flex items-center gap-2">
											<div class="p-1 bg-green-50 rounded">
												<PoundSterling class="w-3.5 h-3.5 text-green-700" />
											</div>
											<span class="text-[10px] font-bold text-green-800 uppercase tracking-tight">Financials</span>
										</div>
										<div class="grid grid-cols-3 gap-2">
											<div>
												<div class="text-[9px] text-slate-500 uppercase font-medium">Total</div>
												<div class="text-base font-bold text-slate-900 leading-none">£{(metrics.totalSales / 1000).toFixed(1)}k</div>
											</div>
											<div>
												<div class="text-[9px] text-slate-500 uppercase font-medium">Amz</div>
												<div class="text-base font-bold text-slate-900 leading-none">£{(metrics.amazonSales / 1000).toFixed(1)}k</div>
											</div>
											<div>
												<div class="text-[9px] text-slate-500 uppercase font-medium">Oth</div>
												<div class="text-base font-bold text-slate-900 leading-none">£{((metrics.ebaySales + metrics.shopifySales) / 1000).toFixed(1)}k</div>
											</div>
										</div>
									</div>

									<!-- Orders -->
									<div class="pt-4 space-y-3">
										<div class="flex items-center gap-2">
											<div class="p-1 bg-orange-50 rounded">
												<Truck class="w-3.5 h-3.5 text-orange-700" />
											</div>
											<span class="text-[10px] font-bold text-orange-800 uppercase tracking-tight">Orders</span>
										</div>
										<div class="grid grid-cols-3 gap-2">
											<div>
												<div class="text-[9px] text-slate-500 uppercase font-medium">Total</div>
												<div class="text-base font-bold text-slate-900 leading-none">{metrics.linnworksTotalOrders}</div>
											</div>
											<div>
												<div class="text-[9px] text-slate-500 uppercase font-medium">Amz</div>
												<div class="text-base font-bold text-slate-900 leading-none">{metrics.linnworksAmazonOrders}</div>
											</div>
											<div>
												<div class="text-[9px] text-slate-500 uppercase font-medium">Oth</div>
												<div class="text-base font-bold text-slate-900 leading-none">{metrics.linnworksEbayOrders + metrics.linnworksShopifyOrders}</div>
											</div>
										</div>
									</div>
								</div>
							{/if}
						</CardContent>
					</Card>

					<!-- Pending Holiday Approvals -->
					{#if pendingHolidays.length > 0}
						<Card>
							<CardHeader class="py-3 px-4 border-b">
								<CardTitle class="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-slate-700">
									<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-amber-500"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
									Pending Approvals
									<Badge variant="secondary" class="ml-auto bg-amber-100 text-amber-900 border-amber-200">{pendingHolidays.length}</Badge>
								</CardTitle>
							</CardHeader>
							<CardContent class="p-0">
								<div class="divide-y divide-slate-100">
									{#each pendingHolidays as holiday}
										{@const isHalfDay = parseFloat(holiday.duration) === 0.5}
										{@const fromDate = new Date(holiday.from_date)}
										{@const toDate = new Date(holiday.to_date)}
										{@const isSameDay = format(fromDate, 'yyyy-MM-dd') === format(toDate, 'yyyy-MM-dd')}
										{@const conflicts = getConflicts(holiday)}
										<div class="p-3 hover:bg-slate-50 transition-colors">
											<div class="flex items-center justify-between mb-1">
												<div class="flex items-center gap-2">
													<span class="font-bold text-slate-900">{holiday.employee_name}</span>
													{#if isHalfDay}
														<Badge variant="outline" class="text-[9px] h-4 py-0 px-1 uppercase font-bold text-slate-500">Half Day</Badge>
													{/if}
												</div>
												<div class="text-xs font-bold text-slate-500">
													{holiday.duration} {holiday.units}
												</div>
											</div>
											
											<div class="flex items-center gap-3 text-xs text-slate-500">
												<div class="flex items-center gap-1.5">
													{#if isSameDay}
														{format(fromDate, 'EEE, d MMM')}
													{:else}
														{format(fromDate, 'd MMM')} → {format(toDate, 'd MMM')}
													{/if}
												</div>
												
												{#if conflicts.length > 0}
													<div class="flex flex-col gap-1 w-full mt-2 bg-red-50 p-2 rounded border border-red-100">
														<div class="flex items-center gap-1 text-red-600 font-bold">
															<Wind class="w-3 h-3" />
															{conflicts.length} Conflict{conflicts.length > 1 ? 's' : ''}
														</div>
														{#each conflicts.slice(0, 2) as conflict}
															<div class="text-[10px] text-red-800 flex justify-between">
																<span>{conflict.employee_name || 'Staff Member'}</span>
																<span>({format(new Date(conflict.from_date), 'd/MM')} - {format(new Date(conflict.to_date), 'd/MM')})</span>
															</div>
														{/each}
														{#if conflicts.length > 2}
															<div class="text-[10px] text-red-500 italic">+{conflicts.length - 2} more...</div>
														{/if}
													</div>
												{:else}
													<div class="flex items-center gap-1 text-emerald-600 font-bold">
														<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
														Clear
													</div>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							</CardContent>
						</Card>
					{/if}
				</div>
			</div>
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
		padding: 1.5rem;
		max-width: 1600px;
		margin: 0 auto;
	}

	/* Responsive */
	@media (max-width: 640px) {
		.dashboard-container {
			padding: 1rem;
		}
	}
</style>
