<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { userSession } from '$lib/sessionStore';
	import { format, addDays, isWeekend } from 'date-fns';
	import { supabase } from '$lib/supabaseClient';
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
						on:click={() => window.location.reload()}
						class="text-sm underline hover:no-underline ml-4"
					>
						Refresh Page
					</button>
				</AlertDescription>
			</Alert>
		{/if}

		<div class="dashboard-header">
			<h1>
				Welcome{session?.user?.user_metadata?.name ? ', ' + session.user.user_metadata.name : ''}
			</h1>
			<div class="date-display">Today is {format(today, 'EEEE, do MMMM yyyy')}</div>
		</div>

		<!-- Main dashboard grid layout -->
		<div class="dashboard-grid">
			<!-- Left Column - Main column now contains only weekly staff & upcoming leave -->
			<div class="main-column">
				<!-- Combined Weekly Staff View -->
				<Card class="weekly-staff-card mb-6">
					<CardHeader>
						<CardTitle>Weekly Staffing</CardTitle>
					</CardHeader>
					<CardContent>
						{#if isLoading.staff}
							<div class="space-y-4">
								<Skeleton class="h-4 w-full" />
								<Skeleton class="h-4 w-3/4" />
								<Skeleton class="h-4 w-1/2" />
							</div>
						{:else}
							<!-- This Week's Staffing Section -->
							<div class="mb-8">
								<h3 class="text-lg font-medium mb-4">This Week's Staffing</h3>
								{#if weeklyStaff.length === 0}
									<p class="text-muted-foreground text-center py-8">No staff scheduled this week</p>
								{:else}
									<div class="weekly-staff-grid">
										{#each weeklyStaff as dayData, index}
											<div
												class="day-column"
												class:today={format(dayData.date, 'yyyy-MM-dd') ===
													format(today, 'yyyy-MM-dd')}
											>
												<div class="day-header">
													<div class="day-name">{dayData.dayOfWeek}</div>
													<div class="day-date">{format(dayData.date, 'do MMM')}</div>
													<div class="day-iso-date" style="font-size: 0.7rem; color: #999;">
														{format(dayData.date, 'yyyy-MM-dd')}
													</div>
												</div>

												{#if dayData.staff.length === 0}
													<div class="day-empty">No staff</div>
												{:else}
													<!-- Calculate active staff count (excluding those on leave) -->
													{@const activeStaffCount = dayData.staff.filter(
														(person) => !person.onLeave
													).length}

													<!-- Show active count with "staff" label -->
													<div class="staff-count">{activeStaffCount} staff</div>

													<ul class="staff-list compact">
														{#each groupStaffByRole(dayData.staff) as { role, staff }, i}
															{#if i > 0}
																<li class="role-separator"></li>
															{/if}
															{#each staff as person}
																<li class="staff-item compact" class:on-leave={person.onLeave}>
																	<span class="staff-name">
																		{#if person.onLeave}
																			<span class="leave-icon" aria-label="On leave">🌴</span>
																		{/if}
																		{person.name}
																	</span>
																</li>
															{/each}
														{/each}
													</ul>
												{/if}
											</div>
										{/each}
									</div>
								{/if}
							</div>

							<!-- Next Week's Staffing Section -->
							<div>
								<h3 class="text-lg font-medium mb-4">Next Week's Staffing</h3>
								{#if nextWeekStaff.length === 0}
									<p class="text-muted-foreground text-center py-8">No staff scheduled next week</p>
								{:else}
									<div class="weekly-staff-grid">
										{#each nextWeekStaff as dayData, index}
											<div class="day-column">
												<div class="day-header">
													<div class="day-name">{dayData.dayOfWeek}</div>
													<div class="day-date">{format(dayData.date, 'do MMM')}</div>
													<div class="day-iso-date" style="font-size: 0.7rem; color: #999;">
														{format(dayData.date, 'yyyy-MM-dd')}
													</div>
												</div>

												{#if dayData.staff.length === 0}
													<div class="day-empty">No staff</div>
												{:else}
													<!-- Calculate active staff count (excluding those on leave) -->
													{@const activeStaffCount = dayData.staff.filter(
														(person) => !person.onLeave
													).length}

													<!-- Show active count with "staff" label -->
													{#if activeStaffCount > 0}
														<div class="staff-count">{activeStaffCount} staff</div>
													{/if}

													<ul class="staff-list compact">
														{#each sortStaffByRank(dayData.staff) as person}
															<li class="staff-item compact" class:on-leave={person.onLeave}>
																<span class="staff-name">
																	{#if person.onLeave}
																		<span class="leave-icon">🏖️</span>
																	{/if}
																	{person.name}
																</span>
															</li>
														{/each}
													</ul>
												{/if}
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					</CardContent>
				</Card>

				<!-- Upcoming Leave - moved to left column under weekly staff -->
				<Card class="mb-6">
					<CardHeader>
						<CardTitle>Upcoming Leave</CardTitle>
					</CardHeader>
					<CardContent>
						{#if isLoading.leave}
							<div class="space-y-3">
								<Skeleton class="h-4 w-full" />
								<Skeleton class="h-4 w-2/3" />
								<Skeleton class="h-4 w-1/3" />
							</div>
						{:else if leaveRanges.length === 0}
							<p class="text-muted-foreground text-center py-8">No upcoming leave scheduled</p>
						{:else}
							<div class="leave-list-container">
								{#each leaveRanges as leaveGroup}
									<div class="leave-section">
										<div class="leave-date-header">
											{#if leaveGroup.isRange}
												{#if leaveGroup.startDate instanceof Date && !isNaN(leaveGroup.startDate.getTime()) && leaveGroup.endDate instanceof Date && !isNaN(leaveGroup.endDate.getTime())}
													{format(leaveGroup.startDate, 'EEEE, do MMMM')} - {format(
														leaveGroup.endDate,
														'EEEE, do MMMM'
													)}
												{:else}
													Invalid Date Range
												{/if}
											{:else if leaveGroup.startDate instanceof Date && !isNaN(leaveGroup.startDate.getTime())}
												{format(leaveGroup.startDate, 'EEEE, do MMMM')}
											{:else}
												Invalid Date
											{/if}
										</div>
										<ul class="leave-staff-list simple">
											{#each leaveGroup.staff as person}
												<li class="leave-staff-item simple">
													{person.name}
												</li>
											{/each}
										</ul>
									</div>
								{/each}
							</div>
						{/if}
					</CardContent>
				</Card>
			</div>

			<!-- Right Column - Now contains performance metrics on top & weather below -->
			<div class="sidebar-column">
				<!-- Performance Metrics - moved to top of right column -->
				<Card class="mb-6">
					<CardHeader>
						<CardTitle class="text-base font-medium text-slate-800 flex items-center gap-2">
							Performance Metrics
							<Badge variant="secondary" class="text-xs">
								{format(addDays(today, -1), 'do MMM')}
							</Badge>
						</CardTitle>
						<div class="text-xs font-medium text-slate-600 uppercase tracking-wide mt-2">
							Fulfillment Operations
						</div>
					</CardHeader>
					<CardContent>
						{#if isLoading.metrics}
							<div class="space-y-4">
								<Skeleton class="h-4 w-full" />
								<Skeleton class="h-4 w-3/4" />
								<Skeleton class="h-4 w-1/2" />
							</div>
						{:else}
							<div class="grid grid-cols-1 gap-4">
								<!-- B2C Amazon Fulfillment (1.x series) -->
								<div class="bg-blue-50 p-4 rounded-lg shadow-sm">
									<h3 class="text-sm font-medium text-blue-800 mb-2">Fulfillment Operations</h3>
									<div class="grid grid-cols-2 gap-2">
										<div class="text-xs text-blue-600">Shipments Packed</div>
										<div class="text-right font-medium text-blue-900">
											{metrics.shipmentsPacked}
										</div>

										<div class="text-xs text-blue-600">Hours Worked</div>
										<div class="text-right font-medium text-blue-900">
											{metrics.actualHoursWorked.toFixed(1)}h
										</div>

										<div class="text-xs text-blue-600">Labor Efficiency</div>
										<div class="text-right font-medium text-blue-900">
											{metrics.laborEfficiency.toFixed(1)}/hr
										</div>

										{#if metrics.laborUtilization > 0}
											<div class="text-xs text-blue-600">Labor Utilization</div>
											<div class="text-right font-medium text-blue-900">
												{metrics.laborUtilization.toFixed(1)}%
											</div>
										{/if}
									</div>
								</div>

								<!-- B2C Amazon Financials (2.0 series) -->
								<div class="bg-green-50 p-4 rounded-lg shadow-sm">
									<h3 class="text-sm font-medium text-green-800 mb-2">Financial Performance</h3>
									<div class="grid grid-cols-2 gap-2">
										<div class="text-xs text-green-600">Total Sales</div>
										<div class="text-right font-medium text-green-900">
											£{metrics.totalSales.toLocaleString('en-GB', {
												minimumFractionDigits: 2,
												maximumFractionDigits: 2
											})}
										</div>

										<div class="text-xs text-green-600">Amazon Sales</div>
										<div class="text-right font-medium text-green-900">
											£{metrics.amazonSales.toLocaleString('en-GB', {
												minimumFractionDigits: 2,
												maximumFractionDigits: 2
											})}
										</div>

										<div class="text-xs text-green-600">eBay Sales</div>
										<div class="text-right font-medium text-green-900">
											£{metrics.ebaySales.toLocaleString('en-GB', {
												minimumFractionDigits: 2,
												maximumFractionDigits: 2
											})}
										</div>

										<div class="text-xs text-green-600">Shopify Sales</div>
										<div class="text-right font-medium text-green-900">
											£{metrics.shopifySales.toLocaleString('en-GB', {
												minimumFractionDigits: 2,
												maximumFractionDigits: 2
											})}
										</div>
									</div>
								</div>

								<!-- Orders (2.1 series) -->
								<div class="bg-red-50 p-4 rounded-lg shadow-sm">
									<h3 class="text-sm font-medium text-red-800 mb-2">Order Volume</h3>
									<div class="grid grid-cols-2 gap-2">
										<div class="text-xs text-red-600">Total Orders</div>
										<div class="text-right font-medium text-red-900">
											{metrics.linnworksTotalOrders}
										</div>

										<div class="text-xs text-red-600">Amazon Orders</div>
										<div class="text-right font-medium text-red-900">
											{metrics.linnworksAmazonOrders}
											{#if metrics.amazonOrdersPercent > 0}
												<span class="text-sm font-medium text-slate-600 ml-2">
													({metrics.amazonOrdersPercent.toFixed(1)}%)
												</span>
											{/if}
										</div>

										<div class="text-xs text-red-600">eBay Orders</div>
										<div class="text-right font-medium text-red-900">
											{metrics.linnworksEbayOrders}
											{#if metrics.ebayOrdersPercent > 0}
												<span class="text-sm font-medium text-slate-600 ml-2">
													({metrics.ebayOrdersPercent.toFixed(1)}%)
												</span>
											{/if}
										</div>

										<div class="text-xs text-red-600">Shopify Orders</div>
										<div class="text-right font-medium text-red-900">
											{metrics.linnworksShopifyOrders}
											{#if metrics.shopifyOrdersPercent > 0}
												<span class="text-sm font-medium text-slate-600 ml-2">
													({metrics.shopifyOrdersPercent.toFixed(1)}%)
												</span>
											{/if}
										</div>
									</div>
								</div>
							</div>
						{/if}
					</CardContent>
				</Card>

				<!-- Weather Widget - moved below performance metrics -->
				<Card>
					<CardHeader class="pb-3">
						<div class="flex items-center justify-between">
							<CardTitle>Weather</CardTitle>
							<Badge variant="secondary">
								{weatherData?.location?.name || 'Southampton'}, UK
							</Badge>
						</div>
					</CardHeader>
					<CardContent>
						{#if isLoading.weather}
							<div class="space-y-4">
								<div class="flex items-center space-x-4">
									<Skeleton class="h-16 w-16 rounded-full" />
									<div class="space-y-2">
										<Skeleton class="h-6 w-20" />
										<Skeleton class="h-4 w-32" />
									</div>
								</div>
								<div class="grid grid-cols-2 gap-4">
									<Skeleton class="h-4 w-full" />
									<Skeleton class="h-4 w-full" />
								</div>
							</div>
						{:else if weatherError}
							<div class="text-destructive text-center py-4">{weatherError}</div>
						{:else if weatherData}
							<div class="weather-content">
								<!-- Today's Weather -->
								<div class="weather-main">
									<div class="weather-icon-temp">
										<img
											src={weatherData.current.condition.icon.replace('64x64', '128x128')}
											alt={weatherData.current.condition.text}
											class="weather-icon"
										/>
										<div>
											<div class="weather-temp">{weatherData.current.temp_c}°C</div>
											<div class="weather-condition">{weatherData.current.condition.text}</div>

											<!-- High/Low Temperature -->
											{#if weatherData.forecast?.forecastday?.[0]?.day}
												{@const maxTemp = Math.max(
													weatherData.current.temp_c,
													weatherData.forecast.forecastday[0].day.maxtemp_c
												)}
												<div class="high-low">
													<span class="high">H: {maxTemp.toFixed(0)}°</span>
													<span class="low"
														>L: {weatherData.forecast.forecastday[0].day.mintemp_c.toFixed(
															0
														)}°</span
													>
												</div>
											{/if}
										</div>
									</div>
									<div class="weather-updated">
										<span>Updated</span>
										{weatherData.current.last_updated.split(' ')[1]}
									</div>
								</div>

								<!-- Weather Details for Today -->
								<div class="weather-details">
									<div class="weather-detail-item">
										<div class="detail-label">Feels like</div>
										<div class="detail-value">{weatherData.current.feelslike_c}°C</div>
									</div>
									<div class="weather-detail-item">
										<div class="detail-label">Humidity</div>
										<div class="detail-value">{weatherData.current.humidity}%</div>
									</div>
									<div class="weather-detail-item">
										<div class="detail-label">Wind</div>
										<div class="detail-value">
											{weatherData.current.wind_mph} mph {weatherData.current.wind_dir}
										</div>
									</div>
									<div class="weather-detail-item">
										<div class="detail-label">Rain chance</div>
										<div class="detail-value">
											{weatherData.forecast?.forecastday?.[0]?.day?.daily_chance_of_rain || 0}%
										</div>
									</div>
								</div>

								<!-- Tomorrow's Forecast -->
								{#if weatherData.forecast?.forecastday?.[1]?.day}
									<div class="tomorrow-forecast">
										<div class="tomorrow-header">
											<span>Tomorrow</span>
											<span>{format(tomorrow, 'EEE, do')}</span>
										</div>
										<div class="tomorrow-content">
											<div class="tomorrow-icon-temp">
												<img
													src={weatherData.forecast.forecastday[1].day.condition.icon}
													alt={weatherData.forecast.forecastday[1].day.condition.text}
													class="tomorrow-icon"
												/>
												<div class="tomorrow-condition">
													{weatherData.forecast.forecastday[1].day.condition.text}
												</div>
											</div>
											<div class="tomorrow-temps">
												<div class="tomorrow-high">
													H: {weatherData.forecast.forecastday[1].day.maxtemp_c.toFixed(0)}°
												</div>
												<div class="tomorrow-low">
													L: {weatherData.forecast.forecastday[1].day.mintemp_c.toFixed(0)}°
												</div>
												<div class="tomorrow-rain">
													<span class="rain-icon">💧</span>
													{weatherData.forecast.forecastday[1].day.daily_chance_of_rain}%
												</div>
											</div>
										</div>
									</div>
								{/if}
							</div>
						{/if}
					</CardContent>
				</Card>
			</div>
		</div>
	</div>
{:else}
	<!-- When session is null, onMount should have redirected already -->
	<div class="loading-container">
		<p>Redirecting to login...</p>
	</div>
{/if}

<style>
	.loading-spinner-small {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(0, 122, 255, 0.1);
		border-radius: 50%;
		border-top-color: #007aff;
		animation: spin 1s ease-in-out infinite;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Add these new styles for loading state */
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		color: #1d1d1f;
	}

	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(0, 122, 255, 0.1);
		border-radius: 50%;
		border-top-color: #007aff;
		animation: spin 1s ease-in-out infinite;
		margin-bottom: 16px;
	}

	/* Your existing styles... */
	/* Global Dashboard Styles */
	.dashboard-container {
		padding: 24px;
		max-width: 1400px;
		margin: 0 auto;
	}

	.dashboard-header {
		margin-bottom: 24px;
	}

	.staff-count {
		background: #f5f5f7;
		border-radius: 12px;
		font-size: 0.7rem;
		color: #86868b;
		padding: 2px 8px;
		display: inline-block;
		margin: 0 0 8px 0;
		align-self: flex-start;
	}

	.dashboard-header h1 {
		font-size: 1.75rem;
		font-weight: 500;
		color: #1d1d1f;
		margin: 0;
		padding: 0;
	}

	.date-display {
		color: #86868b;
		margin-top: 4px;
		font-size: 0.95rem;
	}

	.dashboard-grid {
		display: grid;
		grid-template-columns: 1fr 340px;
		gap: 24px;
	}

	/* Staff List Styles */
	.staff-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.staff-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 0;
		border-bottom: 1px solid #f5f5f7;
	}

	.staff-item:last-child {
		border-bottom: none;
	}

	.staff-name {
		font-weight: 500;
		color: #1d1d1f;
	}

	.leave-staff-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.leave-staff-item {
		font-size: 0.9rem;
		padding: 4px 0;
		color: #1d1d1f;
	}

	.staff-item.on-leave .staff-name {
		color: #acacae;
	}

	.leave-icon {
		font-size: 0.8em;
		margin-right: 4px;
	}

	/* Tomorrow's forecast styles */
	.tomorrow-forecast {
		margin-top: 20px;
		background: #f5f5f7;
		border-radius: 8px;
		padding: 12px;
	}

	.tomorrow-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
		font-size: 0.85rem;
		color: #1d1d1f;
		font-weight: 500;
	}

	.tomorrow-header span:last-child {
		color: #86868b;
		font-weight: normal;
	}

	.tomorrow-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.tomorrow-icon-temp {
		display: flex;
		align-items: center;
	}

	.tomorrow-icon {
		width: 36px;
		height: 36px;
		margin-right: 8px;
	}

	.tomorrow-condition {
		font-size: 0.85rem;
		color: #1d1d1f;
	}

	.tomorrow-temps {
		text-align: right;
		font-size: 0.85rem;
	}

	.tomorrow-high {
		color: #ff3b30;
		font-weight: 500;
	}

	.tomorrow-low {
		color: #007aff;
		margin: 4px 0;
	}

	.tomorrow-rain {
		color: #86868b;
		display: flex;
		align-items: center;
		justify-content: flex-end;
	}

	.rain-icon {
		margin-right: 4px;
		font-size: 0.8rem;
	}

	/* Weather Widget Styles */
	.weather-main {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 20px;
	}

	.weather-icon-temp {
		display: flex;
		align-items: center;
	}

	.weather-icon {
		width: 50px;
		height: 50px;
		margin-right: 12px;
	}

	.weather-temp {
		font-size: 1.8rem;
		font-weight: 500;
		color: #1d1d1f;
	}

	.weather-condition {
		color: #86868b;
		font-size: 0.9rem;
	}

	.weather-updated {
		font-size: 0.75rem;
		color: #86868b;
		text-align: right;
	}

	.weather-updated span {
		display: block;
		margin-bottom: 2px;
	}

	.weather-details {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px 16px;
		margin-top: 16px;
		background: #f5f5f7;
		border-radius: 8px;
		padding: 12px;
	}

	.weather-detail-item {
		display: flex;
		flex-direction: column;
	}

	.detail-label {
		font-size: 0.75rem;
		color: #86868b;
	}

	.detail-value {
		font-size: 0.9rem;
		font-weight: 500;
		color: #1d1d1f;
		margin-top: 2px;
	}

	/* Add to your existing styles */
	.high-low {
		font-size: 0.8rem;
		margin-top: 4px;
		color: #86868b;
	}

	.high {
		color: #ff3b30;
		margin-right: 8px;
	}

	.low {
		color: #007aff;
	}

	/* Animation */
	@keyframes pulse {
		0% {
			opacity: 0.6;
		}
		50% {
			opacity: 1;
		}
		100% {
			opacity: 0.6;
		}
	}

	/* Responsive Adjustments */
	@media (max-width: 900px) {
		.dashboard-grid {
			grid-template-columns: 1fr;
		}

		.main-column {
			order: 2;
		}

		.sidebar-column {
			order: 1;
		}
	}

	@media (max-width: 480px) {
		.dashboard-container {
			padding: 16px;
		}
	}

	/* Simplified Leave List Styles */
	.leave-list-container {
		display: flex;
		flex-direction: column;
	}

	.leave-section {
		margin-bottom: 16px;
		padding-bottom: 16px;
		border-bottom: 1px solid #f5f5f7;
	}

	.leave-section:last-child {
		margin-bottom: 0;
		padding-bottom: 0;
		border-bottom: none;
	}

	.leave-date-header {
		font-weight: 500;
		color: #1d1d1f;
		margin-bottom: 6px;
		font-size: 0.9rem;
	}

	.leave-staff-list.simple {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.leave-staff-item.simple {
		font-size: 0.9rem;
		padding: 3px 0;
		color: #1d1d1f;
	}

	/* Weekly Staff Grid Styles */
	.weekly-staff-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 12px;
		margin-top: 16px;
	}

	.day-column {
		display: flex;
		flex-direction: column;
	}

	.day-header {
		text-align: center;
		border-bottom: 1px solid #f0f0f0;
		padding-bottom: 8px;
		margin-bottom: 8px;
	}

	.day-name {
		font-weight: 500;
		font-size: 0.9rem;
	}

	.day-date {
		font-size: 0.8rem;
		color: #86868b;
		margin-top: 2px;
	}

	.day-empty {
		color: #86868b;
		font-size: 0.85rem;
		padding: 12px 0;
		text-align: center;
		font-style: italic;
	}

	.staff-list.compact {
		font-size: 0.85rem;
	}

	.staff-item.compact {
		padding: 4px 0;
	}

	/* Add responsive behavior for weekly staff */
	@media (max-width: 1024px) {
		.weekly-staff-grid {
			grid-template-columns: repeat(3, 1fr);
			grid-gap: 16px;
		}

		.day-column {
			border: 1px solid #f0f0f0;
			border-radius: 8px;
			padding: 12px;
		}
	}

	@media (max-width: 640px) {
		.weekly-staff-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 480px) {
		.weekly-staff-grid {
			grid-template-columns: 1fr;
		}
	}

	/* Add this to your styles */
	.day-column.today {
		background-color: rgba(0, 122, 255, 0.05);
		border-radius: 8px;
		box-shadow: 0 0 0 1px rgba(0, 122, 255, 0.2);
	}

	.day-column.today .day-header {
		border-bottom-color: rgba(0, 122, 255, 0.2);
	}

	.day-column.today .day-name {
		color: #007aff;
	}
</style>
