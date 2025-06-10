<script context="module" lang="ts">
	// Interface definitions for type checking
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

	interface CalendarDayEmployee {
		id: string;
		name: string;
		role: string;
		shift: string;
		onLeave?: boolean;
		leaveType?: string;
		leaveColor?: string;
	}

	interface CalendarDay {
		date: Date;
		isCurrentMonth: boolean;
		employees: CalendarDayEmployee[];
		totalWorkingHours?: number;
	}

	interface WeeklyPattern {
		id: string;
		employee_id: string;
		day_of_week: number;
		is_working: boolean;
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

	// Export the populateCalendar function so it can be imported directly
	export function populateCalendar(
		calendarDays: CalendarDay[],
		employees: Employee[],
		scheduleItems: ScheduleItem[],
		leaveRequests: LeaveRequest[],
		formatApiDate: (date: Date) => string,
		getLocalISODate: (date: Date) => string,
		saveScheduledHours: (date: Date, hours: number) => Promise<void>,
		weeklyPatterns: WeeklyPattern[] = []
	): CalendarDay[] {
		// Reset employees for all days
		calendarDays = calendarDays.map((day: CalendarDay) => ({
			...day,
			employees: []
		}));

		// First, populate based on weekly patterns
		if (weeklyPatterns.length > 0) {
			for (const day of calendarDays) {
				// Get day of week (0 = Monday, 6 = Sunday in our data model)
				let dayOfWeek = day.date.getDay() - 1;
				if (dayOfWeek < 0) dayOfWeek = 6; // Convert Sunday from 0 to 6

				// Find all employees scheduled for this day of week
				const scheduledEmployees = weeklyPatterns.filter(
					(pattern: WeeklyPattern) => pattern.day_of_week === dayOfWeek && pattern.is_working
				);

				// For each scheduled employee, add to the day with default morning shift
				for (const pattern of scheduledEmployees) {
					const employee = employees.find((emp: Employee) => emp.id === pattern.employee_id);

					if (employee) {
						// Check if this employee already has a specific schedule for this day
						// (which would override the weekly pattern)
						const hasSpecificSchedule = scheduleItems.some(
							(item) => item.employeeId === employee.id && formatApiDate(day.date) === item.date
						);

						if (!hasSpecificSchedule) {
							day.employees.push({
								id: employee.id,
								name: employee.name,
								role: employee.role,
								shift: 'morning'
							});
						}
					}
				}
			}
		}

		// Next, add specific schedule assignments (these override weekly patterns)
		for (const item of scheduleItems) {
			const dayIndex = calendarDays.findIndex((day) => formatApiDate(day.date) === item.date);

			if (dayIndex !== -1) {
				const employee = employees.find((emp) => emp.id === item.employeeId);

				if (employee) {
					// Check if the employee is already in this day (from pattern)
					const existingIndex = calendarDays[dayIndex].employees.findIndex(
						(emp) => emp.id === employee.id
					);

					if (existingIndex !== -1) {
						// Update the existing entry (override pattern with specific shift)
						calendarDays[dayIndex].employees[existingIndex].shift = item.shift;
					} else {
						// Add new entry
						calendarDays[dayIndex].employees.push({
							id: employee.id,
							name: employee.name,
							role: employee.role, // Add role information
							shift: item.shift
						});
					}
				}
			}
		}

		// Helper function to check if an employee is on leave
		function getEmployeeLeave(employeeId: string, date: Date): LeaveRequest | null {
			const dateStr = formatApiDate(date);
			const leave = leaveRequests.find(
				(leave: LeaveRequest) =>
					leave.employee_id === employeeId &&
					leave.start_date <= dateStr &&
					leave.end_date >= dateStr
			);

			return leave || null;
		}

		// Function to get the role priority for sorting
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

		// Constants for shift durations
		const SHIFT_DURATIONS: Record<string, number> = {
			morning: 8.5, // 8:00 - 16:30 with paid break
			afternoon: 8.5, // Assuming same duration for afternoon shift
			night: 8.5 // Assuming same duration for night shift
		};

		// Calculate total working hours for a day
		function calculateDayWorkingHours(employees: CalendarDayEmployee[]): number {
			// Only count employees who are not on leave
			return employees
				.filter((emp) => !emp.onLeave)
				.reduce((total: number, emp: CalendarDayEmployee) => {
					return total + (SHIFT_DURATIONS[emp.shift] || 8.5);
				}, 0);
		}

		// When adding employees, check for leave
		for (const day of calendarDays) {
			// After populating employees for the day, check each employee for leave
			day.employees = day.employees.map((emp: CalendarDayEmployee) => {
				const employeeLeave = getEmployeeLeave(emp.id, day.date);
				return {
					...emp,
					onLeave: !!employeeLeave,
					leaveType: employeeLeave?.leave_type_name || undefined,
					leaveColor: employeeLeave?.leave_type_color || undefined
				};
			});
		}

		// Sort employees in each day by role priority first, then by name
		calendarDays = calendarDays.map((day: CalendarDay) => {
			return {
				...day,
				employees: day.employees.sort((a: CalendarDayEmployee, b: CalendarDayEmployee) => {
					// First compare by role priority
					const roleDiff = getRolePriority(a.role) - getRolePriority(b.role);

					// If same role, then sort by name
					if (roleDiff === 0) {
						return a.name.localeCompare(b.name);
					}

					return roleDiff;
				})
			};
		});

		// Calculate and save hours for each day
		for (const day of calendarDays) {
			try {
				const activeEmployees = day.employees.filter((emp) => !emp.onLeave);
				const hoursForDay = calculateDayWorkingHours(activeEmployees);

				// Extra validation to ensure the date is valid
				if (!(day.date instanceof Date) || isNaN(day.date.getTime())) {
					console.error('Invalid day date found:', day.date);
					continue;
				}

				// Create a clean date object (helps with potential reference issues)
				const cleanDate = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate());

				// Log date details for debugging
				console.log(`Processing day: 
          Original date: ${day.date.toISOString()}
          Clean date: ${cleanDate.toISOString()}
          API format: ${getLocalISODate(cleanDate)}
          Day of week: ${cleanDate.getDay()} (0=Sun)
          Active employees: ${activeEmployees.length}
          Hours: ${hoursForDay}
        `);

				day.totalWorkingHours = hoursForDay;
				saveScheduledHours(cleanDate, hoursForDay);
			} catch (err) {
				console.error('Error processing calendar day:', err, day);
			}
		}

		return calendarDays;
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	// Define prop types for the component
	export let calendarDays: {
		date: Date;
		isCurrentMonth: boolean;
		employees: any[];
		totalWorkingHours?: number;
	}[] = [];
	export let employees: any[] = [];
	export let scheduleItems: any[] = [];
	export let leaveRequests: any[] = [];
	export let formatApiDate: (date: Date) => string;
	export let getLocalISODate: (date: Date) => string;
	export let saveScheduledHours: (date: Date, hours: number) => Promise<void>;

	// Constants for shift durations
	const SHIFT_DURATIONS = {
		morning: 8.5, // 8:00 - 16:30 with paid break
		afternoon: 8.5, // Assuming same duration for afternoon shift
		night: 8.5 // Assuming same duration for night shift
	};

	// Interface definitions to match the parent component
	interface WeeklyPattern {
		id: string;
		employee_id: string;
		day_of_week: number;
		is_working: boolean;
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

	// Helper function to check if an employee is on leave
	function getEmployeeLeave(employeeId: string, date: Date): LeaveRequest | null {
		const dateStr = formatApiDate(date);
		const leave = leaveRequests.find(
			(leave) =>
				leave.employee_id === employeeId && leave.start_date <= dateStr && leave.end_date >= dateStr
		);

		return leave || null;
	}

	// Function to get the role priority for sorting
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

	// Calculate total working hours for a day
	function calculateDayWorkingHours(employees: any[]): number {
		// Only count employees who are not on leave
		return employees
			.filter((emp) => !emp.onLeave)
			.reduce((total, emp) => {
				return total + (SHIFT_DURATIONS[emp.shift as keyof typeof SHIFT_DURATIONS] || 8.5);
			}, 0);
	}

	// Main function to populate calendar with employee schedules
	// Using the exported module version instead of this local one
	export function processCalendar(weeklyPatterns: WeeklyPattern[] = []) {
		// Use the exported function from the context="module" section
		calendarDays = populateCalendar(
			calendarDays,
			employees,
			scheduleItems,
			leaveRequests,
			formatApiDate,
			getLocalISODate,
			saveScheduledHours,
			weeklyPatterns
		);
	}
</script>
