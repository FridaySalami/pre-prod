<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { userSession } from '$lib/sessionStore';
	import type { Session } from '@supabase/supabase-js';
	import { getEmployees, type Employee } from '$lib/employeeHoursService';
	import {
		saveDailyHours,
		getDailyHours,
		checkHoursExist,
		type DailyEmployeeHour
	} from '$lib/dailyHoursService';
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
		// Wait for session to be determined
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
				console.log('No session found, redirecting to login');
				goto('/login');
				return;
			}

			if (currentSession) {
				await loadEmployees();
				await loadExistingHours();
			}
		} catch (error) {
			console.error('Error during initialization:', error);
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
	let savedHours: Record<string, number> = $state({}); // Track last saved state
	let savedPackagesShipped = $state(0); // Track last saved packages shipped

	// Animation state
	let lastUpdatedId = $state<string | null>(null);
	let highlightTimeout: any;
	const animatedTotal = tweened(0, { duration: 500, easing: cubicOut });

	// Derived calculations
	let employeesWithHours = $derived(() => {
		return employees
			.map((employee) => ({
				...employee,
				hours: employeeHours[employee.id] || 0
			}))
			.sort((a, b) => {
				// First sort by role priority (Manager/Supervisor/B2C Accounts Manager first, then Associates, then others)
				const roleOrder: Record<string, number> = {
					Manager: 1,
					Supervisor: 1,
					'B2C Accounts Manager': 1,
					Associate: 2,
					Picking: 3
				};
				const aOrder = roleOrder[a.role || ''] || 4;
				const bOrder = roleOrder[b.role || ''] || 4;

				if (aOrder !== bOrder) {
					return aOrder - bOrder;
				}

				// Force "Extra" to the bottom of its role group
				if (a.id === 'extra-associate-hours') return 1;
				if (b.id === 'extra-associate-hours') return -1;

				// Then sort alphabetically by surname
				const aSurname = a.name.split(' ').pop() || '';
				const bSurname = b.name.split(' ').pop() || '';
				return aSurname.localeCompare(bSurname);
			});
	});

	let roleBreakdown = $derived(() => {
		const breakdown: Record<string, { employees: number; totalHours: number }> = {};

		employeesWithHours().forEach((emp) => {
			const role = emp.role || 'Unknown';
			if (!breakdown[role]) {
				breakdown[role] = { employees: 0, totalHours: 0 };
			}
			breakdown[role].employees += 1;
			breakdown[role].totalHours += emp.hours;
		});

		return breakdown;
	});

	let grandTotal = $derived(() => {
		return Object.values(roleBreakdown()).reduce((total, role) => total + role.totalHours, 0);
	});

	$effect(() => {
		animatedTotal.set(grandTotal());
	});

	// Calculate associate hours only
	let associateHours = $derived(() => {
		return employeesWithHours()
			.filter((emp) => emp.role === 'Associate')
			.reduce((total, emp) => total + emp.hours, 0);
	});

	// Calculate shipments per hour based on associate hours only
	let shipmentsPerHour = $derived(() => {
		const associateTotal = associateHours();
		if (associateTotal === 0 || estimatedPackagesShipped === 0) {
			return 0;
		}
		return estimatedPackagesShipped / associateTotal;
	});

	// Calculate recommended hour reduction to meet 18 shipments per hour target
	let hourReductionRecommendation = $derived(() => {
		const currentShipmentsPerHour = shipmentsPerHour();
		const targetShipmentsPerHour = 18;
		const currentAssociateHours = associateHours();

		if (
			estimatedPackagesShipped === 0 ||
			currentAssociateHours === 0 ||
			currentShipmentsPerHour >= targetShipmentsPerHour
		) {
			return { reduction: 0, show: false };
		}

		// Calculate optimal hours needed for target rate
		const optimalHours = estimatedPackagesShipped / targetShipmentsPerHour;
		const hoursToReduce = currentAssociateHours - optimalHours;

		return {
			reduction: Math.max(0, hoursToReduce),
			show: hoursToReduce > 0
		};
	});

	// Check if current hours differ from last saved state
	let hasUnsavedChanges = $derived.by(() => {
		if (saveStatus === 'success') return false; // Don't show changes message right after save

		const hoursChanged = employees.some((emp) => {
			const currentHours = employeeHours[emp.id] || 0;
			const lastSavedHours = savedHours[emp.id] || 0;
			return currentHours !== lastSavedHours;
		});

		const packagesChanged = estimatedPackagesShipped !== savedPackagesShipped;

		return hoursChanged || packagesChanged;
	});

	async function loadEmployees() {
		try {
			loading = true;
			error = '';
			employees = await getEmployees();

			// Add "Extra" entry for additional associate hours
			employees = [
				...employees,
				{
					id: 'extra-associate-hours',
					name: 'Extra',
					role: 'Associate'
				}
			];

			// Initialize hours for all employees to 0
			const initialHours: Record<string, number> = {};
			employees.forEach((emp) => {
				initialHours[emp.id] = 0;
			});
			employeeHours = initialHours;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load employees';
			console.error('Error loading employees:', err);
		} finally {
			loading = false;
		}
	}

	async function loadExistingHours() {
		try {
			const existingHours = await getDailyHours(selectedDate);
			hasExistingData = existingHours.length > 0;

			if (hasExistingData) {
				const hoursMap: Record<string, number> = {};
				existingHours.forEach((record) => {
					hoursMap[record.employee_id] = record.hours_worked;
				});
				employeeHours = { ...employeeHours, ...hoursMap };
				savedHours = { ...hoursMap }; // Store the loaded state as "saved"
			} else {
				// Reset saved hours if no existing data
				const resetHours: Record<string, number> = {};
				employees.forEach((emp) => {
					resetHours[emp.id] = 0;
				});
				savedHours = resetHours;
			}
		} catch (err) {
			console.error('Error loading existing hours:', err);
			// Don't show error to user for this, just log it
		}
	}

	function updateEmployeeHours(employeeId: string, hours: number) {
		employeeHours = {
			...employeeHours,
			[employeeId]: hours
		};

		// Trigger row highlight
		lastUpdatedId = employeeId;
		if (highlightTimeout) clearTimeout(highlightTimeout);
		highlightTimeout = setTimeout(() => {
			lastUpdatedId = null;
		}, 500);
	}

	function resetAllHours() {
		const resetHours: Record<string, number> = {};
		employees.forEach((emp) => {
			resetHours[emp.id] = 0;
		});
		employeeHours = resetHours;
		estimatedPackagesShipped = 0;
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	async function saveHours() {
		try {
			saving = true;
			saveStatus = '';

			// Map employees to ensure role is always a string
			const employeesForSave = employees.map((emp) => ({
				id: emp.id,
				name: emp.name,
				role: emp.role || 'Unknown'
			}));

			const result = await saveDailyHours(
				employeeHours,
				employeesForSave,
				selectedDate,
				'system' // You could replace this with actual user info
			);

			if (result.success) {
				saveStatus = 'success';
				hasExistingData = true;
				savedHours = { ...employeeHours }; // Store current state as saved
				setTimeout(() => {
					saveStatus = '';
				}, 3000);
			} else {
				saveStatus = 'error';
				error = result.error || 'Failed to save hours';
			}
		} catch (err) {
			saveStatus = 'error';
			error = err instanceof Error ? err.message : 'Failed to save hours';
			console.error('Error saving hours:', err);
		} finally {
			saving = false;
		}
	}

	async function onDateChange() {
		// Reset hours and load data for new date
		const resetHours: Record<string, number> = {};
		employees.forEach((emp) => {
			resetHours[emp.id] = 0;
		});
		employeeHours = resetHours;
		estimatedPackagesShipped = 0;
		saveStatus = ''; // Clear any success messages

		// Load existing hours for the new date
		await loadExistingHours();
	}
</script>

<svelte:head>
	<title>Employee Hours | Parker's Foodservice</title>
</svelte:head>

<!-- Authentication check wrapper -->
{#if session === undefined}
	<div class="loading-container">
		<div class="loading-spinner"></div>
		<p>Loading...</p>
	</div>
{:else if session}
	<div class="container">
		<!-- Sticky Header -->
		<div class="header">
			<div class="header-content">
				<h1>Employee Hours</h1>
			</div>
		</div>

		<!-- Persistent status bar to prevent layout jumping -->
		<div class="status-bar">
			{#if saveStatus === 'success'}
				<div class="status-content success">
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
						<polyline points="22,4 12,14.01 9,11.01" />
					</svg>
					Hours saved successfully for {formatDate(selectedDate)}
				</div>
			{:else if hasExistingData && hasUnsavedChanges}
				<div class="status-content info">
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<circle cx="12" cy="12" r="10" />
						<path d="M12,16 L12,12" />
						<path d="M12,8 L12.01,8" />
					</svg>
					Existing data found for {formatDate(selectedDate)} - Click "Update Hours" to save changes
				</div>
			{:else if error}
				<div class="status-content error">
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<circle cx="12" cy="12" r="10" />
						<line x1="15" y1="9" x2="9" y2="15" />
						<line x1="9" y1="9" x2="15" y2="15" />
					</svg>
					{error}
				</div>
			{:else}
				<div class="status-content neutral">
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.49 8.49l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.49-8.49l2.83-2.83"
						/>
					</svg>
					Ready to enter hours for {formatDate(selectedDate)}
				</div>
			{/if}
		</div>

		{#if loading}
			<div class="loading">
				<div class="spinner"></div>
				<p>Loading...</p>
			</div>
		{:else}
			<!-- Daily Summary Card -->
			<div class="card daily-summary-card">
				<div class="summary-group">
					<label for="date-input" class="summary-label">Date</label>
					<input
						id="date-input"
						type="date"
						bind:value={selectedDate}
						onchange={onDateChange}
						class="date-input"
					/>
				</div>

				<div class="summary-divider"></div>

				<div class="summary-group">
					<label for="packages-input" class="summary-label">Estimated Packages Shipped</label>
					<input
						id="packages-input"
						type="number"
						min="0"
						step="1"
						bind:value={estimatedPackagesShipped}
						class="packages-input"
						placeholder="0"
					/>
				</div>

				{#if estimatedPackagesShipped > 0 && associateHours() > 0}
					<div class="summary-divider"></div>
					<div class="metric-display productivity">
						<span class="metric-value">{shipmentsPerHour().toFixed(1)}</span>
						<span class="metric-label">Shipments/Hour</span>
					</div>
				{/if}

				{#if hourReductionRecommendation().show}
					<div class="metric-display recommendation">
						<span class="metric-value">{hourReductionRecommendation().reduction.toFixed(1)}</span>
						<span class="metric-label">Reduce Hours By</span>
					</div>
				{/if}

				<div class="card-actions">
					<button class="reset-button" onclick={resetAllHours}> Reset All </button>
					<button
						class="save-button {saveStatus === 'success' ? 'glow-success' : ''}"
						onclick={saveHours}
						disabled={saving}
					>
						{#if saving}
							<svg
								class="animate-spin"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.49 8.49l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.49-8.49l2.83-2.83"
								/>
							</svg>
							Saving...
						{:else}
							{hasExistingData ? 'Update Hours' : 'Save Hours'}
						{/if}
					</button>
				</div>
			</div>

			<!-- Main Content Area -->
			<div class="main-content">
				<!-- Employee Input Section (Left Half) -->
				<div class="card employee-section">
					<div class="card-header">
						<h2>Enter Hours</h2>
					</div>
					<div class="employee-list">
						{#each employeesWithHours() as employee, index}
							{#if index === 0 || employeesWithHours()[index - 1].role !== employee.role}
								{#if ['Manager', 'Supervisor', 'Associate', 'Picking', 'B2C Accounts Manager'].includes(employee.role || '')}
									<div class="section-header">
										{employee.role === 'Picking'
											? 'Picking Team'
											: employee.role + (employee.role?.endsWith('s') ? '' : 's')}
									</div>
								{/if}
							{/if}
							<div
								class="employee-row {employee.hours > 0 ? 'has-hours' : ''} {lastUpdatedId ===
								employee.id
									? 'highlight-pulse'
									: ''}"
							>
								<div class="employee-info">
									<div class="employee-name">{employee.name}</div>
									<div class="employee-role">{employee.role || 'Unknown'}</div>
								</div>
								<div class="input-container">
									<input
										type="number"
										min="0"
										max="24"
										step="0.5"
										value={employee.hours}
										oninput={(e) => {
											const target = e.target as HTMLInputElement;
											const hours = parseFloat(target.value) || 0;
											updateEmployeeHours(employee.id, hours);
										}}
										onfocus={(e) => {
											const target = e.target as HTMLInputElement;
											setTimeout(() => {
												target.select();
											}, 0);
										}}
										onclick={(e) => {
											const target = e.target as HTMLInputElement;
											target.select();
										}}
										class="hours-input"
										placeholder="0"
									/>
								</div>
							</div>
						{/each}
					</div>
				</div>

				<!-- Role Breakdown (Right Half) -->
				<div class="card breakdown-section">
					<div class="card-header">
						<h2>Hours by Role</h2>
					</div>
					<div class="role-list">
						{#each Object.entries(roleBreakdown()) as [role, data]}
							<div class="role-item">
								<div class="role-name">{role}</div>
								<div class="role-stat-count">
									{data.employees} employee{data.employees !== 1 ? 's' : ''}
								</div>
								<div class="role-stat-hours">
									{data.totalHours.toFixed(1)} hrs
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Bottom Stats Bar -->
			<div class="bottom-stats-bar">
				<span class="stat-text">{employees.length} employees</span>
				<span class="stat-separator">·</span>
				<span class="stat-text"
					>{employeesWithHours().filter((e) => e.hours > 0).length} working today</span
				>
				<span class="stat-separator">·</span>
				<span class="stat-text highlight">{$animatedTotal.toFixed(1)} total hours</span>
				<span class="stat-separator">·</span>
				<DocumentationLink section="employee-hours" />
			</div>
		{/if}
	</div>
	<footer class="page-footer">Created by Jack Weston</footer>
{:else}
	<!-- When session is null, onMount should have redirected already -->
	<div class="loading-container">
		<p>Redirecting to login...</p>
	</div>
{/if}

<style>
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

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 32px;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		padding-bottom: 80px; /* Space for fixed bottom bar */
	}

	/* Header */
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 32px;
		gap: 16px;
		flex-wrap: wrap;
		position: sticky;
		top: 0;
		z-index: 40;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(8px);
		padding-top: 16px;
		padding-bottom: 16px;
		border-bottom: 1px solid #f3f4f6;
		/* Negative margins to span full width of container padding */
		margin-left: -32px;
		margin-right: -32px;
		padding-left: 32px;
		padding-right: 32px;
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.header-content h1 {
		margin: 0;
		color: #111827;
		font-size: 1.875rem;
		font-weight: 700;
		letter-spacing: -0.025em;
	}

	.card-actions {
		display: flex;
		gap: 12px;
		align-items: center;
		margin-left: auto;
	}

	.reset-button {
		display: flex;
		align-items: center;
		gap: 6px;
		background: transparent;
		color: #6b7280;
		border: 1px solid transparent;
		padding: 8px 16px;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.reset-button:hover {
		background: #f3f4f6;
		color: #374151;
	}

	.save-button {
		display: flex;
		align-items: center;
		gap: 6px;
		background: #2563eb;
		color: white;
		border: 1px solid #2563eb;
		padding: 10px 24px;
		border-radius: 8px;
		font-size: 0.9375rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.save-button:hover:not(:disabled) {
		background: #1d4ed8;
		border-color: #1d4ed8;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06);
	}

	.save-button:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	/* Status Bar */
	.status-bar {
		margin-bottom: 32px;
		min-height: 48px;
	}

	.status-content {
		padding: 12px 16px;
		font-size: 0.875rem;
		font-weight: 500;
		display: flex;
		align-items: center;
		gap: 10px;
		border-radius: 8px;
	}

	.status-content.success {
		background: #ecfdf5;
		color: #065f46;
		border: 1px solid #a7f3d0;
	}

	.status-content.info {
		background: #fffbeb;
		color: #92400e;
		border: 1px solid #fde68a;
	}

	.status-content.error {
		background: #fef2f2;
		color: #991b1b;
		border: 1px solid #fecaca;
	}

	.status-content.neutral {
		background: #f3f4f6;
		color: #4b5563;
		border: 1px solid #e5e7eb;
	}

	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 48px;
		color: #6b7280;
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid #e5e7eb;
		border-top: 3px solid #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	/* Cards */
	.card {
		background: #f8f8f8;
		border-radius: 8px;
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.05),
			0 1px 2px rgba(0, 0, 0, 0.03);
		border: 1px solid #e5e7eb;
		overflow: hidden;
	}

	.card-header {
		padding: 16px 24px;
		border-bottom: 1px solid #e5e7eb;
		background: transparent;
	}

	.card-header h2 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: #374151;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Daily Summary Card */
	.daily-summary-card {
		display: flex;
		align-items: center;
		padding: 24px;
		gap: 32px;
		margin-bottom: 32px;
		flex-wrap: wrap;
	}

	.summary-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.summary-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #6b7280;
		font-weight: 600;
	}

	.summary-divider {
		width: 1px;
		height: 48px;
		background: #e5e7eb;
	}

	.date-input {
		padding: 10px 12px;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		font-size: 1rem;
		color: #111827;
		background: white;
		min-width: 160px;
	}

	.packages-input {
		width: 140px;
		padding: 10px 12px;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		font-size: 1.125rem;
		font-weight: 600;
		color: #111827;
		text-align: left;
		background: white;
	}

	.date-input:focus,
	.packages-input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.metric-display {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px 20px;
		border-radius: 8px;
		min-width: 140px;
	}

	.metric-display.productivity {
		background: #ecfdf5;
		border: 1px solid #a7f3d0;
	}

	.metric-display.productivity .metric-value {
		color: #059669;
	}

	.metric-display.productivity .metric-label {
		color: #047857;
	}

	.metric-display.recommendation {
		background: #fffbeb;
		border: 1px solid #fde68a;
	}

	.metric-display.recommendation .metric-value {
		color: #d97706;
	}

	.metric-display.recommendation .metric-label {
		color: #b45309;
	}

	.metric-value {
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.metric-label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Main Content Layout */
	.main-content {
		display: grid;
		grid-template-columns: 1fr 380px;
		gap: 32px;
		align-items: start;
	}

	/* Employee List */
	.employee-list {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		padding: 16px;
	}

	.section-header {
		grid-column: 1 / -1;
		padding: 16px 0 8px 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: #374151;
		text-transform: none;
		letter-spacing: normal;
		border-bottom: 1px solid #e5e7eb;
		margin-top: 24px;
		margin-bottom: 8px;
	}

	.section-header:first-child {
		margin-top: 0;
		padding-top: 0;
	}

	.employee-row {
		display: grid;
		grid-template-columns: 1fr auto auto;
		align-items: center;
		gap: 16px;
		padding: 12px 16px;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		background: white;
		transition: all 0.2s ease;
	}

	.employee-row:hover {
		border-color: #d1d5db;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
	}

	.employee-row.has-hours {
		background: #eff6ff;
		border-color: #bfdbfe;
	}

	.employee-row.has-hours .employee-name {
		color: #1d4ed8;
		font-weight: 600;
	}

	.employee-info {
		display: contents;
	}

	.employee-name {
		font-size: 1rem;
		font-weight: 500;
		color: #1f2937;
	}

	.employee-role {
		font-size: 0.8125rem;
		color: #9ca3af;
		font-weight: 400;
	}

	.hours-input {
		width: 70px;
		height: 40px;
		padding: 8px;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 1rem;
		font-weight: 600;
		text-align: right;
		background: white;
		transition: all 0.2s ease;
		font-variant-numeric: tabular-nums;
	}

	.hours-input:focus {
		outline: none;
		border-color: #3b82f6;
		background: white;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.employee-row.has-hours .hours-input {
		border-color: #93c5fd;
		background: white;
		color: #1d4ed8;
	}

	/* Breakdown Section */
	.role-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 12px;
		padding: 16px;
	}

	.role-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		background: white;
		transition: all 0.2s ease;
	}

	.role-item:hover {
		border-color: #d1d5db;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
	}

	.role-name {
		font-weight: 600;
		color: #374151;
		font-size: 0.875rem;
		margin-bottom: 4px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.role-stat-count {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.role-stat-hours {
		font-size: 0.9375rem;
		color: #111827;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	/* Bottom Stats Bar */
	.bottom-stats-bar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: white;
		border-top: 1px solid #e5e7eb;
		padding: 16px 32px;
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 12px;
		box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.05);
		z-index: 50;
		font-size: 0.875rem;
		color: #6b7280;
		font-weight: 500;
	}

	.stat-text {
		color: #374151;
	}

	.stat-text.highlight {
		color: #2563eb;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.stat-separator {
		color: #d1d5db;
		font-weight: 700;
	}

	/* Responsive */
	@media (max-width: 1024px) {
		.main-content {
			grid-template-columns: 1fr;
		}

		.daily-summary-card {
			gap: 20px;
		}

		.summary-divider {
			display: none;
		}
	}

	@media (max-width: 768px) {
		.container {
			padding: 16px;
			padding-bottom: 100px;
		}

		.header {
			margin-left: -16px;
			margin-right: -16px;
			padding-left: 16px;
			padding-right: 16px;
		}

		.header h1 {
			font-size: 1.5rem;
		}

		.employee-list {
			grid-template-columns: 1fr;
		}

		.daily-summary-card {
			flex-direction: column;
			align-items: stretch;
			gap: 16px;
			padding: 16px;
		}

		.summary-group {
			width: 100%;
		}

		.date-input,
		.packages-input {
			width: 100%;
			min-width: 0;
		}

		.metric-display {
			width: 100%;
			flex-direction: row;
			justify-content: space-between;
			align-items: center;
		}

		.bottom-stats-bar {
			padding: 12px 16px;
			flex-direction: column;
			gap: 4px;
		}

		.stat-separator {
			display: none;
		}

		.employee-row {
			display: flex;
			flex-direction: column;
			align-items: stretch;
			gap: 8px;
		}

		.employee-info {
			display: flex;
			flex-direction: row;
			align-items: baseline;
			justify-content: space-between;
			gap: 8px;
		}

		.input-container {
			width: 100%;
		}

		.hours-input {
			width: 100%;
			text-align: center;
		}
	}

	/* Animations */
	@keyframes pulse {
		0% {
			background-color: white;
		}
		50% {
			background-color: #eff6ff; /* Light blue highlight */
			border-color: #93c5fd;
		}
		100% {
			background-color: white;
		}
	}

	.highlight-pulse {
		animation: pulse 0.5s ease-in-out;
	}

	/* Override pulse if row already has hours (keep it blueish but pulse slightly brighter) */
	.employee-row.has-hours.highlight-pulse {
		animation: pulse-blue 0.5s ease-in-out;
	}

	@keyframes pulse-blue {
		0% {
			background-color: #eff6ff;
		}
		50% {
			background-color: #dbeafe; /* Slightly darker blue */
			border-color: #60a5fa;
		}
		100% {
			background-color: #eff6ff;
		}
	}

	@keyframes glow {
		0% {
			box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.7);
		}
		70% {
			box-shadow: 0 0 0 10px rgba(37, 99, 235, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(37, 99, 235, 0);
		}
	}

	.glow-success {
		animation: glow 1.5s infinite;
		background-color: #059669 !important; /* Green success color */
		border-color: #059669 !important;
	}

	.page-footer {
		text-align: center;
		padding: 24px;
		color: #9ca3af;
		font-size: 0.875rem;
		margin-top: auto;
	}
</style>
