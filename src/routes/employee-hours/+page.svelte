<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
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
		<!-- Compact Header -->
		<div class="header">
			<div class="header-content">
				<h1>Employee Hours</h1>
				<DocumentationLink section="employee-hours" />
			</div>
			<div class="date-picker">
				<input
					id="date-input"
					type="date"
					bind:value={selectedDate}
					onchange={onDateChange}
					class="date-input"
				/>
				<button class="save-button" onclick={saveHours} disabled={saving}>
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
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
							<polyline points="17,21 17,13 7,13 7,21" />
							<polyline points="7,3 7,8 15,8" />
						</svg>
						{hasExistingData ? 'Update Hours' : 'Save Hours'}
					{/if}
				</button>
				<button class="reset-button" onclick={resetAllHours}>
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
						<polyline points="1 4 1 10 7 10"></polyline>
						<polyline points="23 20 23 14 17 14"></polyline>
						<path d="m20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
					</svg>
					Reset All
				</button>
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
			<!-- Packages Shipped Input Section -->
			<div class="packages-section">
				<div class="packages-input-container">
					<label for="packages-input" class="packages-label">Estimated Packages Shipped</label>
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

				<div class="metrics-container">
					<!-- Shipments per Hour Display -->
					{#if estimatedPackagesShipped > 0 && associateHours() > 0}
						<div class="metric-display productivity">
							<span class="metric-value">{shipmentsPerHour().toFixed(1)}</span>
							<span class="metric-label">Current Shipments/Hour</span>
						</div>
					{/if}

					<!-- Hour Reduction Recommendation -->
					{#if hourReductionRecommendation().show}
						<div class="metric-display recommendation">
							<span class="metric-value">{hourReductionRecommendation().reduction.toFixed(1)}</span>
							<span class="metric-label">Hours to reduce to meet 18 shipments/hour</span>
						</div>
					{/if}
				</div>
			</div>

			<!-- Main Content Area -->
			<div class="main-content">
				<!-- Employee Input Section (Left Half) -->
				<div class="employee-input-section">
					<h2>Enter Hours</h2>
					<div class="employee-grid">
						{#each employeesWithHours() as employee, index}
							{#if index === 0 || (employeesWithHours()[index - 1].role !== employee.role && (employee.role === 'Associate' || employee.role === 'Picking'))}
								<div class="role-separator">
									{#if employee.role === 'Associate'}
										<span>Associates</span>
									{:else if employee.role === 'Picking'}
										<span>Picking Team</span>
									{/if}
								</div>
							{/if}
							<div class="employee-card {employee.hours > 0 ? 'has-hours' : ''}">
								<div class="employee-content">
									<div class="employee-info">
										<div class="employee-name">{employee.name}</div>
										<div
											class="role-badge role-{employee.role?.toLowerCase().replace(' ', '-') ||
												'unknown'}"
										>
											{employee.role || 'Unknown'}
										</div>
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
												// Use setTimeout to ensure selection happens after focus completes
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
							</div>
						{/each}
					</div>
				</div>

				<!-- Role Breakdown (Right Half) -->
				<div class="breakdown-section">
					<h2>Hours by Role</h2>
					<div class="role-list">
						{#each Object.entries(roleBreakdown()) as [role, data]}
							<div class="role-item">
								<div class="role-info">
									<span class="role-name">{role}</span>
									<span class="employee-count"
										>{data.employees} employee{data.employees !== 1 ? 's' : ''}</span
									>
								</div>
								<div class="role-hours">
									<span class="hours-value">{data.totalHours.toFixed(1)}</span>
									<span class="hours-unit">hrs</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Bottom Stats Bar -->
			<div class="bottom-stats">
				<div class="stat-item">
					<span class="stat-value">{employees.length}</span>
					<span class="stat-label">Total Employees</span>
				</div>
				<div class="stat-item">
					<span class="stat-value">{employeesWithHours().filter((e) => e.hours > 0).length}</span>
					<span class="stat-label">Working Today</span>
				</div>
				<div class="stat-item highlight">
					<span class="stat-value">{grandTotal().toFixed(1)}</span>
					<span class="stat-label">Total Hours</span>
				</div>
			</div>
		{/if}
	</div>
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
		max-width: 1400px;
		margin: 0 auto;
		padding: 16px;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	/* Compact Header */
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 24px;
		gap: 16px;
		flex-wrap: wrap;
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 16px;
		flex: 1;
	}

	.header-content h1 {
		margin: 0;
		color: #1f2937;
		font-size: 1.75rem;
		font-weight: 600;
	}

	.date-picker {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.date-input {
		padding: 8px 12px;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.875rem;
		background: white;
	}

	.date-input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.reset-button {
		display: flex;
		align-items: center;
		gap: 6px;
		background: #f3f4f6;
		color: #6b7280;
		border: 1px solid #d1d5db;
		padding: 6px 12px;
		border-radius: 6px;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		/* Enhanced touch target for mobile */
		min-height: 44px;
		-webkit-tap-highlight-color: transparent;
	}

	.reset-button:hover {
		background: #e5e7eb;
		color: #374151;
	}

	.save-button {
		display: flex;
		align-items: center;
		gap: 6px;
		background: #3b82f6;
		color: white;
		border: 1px solid #3b82f6;
		padding: 8px 16px;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		/* Enhanced touch target for mobile */
		min-height: 44px;
		-webkit-tap-highlight-color: transparent;
	}

	.save-button:hover:not(:disabled) {
		background: #2563eb;
		border-color: #2563eb;
		box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
	}

	.save-button:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	/* Persistent Status Bar */
	.status-bar {
		margin-bottom: 16px;
		min-height: 48px;
		display: flex;
		align-items: center;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		transition: all 0.3s ease;
	}

	.status-content {
		padding: 12px 16px;
		font-size: 0.875rem;
		font-weight: 500;
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		border-radius: 8px;
		transition: all 0.3s ease;
	}

	.status-content.success {
		background: #f0f9ff;
		border: 1px solid #0ea5e9;
		color: #0c4a6e;
	}

	.status-content.info {
		background: #fefce8;
		border: 1px solid #facc15;
		color: #a16207;
	}

	.status-content.error {
		background: #fef2f2;
		border: 1px solid #fecaca;
		color: #b91c1c;
	}

	.status-content.neutral {
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		color: #6b7280;
	}

	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 32px;
		color: #6b7280;
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 2px solid #e5e7eb;
		border-top: 2px solid #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	/* Main Content Layout */
	.main-content {
		display: grid;
		grid-template-columns: 1fr 400px;
		gap: 16px;
		min-height: 0;
	}

	/* Employee Input Section (Left) */
	.employee-input-section {
		background: white;
		border-radius: 8px;
		padding: 12px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		/* Remove fixed height constraints for natural flow */
	}

	.employee-input-section h2 {
		margin: 0 0 8px 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: #1f2937;
	}

	.employee-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 10px;
		/* Remove fixed height constraints - let content flow naturally */
		padding-right: 4px;
	}

	.role-separator {
		grid-column: 1 / -1;
		padding: 6px 0 2px 0;
		margin: 2px 0;
		border-top: 1px solid #e5e7eb;
		font-size: 0.75rem;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.employee-card {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		transition: all 0.2s ease;
		cursor: pointer;
		max-width: 280px;
		height: auto;
	}

	.employee-content {
		padding: 20px;
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		min-height: auto;
	}

	.employee-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.employee-card.has-hours {
		background: rgba(59, 130, 246, 0.15);
		border-color: rgba(59, 130, 246, 0.4);
		border-width: 2px;
		box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
		transform: translateY(-1px);
	}

	.employee-card.has-hours:hover {
		transform: translateY(-3px);
		box-shadow: 0 6px 16px rgba(59, 130, 246, 0.2);
	}

	.employee-info {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 6px;
		flex: 1;
		min-width: 0;
	}

	.employee-name {
		font-weight: 600;
		color: #1f2937;
		font-size: 0.875rem;
		line-height: 1.3;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	.employee-card.has-hours .employee-name {
		color: #1e40af;
		font-weight: 700;
	}

	.role-badge {
		display: inline-block;
		padding: 3px 8px;
		border-radius: 12px;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.025em;
		line-height: 1;
		white-space: nowrap;
		align-self: flex-start;
	}

	.input-container {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.role-badge.role-manager {
		background: #dbeafe;
		color: #1e40af;
	}

	.role-badge.role-supervisor {
		background: #d1fae5;
		color: #047857;
	}

	.role-badge.role-team-lead {
		background: #fef3c7;
		color: #92400e;
	}

	.role-badge.role-associate {
		background: #e0e7ff;
		color: #3730a3;
	}

	.role-badge.role-trainee {
		background: #fce7f3;
		color: #be185d;
	}

	.role-badge.role-unknown {
		background: #f3f4f6;
		color: #6b7280;
	}

	.role-badge.role-b2c-accounts-manager {
		background: #fdf2f8;
		color: #9d174d;
	}

	.role-badge.role-picking {
		background: #fff7ed;
		color: #c2410c;
	}

	.hours-input {
		width: 60px;
		height: 38px;
		padding: 8px;
		border: 1.5px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 600;
		text-align: center;
		background: white;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		/* Enhanced touch targets for mobile */
		min-height: 44px;
		min-width: 44px;
		-webkit-tap-highlight-color: transparent;
		user-select: all;
	}

	.hours-input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.employee-card.has-hours .hours-input {
		background: #dbeafe;
		border-color: #3b82f6;
		color: #1e40af;
		font-weight: 700;
	}

	.hours-input::-webkit-outer-spin-button,
	.hours-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.hours-input[type='number'] {
		appearance: textfield;
		-moz-appearance: textfield;
	}

	/* Role Breakdown Section (Right) */
	.breakdown-section {
		background: white;
		border-radius: 8px;
		padding: 12px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		display: flex;
		flex-direction: column;
		/* Remove fixed height constraints for natural flow */
	}

	.breakdown-section h2 {
		margin: 0 0 8px 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: #1f2937;
	}

	.role-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		/* Remove scrollbar - let content flow naturally */
		flex: 1;
	}

	.role-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 10px;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		background: #f9fafb;
		transition: all 0.2s ease;
	}

	.role-item:hover {
		border-color: #d1d5db;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
	}

	.role-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.role-name {
		font-weight: 600;
		color: #1f2937;
		font-size: 0.8rem;
	}

	.employee-count {
		font-size: 0.7rem;
		color: #6b7280;
		font-weight: 500;
	}

	.role-hours {
		display: flex;
		align-items: baseline;
		gap: 4px;
	}

	.hours-value {
		font-size: 1.25rem;
		font-weight: 700;
		color: #3b82f6;
	}

	.hours-unit {
		font-size: 0.75rem;
		color: #6b7280;
		font-weight: 500;
	}

	/* Bottom Stats Bar */
	.bottom-stats {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 30px;
		margin-top: 6px;
		padding: 10px 14px;
		background: white;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		flex-wrap: wrap;
	}

	/* Packages Section */
	.packages-section {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 24px;
		margin-bottom: 16px;
		padding: 16px 20px;
		background: white;
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		border: 1px solid #e5e7eb;
		flex-wrap: wrap;
	}

	.packages-input-container {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 6px;
		min-width: 150px;
	}

	.packages-label {
		font-size: 0.875rem;
		color: #374151;
		font-weight: 600;
		letter-spacing: 0.025em;
	}

	.packages-input {
		width: 120px;
		height: 40px;
		padding: 8px 12px;
		border: 1.5px solid #d1d5db;
		border-radius: 6px;
		font-size: 1rem;
		font-weight: 600;
		text-align: center;
		background: white;
		transition: all 0.2s ease;
	}

	.packages-input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.packages-input::-webkit-outer-spin-button,
	.packages-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.packages-input[type='number'] {
		appearance: textfield;
		-moz-appearance: textfield;
	}

	.metrics-container {
		display: flex;
		gap: 16px;
		flex-wrap: wrap;
	}

	.metric-display {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 12px 20px;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		min-width: 140px;
	}

	.metric-display.productivity {
		background: linear-gradient(135deg, #10b981, #047857);
		color: white;
	}

	.metric-display.recommendation {
		background: linear-gradient(135deg, #f59e0b, #d97706);
		color: white;
	}

	.metric-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: white;
	}

	.metric-label {
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.9);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		text-align: center;
		line-height: 1.3;
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}

	.stat-item.highlight {
		background: linear-gradient(135deg, #3b82f6, #1d4ed8);
		color: white;
		padding: 10px 16px;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
	}

	.stat-value {
		font-size: 1.25rem;
		font-weight: 800;
		color: #1f2937;
	}

	.stat-item.highlight .stat-value {
		color: white;
		font-size: 1.5rem;
	}

	.stat-label {
		font-size: 0.75rem;
		color: #6b7280;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.stat-item.highlight .stat-label {
		color: rgba(255, 255, 255, 0.9);
	}
	@media (max-width: 1200px) {
		.main-content {
			grid-template-columns: 1fr 350px;
		}
	}

	@media (max-width: 1024px) {
		.main-content {
			grid-template-columns: 1fr;
			grid-template-rows: auto auto;
			gap: 16px;
		}

		.employee-input-section {
			max-height: none;
			overflow: visible;
		}

		.employee-grid {
			max-height: none;
			overflow-y: visible;
			/* Let content flow naturally */
		}

		.breakdown-section {
			max-height: none;
			overflow: visible;
		}
	}

	/* Enhanced mobile experience for larger phones */
	@media (max-width: 900px) and (min-width: 481px) {
		.employee-grid {
			grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
			gap: 12px;
		}

		.employee-card {
			max-width: none;
		}

		.hours-input {
			width: 65px;
			height: 42px;
			font-size: 16px;
		}
	}

	@media (max-width: 768px) {
		.container {
			padding: 8px;
		}

		.header {
			flex-direction: column;
			gap: 16px;
			align-items: stretch;
			padding: 16px;
		}

		.header h1 {
			font-size: 1.5rem;
			text-align: center;
		}

		.date-picker {
			justify-content: center;
			flex-wrap: wrap;
			gap: 8px;
		}

		.date-input {
			flex: 1;
			min-width: 140px;
			font-size: 16px; /* Prevents zoom on iOS */
		}

		.save-button,
		.reset-button {
			padding: 10px 16px;
			font-size: 14px;
		}

		.status-bar {
			margin-bottom: 12px;
		}

		.status-content {
			padding: 12px 16px;
			font-size: 14px;
		}

		.main-content {
			gap: 20px;
			/* Remove any height constraints on mobile */
			grid-template-rows: auto auto;
		}

		.employee-input-section {
			max-height: none;
			overflow: visible;
		}

		.employee-input-section h2,
		.breakdown-section h2 {
			font-size: 1.25rem;
			margin-bottom: 12px;
		}

		.employee-grid {
			grid-template-columns: 1fr;
			/* Remove all height constraints and scrollbars */
			max-height: none;
			overflow-y: visible;
			gap: 8px;
		}

		.employee-card {
			max-width: none;
			margin-bottom: 0;
		}

		.employee-content {
			padding: 12px 16px;
			gap: 16px;
		}

		.employee-name {
			font-size: 16px; /* Better readability on mobile */
			line-height: 1.4;
		}

		.role-badge {
			font-size: 0.7rem;
			padding: 4px 8px;
		}

		.hours-input {
			width: 70px;
			height: 44px; /* Better touch target */
			font-size: 18px; /* Easier to read and prevents zoom */
			text-align: center;
		}

		.breakdown-section {
			/* Remove height constraints */
			max-height: none;
			overflow: visible;
		}

		.role-item {
			padding: 12px 16px;
		}

		.role-name {
			font-size: 16px;
		}

		.employee-count {
			font-size: 14px;
		}

		.hours-value {
			font-size: 18px;
		}

		.bottom-stats {
			gap: 16px;
			padding: 16px;
			margin-top: 16px;
			flex-wrap: wrap;
		}

		.packages-section {
			flex-direction: column;
			gap: 16px;
			padding: 16px;
			text-align: center;
		}

		.packages-input-container {
			align-items: center;
		}

		.packages-input {
			width: 140px;
			height: 44px;
			font-size: 16px;
		}

		.metrics-container {
			justify-content: center;
			gap: 12px;
		}

		.metric-display {
			padding: 12px 16px;
			min-width: 120px;
		}
	}

	@media (max-width: 480px) {
		.container {
			padding: 4px;
		}

		.header {
			gap: 12px;
			padding: 12px;
		}

		.header h1 {
			font-size: 1.25rem;
		}

		.date-picker {
			flex-direction: column;
			gap: 12px;
		}

		.date-input {
			width: 100%;
			padding: 12px;
			font-size: 16px;
		}

		.save-button,
		.reset-button {
			width: 100%;
			padding: 12px;
			justify-content: center;
		}

		.main-content {
			gap: 16px;
		}

		.employee-input-section h2,
		.breakdown-section h2 {
			font-size: 1.1rem;
			text-align: center;
		}

		/* Remove all height constraints for natural flow */
		.employee-grid {
			max-height: none;
			overflow-y: visible;
		}

		.employee-content {
			flex-direction: column;
			gap: 12px;
			text-align: center;
		}

		.employee-info {
			align-items: center;
			width: 100%;
		}

		.employee-name {
			font-size: 16px;
			text-align: center;
		}

		.role-badge {
			align-self: center;
		}

		.input-container {
			width: 100%;
		}

		.hours-input {
			width: 100%;
			max-width: 120px;
			height: 48px;
			font-size: 20px;
		}

		/* Natural flowing layout for breakdown */
		.breakdown-section {
			max-height: none;
			overflow: visible;
		}

		.role-item {
			flex-direction: column;
			gap: 8px;
			text-align: center;
			padding: 16px;
		}

		.role-info {
			flex-direction: column;
			gap: 4px;
		}

		.role-hours {
			justify-content: center;
		}

		.bottom-stats {
			flex-direction: column;
			gap: 8px;
			padding: 12px;
		}

		.stat-item {
			flex-direction: row;
			justify-content: space-between;
			align-items: center;
			padding: 16px;
		}

		.stat-value {
			font-size: 1.5rem;
		}

		.stat-item.highlight .stat-value {
			font-size: 2rem;
		}
	}

	/* Responsive Design */
</style>
