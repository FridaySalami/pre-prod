<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { userSession } from '$lib/sessionStore';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/shadcn/components';

	// Authentication check
	let session: any = undefined;
	const unsubscribe = userSession.subscribe((s) => {
		session = s;
	});

	onMount(() => {
		// Session check will be handled by the reactive statement
		// Check for tab parameter in URL
		const urlParams = new URLSearchParams(window.location.search);
		const tabParam = urlParams.get('tab');
		if (tabParam && documentationSections.some((section) => section.id === tabParam)) {
			activeTab = tabParam;
		}
	});

	// Reactive statement to handle authentication
	$: if (session === null) {
		goto('/login');
	}

	// Tab navigation state
	let activeTab = 'overview';
	let searchQuery = '';
	let selectedCategory = 'all';

	// Filter documentation sections based on search and filters
	$: filteredSections = documentationSections.filter((section) => {
		const matchesSearch =
			searchQuery === '' ||
			section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			section.description.toLowerCase().includes(searchQuery.toLowerCase());

		const matchesCategory = selectedCategory === 'all' || section.category === selectedCategory;

		return matchesSearch && matchesCategory;
	});

	// Filter categories based on filtered sections
	$: filteredCategories = documentationCategories
		.map((category) => ({
			...category,
			sections: category.sections.filter((section) =>
				filteredSections.some((filtered) => filtered.id === section.id)
			)
		}))
		.filter((category) => category.sections.length > 0);

	// Enhanced documentation sections with better categorization
	const documentationCategories = [
		{
			name: 'Core System',
			color: 'blue',
			sections: [
				{
					id: 'overview',
					title: 'System Overview',
					icon: 'overview',
					description: 'High-level system architecture and component relationships'
				},
				{
					id: 'landing-page',
					title: 'Landing Page',
					icon: 'home',
					description: 'Main dashboard functionality and dependencies'
				},
				{
					id: 'database',
					title: 'Database Schema',
					icon: 'storage',
					description: 'Table structures, relationships, and data flow'
				}
			]
		},
		{
			name: 'Operations',
			color: 'green',
			sections: [
				{
					id: 'schedules',
					title: 'Schedule Management',
					icon: 'calendar_today',
					description: 'Staff scheduling, leave management, and weekly patterns'
				},
				{
					id: 'employee-hours',
					title: 'Employee Hours',
					icon: 'schedule',
					description: 'Hours tracking and time management system'
				},
				{
					id: 'dashboard',
					title: 'Dashboard',
					icon: 'dashboard',
					description: 'Daily operations and data upload center'
				}
			]
		},
		{
			name: 'Analytics & Reports',
			color: 'purple',
			sections: [
				{
					id: 'analytics',
					title: 'Analytics Dashboard',
					icon: 'analytics',
					description: 'Performance metrics and data visualization'
				},
				{
					id: 'monthly-analytics',
					title: 'Monthly Analytics',
					icon: 'trending_up',
					description: 'High-level performance trends and comparisons'
				}
			]
		},
		{
			name: 'Improvement & Process',
			color: 'orange',
			sections: [
				{
					id: 'kaizen-projects',
					title: 'Kaizen Projects',
					icon: 'assignment',
					description: 'Continuous improvement project management'
				},
				{
					id: 'process-map',
					title: 'Process Map',
					icon: 'account_tree',
					description: 'Visual representation of business processes'
				}
			]
		},
		{
			name: 'Support & Maintenance',
			color: 'red',
			sections: [
				{
					id: 'maintenance',
					title: 'Maintenance Guide',
					icon: 'build',
					description: 'Daily, weekly, and monthly maintenance procedures'
				},
				{
					id: 'troubleshooting',
					title: 'Troubleshooting',
					icon: 'bug_report',
					description: 'Common issues and resolution procedures'
				},
				{
					id: 'hosting-maintenance',
					title: 'Hosting & Maintenance',
					icon: 'cloud_upload',
					description: 'Deployment and maintenance guide for VS Code and Netlify'
				}
			]
		}
	];

	// Flattened sections for backward compatibility
	const documentationSections = documentationCategories.flatMap((category) =>
		category.sections.map((section) => ({
			...section,
			category: category.name,
			categoryColor: category.color
		}))
	);

	// Function to change active tab
	function setActiveTab(tabId: string) {
		activeTab = tabId;
	}

	// Navigation function for external links
	function navigateToPage(url: string) {
		goto(url);
	}
</script>

<svelte:head>
	<title>Documentation | Parker's Foodservice</title>
	<link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet" />
</svelte:head>

{#if session === undefined}
	<div class="loading-container">
		<div class="loading-spinner"></div>
		<p>Loading documentation...</p>
	</div>
{:else if session}
	<div class="documentation-container">
		<!-- Enhanced Header with Search -->
		<div class="documentation-header">
			<h1>System Documentation</h1>
			<p class="header-subtitle">
				Comprehensive guides for using and maintaining Parker's Foodservice management system
			</p>

			<!-- Search and Filter Controls -->
			<div class="search-controls">
				<div class="search-input-container">
					<i class="material-icons-outlined search-icon">search</i>
					<input
						type="text"
						placeholder="Search documentation..."
						bind:value={searchQuery}
						class="search-input"
					/>
					{#if searchQuery}
						<button class="clear-search" onclick={() => (searchQuery = '')}>
							<i class="material-icons-outlined">close</i>
						</button>
					{/if}
				</div>
				<div class="filter-controls">
					<select bind:value={selectedCategory} class="filter-select">
						<option value="all">All Categories</option>
						{#each documentationCategories as category}
							<option value={category.name}>{category.name}</option>
						{/each}
					</select>
				</div>
			</div>

			<!-- Search Results Summary -->
			{#if searchQuery || selectedCategory !== 'all'}
				<div class="results-summary">
					<span class="results-count">
						{filteredSections.length} result{filteredSections.length !== 1 ? 's' : ''} found
					</span>
					{#if filteredSections.length === 0}
						<span class="no-results">No documentation matches your search criteria</span>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Enhanced Navigation Tabs with Category Grouping -->
		<div class="tab-navigation-enhanced">
			<!-- Primary Navigation -->
			<div class="primary-nav">
				<button
					class="tab-button overview-tab {activeTab === 'overview' ? 'active' : ''}"
					onclick={() => setActiveTab('overview')}
				>
					<i class="material-icons-outlined tab-icon">overview</i>
					<span class="tab-title">Overview</span>
				</button>
			</div>

			<!-- Category-based Navigation -->
			<div class="category-nav">
				{#each documentationCategories as category}
					<div class="category-nav-section">
						<div class="category-nav-header">
							<span class="category-label {category.color}">{category.name}</span>
						</div>
						<div class="category-tabs">
							{#each category.sections as section}
								<button
									class="tab-button category-tab {activeTab === section.id
										? 'active'
										: ''} {category.color}"
									onclick={() => setActiveTab(section.id)}
								>
									<i class="material-icons-outlined tab-icon">{section.icon}</i>
									<span class="tab-title">{section.title}</span>
								</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Content Area -->
		<div class="content-area">
			{#if activeTab === 'overview'}
				<Card class="overview-card">
					<CardHeader>
						<CardTitle class="flex items-center gap-3">
							<i class="material-icons-outlined text-3xl text-blue-600">account_tree</i>
							System Architecture Overview
						</CardTitle>
						<p class="text-muted-foreground mt-2">
							Comprehensive documentation organized by functional areas for easy navigation and
							understanding.
						</p>
					</CardHeader>
					<CardContent>
						<!-- Quick Access Panel -->
						<div class="quick-access-panel">
							<h3 class="flex items-center gap-2 mb-4">
								<i class="material-icons-outlined text-xl">bolt</i>
								Quick Access
							</h3>
							<div class="quick-access-grid">
								<button class="quick-access-item" onclick={() => setActiveTab('troubleshooting')}>
									<i class="material-icons-outlined">bug_report</i>
									<span>Troubleshooting</span>
								</button>
								<button class="quick-access-item" onclick={() => setActiveTab('maintenance')}>
									<i class="material-icons-outlined">build</i>
									<span>Maintenance</span>
								</button>
								<button class="quick-access-item" onclick={() => setActiveTab('landing-page')}>
									<i class="material-icons-outlined">home</i>
									<span>Landing Page</span>
								</button>
								<button class="quick-access-item" onclick={() => setActiveTab('database')}>
									<i class="material-icons-outlined">storage</i>
									<span>Database</span>
								</button>
							</div>
						</div>

						<!-- Categorized Documentation -->
						<div class="categories-container">
							{#each filteredCategories as category}
								<div class="category-section">
									<div class="category-header {category.color}">
										<div class="category-title">
											<h3>{category.name}</h3>
											<span class="section-count">{category.sections.length} sections</span>
										</div>
									</div>
									<div class="category-grid">
										{#each category.sections as section}
											<div class="overview-item">
												<div class="overview-header">
													<i class="material-icons-outlined overview-icon">{section.icon}</i>
													<div class="section-info">
														<h4>{section.title}</h4>
													</div>
												</div>
												<p class="overview-description">{section.description}</p>
												<button class="view-docs-button" onclick={() => setActiveTab(section.id)}>
													View Documentation
												</button>
											</div>
										{/each}
									</div>
								</div>
							{/each}
						</div>

						<!-- Enhanced System Dependencies -->
						<div class="system-dependencies">
							<h3 class="flex items-center gap-2 mb-4">
								<i class="material-icons-outlined text-xl">hub</i>
								System Dependencies & Data Flow
							</h3>
							<div class="dependency-flow-enhanced">
								<div class="flow-section">
									<div class="flow-title">Data Sources</div>
									<div class="flow-items">
										<div class="dependency-item source">
											<i class="material-icons-outlined">cloud_download</i>
											<span>External APIs</span>
										</div>
										<div class="dependency-item source">
											<i class="material-icons-outlined">upload_file</i>
											<span>Manual Uploads</span>
										</div>
									</div>
								</div>
								<div class="flow-arrow-container">
									<i class="material-icons-outlined flow-arrow">arrow_forward</i>
								</div>
								<div class="flow-section">
									<div class="flow-title">Processing</div>
									<div class="flow-items">
										<div class="dependency-item process">
											<i class="material-icons-outlined">data_usage</i>
											<span>Data Validation</span>
										</div>
										<div class="dependency-item process">
											<i class="material-icons-outlined">transform</i>
											<span>ETL Pipeline</span>
										</div>
									</div>
								</div>
								<div class="flow-arrow-container">
									<i class="material-icons-outlined flow-arrow">arrow_forward</i>
								</div>
								<div class="flow-section">
									<div class="flow-title">Storage & Display</div>
									<div class="flow-items">
										<div class="dependency-item storage">
											<i class="material-icons-outlined">storage</i>
											<span>Database</span>
										</div>
										<div class="dependency-item display">
											<i class="material-icons-outlined">dashboard</i>
											<span>Dashboards</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			{:else if activeTab === 'landing-page'}
				<Card class="documentation-card">
					<CardHeader>
						<div class="card-header-with-actions">
							<CardTitle>Landing Page Documentation</CardTitle>
							<button
								class="navigate-button"
								onclick={() => navigateToPage('/landing')}
								title="Go to Landing Page"
							>
								<i class="material-icons-outlined">launch</i>
								View Page
							</button>
						</div>
					</CardHeader>
					<CardContent>
						<div class="documentation-content">
							<div class="doc-section">
								<h3>Overview</h3>
								<p>
									The landing page serves as the main dashboard for Parker's Foodservice management
									system. It provides a comprehensive view of daily operations including staff
									scheduling, leave management, performance metrics, and weather information.
								</p>
							</div>

							<div class="doc-section">
								<h3>Key Features</h3>
								<ul>
									<li>
										<strong>Weekly Staff Scheduling</strong> - Current and next week's staff assignments
									</li>
									<li>
										<strong>Upcoming Leave</strong> - Approved leave requests and coverage planning
									</li>
									<li>
										<strong>Performance Metrics</strong> - Yesterday's operational performance data
									</li>
									<li>
										<strong>Weather Widget</strong> - Current conditions and tomorrow's forecast
									</li>
								</ul>
							</div>

							<div class="doc-section">
								<h3>Data Dependencies</h3>
								<div class="dependency-table">
									<div class="dependency-row">
										<span class="dependency-source">Staff Scheduling</span>
										<span class="dependency-tables">schedules, employee_schedules, employees</span>
										<span class="dependency-frequency">Real-time</span>
									</div>
									<div class="dependency-row">
										<span class="dependency-source">Leave Management</span>
										<span class="dependency-tables">leave_requests, employees</span>
										<span class="dependency-frequency">Real-time</span>
									</div>
									<div class="dependency-row">
										<span class="dependency-source">Performance Metrics</span>
										<span class="dependency-tables">daily_metric_review, daily_metrics</span>
										<span class="dependency-frequency">Daily</span>
									</div>
									<div class="dependency-row">
										<span class="dependency-source">Weather Data</span>
										<span class="dependency-tables">WeatherAPI.com</span>
										<span class="dependency-frequency">Real-time</span>
									</div>
								</div>
							</div>

							<div class="doc-section">
								<h3>Maintenance Procedures</h3>
								<div class="maintenance-procedures">
									<div class="procedure-category">
										<h4>Daily Tasks</h4>
										<ul>
											<li>Ensure daily_metric_review table is populated with yesterday's data</li>
											<li>Verify all metrics fields are correctly calculated</li>
											<li>Monitor fallback to daily_metrics if primary data missing</li>
										</ul>
									</div>
									<div class="procedure-category">
										<h4>Weekly Tasks</h4>
										<ul>
											<li>Verify staff schedules are up-to-date</li>
											<li>Process pending leave requests</li>
											<li>Check for scheduling conflicts or gaps</li>
										</ul>
									</div>
								</div>
							</div>

							<div class="doc-section">
								<h3>Common Issues & Solutions</h3>
								<details class="troubleshooting-item">
									<summary>Staff not showing on schedule</summary>
									<div class="solution-content">
										<p>
											<strong>Symptoms:</strong> Staff missing from weekly view despite being scheduled
										</p>
										<p><strong>Common Causes:</strong></p>
										<ul>
											<li>Incorrect day_of_week mapping (DB: 0=Monday vs JS: 0=Sunday)</li>
											<li>is_working flag set to false in employee_schedules</li>
											<li>Missing employee record in employees table</li>
										</ul>
										<p>
											<strong>Resolution:</strong> Check schedule patterns and specific schedules in
											database
										</p>
									</div>
								</details>
								<details class="troubleshooting-item">
									<summary>Metrics not loading</summary>
									<div class="solution-content">
										<p>
											<strong>Symptoms:</strong> Performance metrics show zeros or loading indefinitely
										</p>
										<p><strong>Common Causes:</strong></p>
										<ul>
											<li>Missing data in daily_metric_review table</li>
											<li>Date format mismatch</li>
											<li>Database connection issues</li>
										</ul>
									</div>
								</details>
							</div>

							<div class="doc-links">
								<a href="/docs/landing-page-documentation.md" target="_blank" class="doc-link">
									<i class="material-icons-outlined">description</i>
									View Complete Documentation
								</a>
								<a href="/docs/landing-page-dependencies.md" target="_blank" class="doc-link">
									<i class="material-icons-outlined">account_tree</i>
									View Dependencies Guide
								</a>
							</div>
						</div>
					</CardContent>
				</Card>
			{:else if activeTab === 'schedules'}
				<Card class="documentation-card">
					<CardHeader>
						<div class="card-header-with-actions">
							<CardTitle>Schedule Management Documentation</CardTitle>
							<button
								class="navigate-button"
								onclick={() => navigateToPage('/schedules')}
								title="Go to Schedules Page"
							>
								<i class="material-icons-outlined">launch</i>
								View Page
							</button>
						</div>
					</CardHeader>
					<CardContent>
						<div class="documentation-content">
							<div class="doc-section">
								<h3>Overview</h3>
								<p>
									The Schedule Management system provides comprehensive workforce scheduling
									capabilities including calendar-based scheduling, employee management, leave
									tracking, and performance monitoring.
								</p>
							</div>

							<div class="doc-section">
								<h3>Key Features</h3>
								<ul>
									<li>
										<strong>Calendar Views</strong> - Month, week, and day views for schedule visualization
									</li>
									<li>
										<strong>Employee Management</strong> - Add, view, and manage employees with role-based
										organization
									</li>
									<li>
										<strong>Leave Management</strong> - Handle employee leave requests with different
										types and status tracking
									</li>
									<li>
										<strong>Weekly Patterns</strong> - Set recurring weekly schedules for employees
									</li>
									<li>
										<strong>Hour Tracking</strong> - Automatic calculation and tracking of scheduled
										work hours
									</li>
								</ul>
							</div>

							<div class="doc-section">
								<h3>User Workflows</h3>
								<div class="workflow-steps">
									<div class="workflow-category">
										<h4>Adding Employees</h4>
										<ol>
											<li>Click "Add Employee" button</li>
											<li>Fill in name and select role</li>
											<li>Submit form - data is validated before submission</li>
										</ol>
									</div>
									<div class="workflow-category">
										<h4>Creating Schedules</h4>
										<ol>
											<li>Click on a calendar date or use "Add Schedule" button</li>
											<li>Select employee, date, and shift</li>
											<li>Submit - hours are automatically calculated</li>
										</ol>
									</div>
									<div class="workflow-category">
										<h4>Managing Leave</h4>
										<ol>
											<li>Click on an employee in the calendar</li>
											<li>Select leave type and date range</li>
											<li>Submit - conflicts with existing schedules are handled</li>
										</ol>
									</div>
								</div>
							</div>

							<div class="doc-links">
								<a href="/docs/schedule-page-documentation.md" target="_blank" class="doc-link">
									<i class="material-icons-outlined">description</i>
									View Technical Documentation
								</a>
								<a href="/docs/schedule-user-guide.md" target="_blank" class="doc-link">
									<i class="material-icons-outlined">help</i>
									View User Guide
								</a>
							</div>
						</div>
					</CardContent>
				</Card>
			{:else if activeTab === 'employee-hours'}
				<Card class="documentation-card">
					<CardHeader>
						<div class="card-header-with-actions">
							<CardTitle>Employee Hours Documentation</CardTitle>
							<button
								class="navigate-button"
								onclick={() => navigateToPage('/employee-hours')}
								title="Go to Employee Hours Page"
							>
								<i class="material-icons-outlined">launch</i>
								View Page
							</button>
						</div>
					</CardHeader>
					<CardContent>
						<div class="documentation-content">
							<div class="doc-section">
								<h3>Overview</h3>
								<p>
									The Employee Hours system provides comprehensive daily hour tracking capabilities
									for all staff members. It features role-based organization, real-time
									calculations, and seamless data persistence with historical record keeping.
								</p>
							</div>

							<div class="doc-section">
								<h3>Key Features</h3>
								<ul>
									<li>
										<strong>Daily Hour Entry</strong> - Quick and intuitive hour input for all employees
									</li>
									<li>
										<strong>Role-Based Organization</strong> - Hierarchical display with managers and
										supervisors first
									</li>
									<li>
										<strong>Real-time Calculations</strong> - Automatic totals by role and overall
									</li>
									<li>
										<strong>Historical Data</strong> - View and edit hours for any previous date
									</li>
									<li>
										<strong>Unsaved Changes Detection</strong> - Visual indicators for unsaved modifications
									</li>
								</ul>
							</div>

							<div class="doc-section">
								<h3>Data Flow</h3>
								<div class="dependency-table">
									<div class="dependency-row">
										<span class="dependency-source">Employee Data</span>
										<span class="dependency-tables">employees (id, name, role)</span>
										<span class="dependency-frequency">On page load</span>
									</div>
									<div class="dependency-row">
										<span class="dependency-source">Hour Records</span>
										<span class="dependency-tables">daily_employee_hours</span>
										<span class="dependency-frequency">Per date selection</span>
									</div>
									<div class="dependency-row">
										<span class="dependency-source">Save Operations</span>
										<span class="dependency-tables">Upsert to daily_employee_hours</span>
										<span class="dependency-frequency">On user save</span>
									</div>
								</div>
							</div>

							<div class="doc-section">
								<h3>User Workflows</h3>
								<div class="workflow-steps">
									<div class="workflow-category">
										<h4>Daily Hour Entry</h4>
										<ol>
											<li>Select date (defaults to today)</li>
											<li>Enter hours for each employee (0-24 hours, 0.5 increments)</li>
											<li>Review role-based totals and grand total</li>
											<li>Click "Save Hours" to persist data</li>
										</ol>
									</div>
									<div class="workflow-category">
										<h4>Viewing Historical Data</h4>
										<ol>
											<li>Use date picker to select previous date</li>
											<li>System automatically loads existing hours</li>
											<li>Edit as needed and save changes</li>
										</ol>
									</div>
								</div>
							</div>

							<div class="doc-section">
								<h3>Technical Details</h3>
								<div class="tech-details">
									<h4>Authentication & Security</h4>
									<ul>
										<li>Requires valid user session - redirects to login if unauthenticated</li>
										<li>Input validation: hours must be 0-24, increments of 0.5</li>
										<li>Parameterized database queries prevent SQL injection</li>
									</ul>
									<h4>Performance Features</h4>
									<ul>
										<li>Reactive state management with Svelte's $state and $derived</li>
										<li>Efficient sorting: role priority then alphabetical by surname</li>
										<li>Change detection prevents unnecessary saves</li>
									</ul>
								</div>
							</div>

							<div class="doc-links">
								<a href="/docs/employee-hours-documentation.md" target="_blank" class="doc-link">
									<i class="material-icons-outlined">description</i>
									View Complete Technical Documentation
								</a>
							</div>
						</div>
					</CardContent>
				</Card>
			{:else if activeTab === 'analytics'}
				<Card class="documentation-card">
					<CardHeader>
						<div class="card-header-with-actions">
							<CardTitle>Analytics Dashboard Documentation</CardTitle>
							<button
								class="navigate-button"
								onclick={() => navigateToPage('/analytics')}
								title="Go to Analytics Dashboard"
							>
								<i class="material-icons-outlined">launch</i>
								View Page
							</button>
						</div>
					</CardHeader>
					<CardContent>
						<div class="documentation-content">
							<div class="doc-section">
								<h3>Overview</h3>
								<p>
									The Analytics Dashboard is a comprehensive business intelligence system providing
									real-time insights into sales performance, order metrics, and operational
									efficiency. It serves as the central hub for data-driven decision making.
								</p>
							</div>

							<div class="doc-section">
								<h3>Dashboard Tabs</h3>
								<ul>
									<li>
										<strong>Daily Products</strong> - Detailed order analysis with SKU-level filtering
										and date ranges
									</li>
									<li>
										<strong>Daily Sales</strong> - Multi-channel sales performance with profit analysis
									</li>
									<li>
										<strong>Monthly Dashboard</strong> - Advanced historical analysis and trend forecasting
									</li>
									<li>
										<strong>Duplicated Daily Products</strong> - Quality control for product data integrity
									</li>
								</ul>
							</div>

							<div class="doc-section">
								<h3>Key Metrics Tracked</h3>
								<div class="metrics-grid">
									<div class="metric-category">
										<h4>Sales Performance</h4>
										<ul>
											<li>Total Sales (Amazon, eBay, Shopify, Other)</li>
											<li>Order Count and Average Order Value</li>
											<li>Profit Margins and Total Profit</li>
										</ul>
									</div>
									<div class="metric-category">
										<h4>Operational Metrics</h4>
										<ul>
											<li>Labor Efficiency Calculations</li>
											<li>Hours Worked vs. Sales Performance</li>
											<li>Channel-specific Performance</li>
										</ul>
									</div>
								</div>
							</div>

							<div class="doc-section">
								<h3>Advanced Features</h3>
								<div class="advanced-features">
									<h4>Historical Analysis</h4>
									<ul>
										<li>Statistical significance testing for trends</li>
										<li>Weekday-specific historical comparisons</li>
										<li>Predictive analytics and forecasting</li>
										<li>Interactive chart visualizations</li>
									</ul>
									<h4>Data Integration</h4>
									<ul>
										<li>Real-time Linnworks API integration</li>
										<li>Automated daily metric updates</li>
										<li>Multi-source data aggregation</li>
									</ul>
								</div>
							</div>

							<div class="doc-section">
								<h3>Maintenance & Updates</h3>
								<div class="maintenance-info">
									<p>
										<strong>Daily Metric Updates:</strong> Use the "Update Daily Metrics" button to sync
										current sales data with the metric review system.
									</p>
									<p>
										<strong>Data Refresh:</strong> Sales data refreshes automatically when changing date
										ranges or tabs.
									</p>
								</div>
							</div>

							<div class="doc-links">
								<a
									href="/docs/analytics-dashboard-documentation.md"
									target="_blank"
									class="doc-link"
								>
									<i class="material-icons-outlined">description</i>
									View Complete Technical Documentation
								</a>
								<a href="/analytics/monthly" class="doc-link">
									<i class="material-icons-outlined">trending_up</i>
									View Monthly Dashboard
								</a>
							</div>
						</div>
					</CardContent>
				</Card>
			{:else if activeTab === 'dashboard'}
				<Card class="documentation-card">
					<CardHeader>
						<div class="card-header-with-actions">
							<CardTitle>Dashboard Documentation</CardTitle>
							<button
								class="navigate-button"
								onclick={() => navigateToPage('/dashboard')}
								title="Go to Dashboard"
							>
								<i class="material-icons-outlined">launch</i>
								View Page
							</button>
						</div>
					</CardHeader>
					<CardContent>
						<div class="documentation-content">
							<div class="doc-section">
								<h3>Overview</h3>
								<p>
									The Dashboard is the central hub for daily operations, providing a real-time
									overview of key performance indicators. It is the primary interface for uploading
									and reviewing daily metric data, which is crucial for monitoring the business's
									health.
								</p>
							</div>

							<div class="doc-section">
								<h3>Daily Metric Review Upload</h3>
								<p>
									A key function of this page is the
									<code>daily_metric_review</code>
									data upload. This data is compiled from various sources and is essential for generating
									the daily reports and analytics used across the site.
								</p>
								<h4>Linnworks Order Processing Dependency</h4>
								<p>
									The data for the
									<code>daily_metric_review</code>
									is heavily dependent on the order processing cycle in Linnworks, our order management
									system. The final order data for a given day is not available until after 4:30 PM.
								</p>
								<p>
									<strong>IMPORTANT:</strong>
									The
									<code>daily_metric_review</code>
									data for a given day should not be uploaded until after 4:30 PM. Uploading data before
									this time will result in incomplete and inaccurate reporting for the day.
								</p>
							</div>

							<div class="doc-links">
								<a href="/docs/dashboard-documentation.md" target="_blank" class="doc-link">
									<i class="material-icons-outlined">description</i>
									View Complete Documentation
								</a>
							</div>
						</div>
					</CardContent>
				</Card>
			{:else if activeTab === 'monthly-analytics'}
				<Card class="documentation-card">
					<CardHeader>
						<div class="card-header-with-actions">
							<CardTitle>Monthly Analytics Documentation</CardTitle>
							<button
								class="navigate-button"
								onclick={() => navigateToPage('/analytics/monthly')}
								title="Go to Monthly Analytics"
							>
								<i class="material-icons-outlined">launch</i>
								View Page
							</button>
						</div>
					</CardHeader>
					<CardContent>
						<div class="documentation-content">
							<div class="doc-section">
								<h3>Overview</h3>
								<p>
									The Monthly Analytics page is a powerful tool for strategic business analysis,
									providing a high-level overview of key performance indicators (KPIs) on a
									month-over-month and year-over-year basis. It allows you to identify long-term
									trends, assess the impact of business decisions, and understand seasonal patterns
									in sales and profitability.
								</p>
							</div>

							<div class="doc-section">
								<h3>Key Features</h3>
								<ul>
									<li>
										<strong>Monthly KPI Dashboard</strong>: Displays critical metrics like Total
										Sales, Orders, AOV, and Profit.
									</li>
									<li>
										<strong>Comparative Analysis</strong>: Compares selected month against the
										previous month and the same month last year.
									</li>
									<li>
										<strong>Percentage Change Indicators</strong>: Visualizes performance changes
										with color-coded percentages.
									</li>
									<li>
										<strong>Date Navigation</strong>: Easily navigate to any month with historical
										data.
									</li>
								</ul>
							</div>

							<div class="doc-section">
								<h3>How to Use</h3>
								<div class="workflow-steps">
									<div class="workflow-category">
										<h4>1. Select a Date</h4>
										<p>Use the dropdowns to choose the month and year to analyze.</p>
									</div>
									<div class="workflow-category">
										<h4>2. Review Metrics</h4>
										<p>
											Examine the five key metrics: Total Sales, Total Orders, AOV, Total Profit,
											and Profit Margin.
										</p>
									</div>
									<div class="workflow-category">
										<h4>3. Interpret Comparisons</h4>
										<p>
											Use the 'vs. Previous Month' and 'vs. Same Month, Last Year' percentages to
											track short-term momentum and long-term growth.
										</p>
									</div>
								</div>
							</div>

							<div class="doc-section">
								<h3>Data Source</h3>
								<p>
									The data is sourced from the <code>historical_sales_data</code> table, which contains
									aggregated daily sales data. For daily details, refer to the main "Daily Sales" tab.
								</p>
							</div>

							<div class="doc-links">
								<a href="/docs/monthly-analytics-documentation.md" target="_blank" class="doc-link">
									<i class="material-icons-outlined">description</i>
									View Complete Documentation
								</a>
							</div>
						</div>
					</CardContent>
				</Card>
			{:else if activeTab === 'kaizen-projects'}
				<Card class="documentation-card">
					<CardHeader>
						<div class="card-header-with-actions">
							<CardTitle>Kaizen Projects Documentation</CardTitle>
							<button
								class="navigate-button"
								onclick={() => navigateToPage('/kaizen-projects')}
								title="Go to Kaizen Projects"
							>
								<i class="material-icons-outlined">launch</i>
								View Page
							</button>
						</div>
					</CardHeader>
					<CardContent>
						<div class="documentation-content">
							<div class="doc-section">
								<h3>Overview</h3>
								<p>
									The Kaizen Projects page is a dynamic and interactive tool designed to manage
									continuous improvement ideas from submission to completion. It utilizes a
									Kanban-style board, providing a clear visual workflow for tracking the status of
									each project.
								</p>
							</div>

							<div class="doc-section">
								<h3>Key Features</h3>
								<ul>
									<li><strong>Kanban Board</strong>: Visual workflow with four status columns.</li>
									<li><strong>Drag-and-Drop</strong>: Easily update project status.</li>
									<li><strong>Project Submission</strong>: Simple form to submit new ideas.</li>
									<li>
										<strong>Detail Panel</strong>: View details, comments, and project history.
									</li>
									<li><strong>Collaboration</strong>: Commenting and voting systems.</li>
								</ul>
							</div>

							<div class="doc-section">
								<h3>How to Use</h3>
								<div class="workflow-steps">
									<div class="workflow-category">
										<h4>1. Submit an Idea</h4>
										<p>Click "Submit New", fill out the form, and your idea appears.</p>
									</div>
									<div class="workflow-category">
										<h4>2. Track Progress</h4>
										<p>Drag and drop cards between columns to update status.</p>
									</div>
									<div class="workflow-category">
										<h4>3. Collaborate</h4>
										<p>Click a card to open details, add comments, and vote.</p>
									</div>
								</div>
							</div>

							<div class="doc-links">
								<a href="/docs/kaizen-projects-documentation.md" target="_blank" class="doc-link">
									<i class="material-icons-outlined">description</i>
									View Complete Documentation
								</a>
							</div>
						</div>
					</CardContent>
				</Card>
			{:else if activeTab === 'process-map'}
				<Card class="documentation-card">
					<CardHeader>
						<div class="card-header-with-actions">
							<CardTitle>Process Map Documentation</CardTitle>
							<button
								class="navigate-button"
								onclick={() => navigateToPage('/process-map')}
								title="Go to Process Map"
							>
								<i class="material-icons-outlined">launch</i>
								View Page
							</button>
						</div>
					</CardHeader>
					<CardContent>
						<div class="documentation-content">
							<div class="doc-section">
								<h3>Overview</h3>
								<p>
									The Process Map page provides a high-level visual representation of the key
									business workflows at Parker's Foodservice. It is designed to offer a clear and
									intuitive understanding of how different operational areas connect, from order
									processing to dispatch. This tool is essential for training, process analysis, and
									identifying opportunities for improvement.
								</p>
							</div>

							<div class="doc-section">
								<h3>Key Components</h3>
								<ul>
									<li>
										<strong>Order Reception</strong> - How orders are received from different channels
										(Amazon, eBay, Shopify, etc.).
									</li>
									<li>
										<strong>Order Processing</strong> - The steps taken to process orders in Linnworks,
										including stock allocation and payment verification.
									</li>
									<li>
										<strong>Picking & Packing</strong> - The warehouse process for gathering items and
										preparing them for shipment.
									</li>
									<li>
										<strong>Dispatch</strong> - The final stage where packages are handed over to carriers
										for delivery.
									</li>
								</ul>
							</div>

							<div class="doc-section">
								<h3>How to Use the Process Map</h3>
								<div class="workflow-steps">
									<div class="workflow-category">
										<h4>Navigating the Map</h4>
										<ol>
											<li>
												<strong>View the Flow</strong> - Follow the arrows to understand the standard
												sequence of operations.
											</li>
											<li>
												<strong>Click for Details</strong> - Click on any process block to view a popup
												with more detailed information.
											</li>
										</ol>
									</div>
									<div class="workflow-category">
										<h4>Using the Map for Analysis</h4>
										<ol>
											<li>
												<strong>Identify Bottlenecks</strong> - Visualize the workflow to spot potential
												bottlenecks.
											</li>
											<li>
												<strong>Training New Staff</strong> - Use the map as a resource for new employee
												onboarding.
											</li>
											<li>
												<strong>Process Improvement</strong> - Use the map as a starting point for Kaizen
												(continuous improvement) discussions.
											</li>
										</ol>
									</div>
								</div>
							</div>

							<div class="doc-links">
								<a href="/docs/process-map-documentation.md" target="_blank" class="doc-link">
									<i class="material-icons-outlined">description</i>
									View Complete Documentation
								</a>
							</div>
						</div>
					</CardContent>
				</Card>
			{:else if activeTab === 'hosting-maintenance'}
				<Card class="documentation-card">
					<CardHeader>
						<CardTitle>Hosting & Maintenance Guide</CardTitle>
					</CardHeader>
					<CardContent>
						<div class="documentation-content">
							<div class="doc-section">
								<h3>🛟 In Case of Emergency: Website Continuity & Access</h3>
								<p>
									If Jack Weston becomes unavailable due to accident, illness, or sudden
									disappearance (e.g., sea kraken, goat stampede), the following steps can be taken
									by Parker’s Foodservice to regain full control and maintain operations for
									<strong>chefstorecookbook.com</strong> and its subdomain
									<code>operations.chefstorecookbook.com</code>.
								</p>
							</div>
							<hr />
							<div class="doc-section">
								<h3>📁 GitHub Repository</h3>
								<ul>
									<li>
										<strong>Main repo URL:</strong>
										<a
											href="https://github.com/FridaySalami/pre-prod"
											target="_blank"
											rel="noopener noreferrer">https://github.com/FridaySalami/pre-prod</a
										>
									</li>
									<li>
										<strong>Maintainer Access:</strong>
										<code>paul.n@parkersfoodservice.co.uk</code> is already added as a
										<strong>Maintainer</strong>.
									</li>
									<li>
										<strong>Action if more access is needed:</strong> Contact GitHub support to
										escalate ownership via email domain proof (<code>@parkersfoodservice.co.uk</code
										>).
									</li>
								</ul>
							</div>
							<hr />
							<div class="doc-section">
								<h3>☁️ Netlify Hosting</h3>
								<ul>
									<li><strong>Site URL:</strong> <code>jackweston.netlify.app</code></li>
									<li>
										<strong>Linked domain:</strong> <code>operations.chefstorecookbook.com</code>
									</li>
									<li>
										<strong>Build source:</strong> Connected to GitHub <code>main</code> branch for continuous
										deployment.
									</li>
									<li>
										<strong>Owner Email:</strong> <code>jack.w@parkersfoodservice.co.uk</code>
									</li>
									<li>
										<strong>Password Access:</strong> Known by the team (do <strong>not</strong> include
										here; stored securely).
									</li>
								</ul>
								<h4>Recovery Steps:</h4>
								<ul>
									<li>Use email recovery on Netlify.com if login fails.</li>
									<li>
										If required, Netlify can transfer site ownership if proof of domain and GitHub
										control is shown.
									</li>
								</ul>
							</div>
							<hr />
							<div class="doc-section">
								<h3>🧾 Supabase (Backend)</h3>
								<ul>
									<li>
										<strong>Project:</strong> Supabase connected with Netlify via public environment
										variables.
									</li>
									<li><strong>Free Plan:</strong> No billing, no critical payment risk.</li>
									<li>
										<strong>Access URL:</strong>
										<a href="https://supabase.com" target="_blank" rel="noopener noreferrer"
											>https://supabase.com</a
										>
										→ login with <code>jack.w@parkersfoodservice.co.uk</code>
									</li>
									<li>
										<strong>Keys needed in Netlify:</strong>
										<ul>
											<li><code>PUBLIC_SUPABASE_URL</code></li>
											<li><code>PUBLIC_SUPABASE_ANON_KEY</code></li>
										</ul>
									</li>
									<li>
										<strong>Stored in:</strong> Netlify > Site Settings > Build & Deploy > Environment
										Variables
									</li>
								</ul>
							</div>
							<hr />
							<div class="doc-section">
								<h3>🌐 Domain Hosting</h3>
								<ul>
									<li>
										<strong>Registrar:</strong>
										<a href="https://porkbun.com" target="_blank" rel="noopener noreferrer"
											>Porkbun.com</a
										>
									</li>
									<li><strong>Domain:</strong> <code>chefstorecookbook.com</code></li>
									<li>
										<strong>Subdomain:</strong> <code>operations.chefstorecookbook.com</code> →
										CNAME to <code>jackweston.netlify.app</code>
									</li>
									<li>
										<strong>Owner Email:</strong> <code>jack.w@parkersfoodservice.co.uk</code>
									</li>
									<li>
										<strong>Screenshots:</strong> DNS settings and contact are correct (stored securely).
									</li>
									<li><strong>Billing:</strong> Registered until May 2026, renews ~$11/yr</li>
								</ul>
							</div>
							<hr />
							<div class="doc-section">
								<h3>🔐 Summary Access List</h3>
								<div class="table-container">
									<table>
										<thead>
											<tr>
												<th>Component</th>
												<th>Email / Login</th>
												<th>Access Level</th>
												<th>Recovery Method</th>
											</tr>
										</thead>
										<tbody>
											<tr>
												<td>GitHub</td>
												<td><code>paul.n@parkersfoodservice.co.uk</code></td>
												<td>Maintainer</td>
												<td>GitHub support if needed</td>
											</tr>
											<tr>
												<td>Netlify</td>
												<td><code>jack.w@parkersfoodservice.co.uk</code></td>
												<td>Owner</td>
												<td>Password known to team</td>
											</tr>
											<tr>
												<td>Supabase</td>
												<td><code>jack.w@parkersfoodservice.co.uk</code></td>
												<td>Owner</td>
												<td>Password recovery</td>
											</tr>
											<tr>
												<td>Porkbun Domain</td>
												<td><code>jack.w@parkersfoodservice.co.uk</code></td>
												<td>Owner</td>
												<td>Email access + screenshots</td>
											</tr>
										</tbody>
									</table>
								</div>
							</div>
							<hr />
							<div class="doc-section">
								<h3>📦 Optional Final Step</h3>
								<p>If you want to make this extra bulletproof:</p>
								<ul>
									<li>Print this document + credentials.</li>
									<li>
										Put it in a sealed envelope in a safe location labeled:
										<blockquote>"Open if Jack sails into the fog."</blockquote>
									</li>
								</ul>
								<p>
									Or upload this doc (minus passwords) to a shared drive with backup contacts
									listed.
								</p>
							</div>

							<hr class="section-divider" />

							<div class="doc-section">
								<h3>1. Visual Studio Code Setup</h3>
								<p>
									For the best development experience, it is recommended to install the following VS
									Code extensions. These will provide syntax highlighting, code completion, and
									error checking for the technologies used in this project.
								</p>
								<div class="tech-details">
									<h4>Recommended Extensions</h4>
									<ul>
										<li>
											<strong>Svelte for VS Code</strong> (<code>svelte.svelte-vscode</code>) -
											Provides full support for Svelte development.
										</li>
										<li>
											<strong>ESLint</strong> (<code>dbaeumer.vscode-eslint</code>) - Integrates
											ESLint to help identify and fix code quality issues.
										</li>
										<li>
											<strong>Prettier - Code formatter</strong> (<code>esbenp.prettier-vscode</code
											>) - Automatically formats code to maintain a consistent style.
										</li>
										<li>
											<strong>Tailwind CSS IntelliSense</strong> (<code
												>bradlc.vscode-tailwindcss</code
											>) - Enhances the Tailwind CSS development experience with autocompletion and
											linting.
										</li>
									</ul>
								</div>
							</div>

							<div class="doc-section">
								<h3>2. GitHub Workflow</h3>
								<p>
									This project uses Git for version control, hosted on GitHub. The following
									commands outline the standard workflow for making changes and deploying them.
								</p>
								<div class="code-block">
									{@html `
									<pre><code># 1. Pull the latest changes from the main branch
git pull origin main

# 2. Make your code changes

# 3. Stage your changes for commit
git add .

# 4. Commit your changes with a descriptive message
git commit -m "Your detailed commit message here"

# 5. Push your changes to the main branch on GitHub
git push origin main</code></pre>
									`}
								</div>
							</div>

							<div class="doc-section">
								<h3>3. Netlify Deployment</h3>
								<p>
									The website is hosted on Netlify and is configured for continuous deployment. When
									you push changes to the <code>main</code> branch on GitHub, Netlify will automatically
									build and deploy the new version of the site.
								</p>
								<div class="tech-details">
									<h4>Build Configuration</h4>
									<ul>
										<li><strong>Build Command:</strong> <code>npm run build</code></li>
										<li><strong>Publish Directory:</strong> <code>build/</code></li>
									</ul>
								</div>
								<div class="maintenance-info">
									<h4>Environment Variables</h4>
									<p>
										For the application to connect to the Supabase database, the following
										environment variables must be configured in the Netlify UI under "Site settings"
										> "Build & deploy" > "Environment":
									</p>
									<ul>
										<li><code>PUBLIC_SUPABASE_URL</code>: The URL for your Supabase project.</li>
										<li>
											<code>PUBLIC_SUPABASE_ANON_KEY</code>: The anonymous key for your Supabase
											project.
										</li>
									</ul>
									<p>
										These keys can be found in your Supabase project dashboard under "Project
										Settings" > "API".
									</p>
								</div>
							</div>

							<div class="doc-section">
								<h3>4. Common Issues & Troubleshooting</h3>
								<details class="troubleshooting-item">
									<summary>Build fails on Netlify</summary>
									<div class="solution-content">
										<p>
											<strong>Symptoms:</strong> The Netlify build process fails with an error message
											in the deploy logs.
										</p>
										<p><strong>Common Causes:</strong></p>
										<ul>
											<li>
												<strong>Missing Dependencies:</strong> A new package was added to the
												project, but the <code>package.json</code> or
												<code>package-lock.json</code> file was not updated correctly.
											</li>
											<li>
												<strong>Build Script Errors:</strong> There is a syntax error or other issue
												in the code that prevents the <code>npm run build</code> command from completing
												successfully.
											</li>
											<li>
												<strong>Incorrect Environment Variables:</strong> The Supabase URL or anonymous
												key is missing or incorrect in the Netlify settings.
											</li>
										</ul>
										<p>
											<strong>Resolution:</strong> Check the Netlify deploy logs for the specific
											error message. Run the <code>npm run build</code> command locally to see if it
											reproduces the error.
										</p>
									</div>
								</details>
								<details class="troubleshooting-item">
									<summary>Changes not appearing on the live site</summary>
									<div class="solution-content">
										<p>
											<strong>Symptoms:</strong> You have pushed changes to the GitHub repository, but
											the live site does not reflect the updates.
										</p>
										<p><strong>Common Causes:</strong></p>
										<ul>
											<li>
												<strong>Build is Still in Progress:</strong> The Netlify build may not have completed
												yet. Check the deploy status in the Netlify UI.
											</li>
											<li>
												<strong>Build Failed:</strong> The latest build failed, so Netlify is still serving
												the previous successful deployment.
											</li>
											<li>
												<strong>Caching Issues:</strong> Your browser may be caching the old version
												of the site. Try a hard refresh (Ctrl+Shift+R or Cmd+Shift+R) or clearing your
												browser cache.
											</li>
										</ul>
									</div>
								</details>
							</div>
						</div>
					</CardContent>
				</Card>
			{:else if activeTab === 'database'}
				<div data-section="database">
					<Card class="documentation-card">
						<CardHeader>
							<CardTitle>Database Schema Documentation</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="documentation-content">
								<div class="doc-section">
									<h3>Overview</h3>
									<p>
										The database schema for Parker's Foodservice management system is designed to
										support the application's data storage and retrieval needs. It is built on
										PostgreSQL and includes tables for managing users, roles, permissions, and
										application-specific data such as schedules, employee hours, and performance
										metrics.
									</p>
								</div>

								<div class="doc-section">
									<h3>Key Tables</h3>
									<div class="table-groups">
										<div class="table-group">
											<h4>Users and Roles</h4>
											<ul>
												<li>
													<code>users</code> - Stores user account information.
												</li>
												<li>
													<code>roles</code> - Defines roles for user access control.
												</li>
												<li>
													<code>permissions</code> - Specifies permissions for each role.
												</li>
											</ul>
										</div>

										<div class="table-group">
											<h4>Scheduling and Time Management</h4>
											<ul>
												<li>
													<code>schedules</code> - Contains schedule templates for employees.
												</li>
												<li>
													<code>employee_schedules</code> - Links employees to their schedules.
												</li>
												<li>
													<code>daily_employee_hours</code> - Records daily hours worked by employees.
												</li>
											</ul>
										</div>

										<div class="table-group">
											<h4>Performance Metrics</h4>
											<ul>
												<li>
													<code>daily_metric_review</code> - Aggregated performance metrics for each
													day.
												</li>
												<li>
													<code>monthly_metrics</code> - Monthly aggregated metrics for trend analysis.
												</li>
											</ul>
										</div>

										<div class="table-group">
											<h4>Miscellaneous</h4>
											<ul>
												<li>
													<code>leave_requests</code> - Stores employee leave requests.
												</li>
												<li>
													<code>weather_data</code> - Cached weather data for the weather widget.
												</li>
											</ul>
										</div>
									</div>
								</div>

								<div class="doc-section">
									<h3>Relationships</h3>
									<div class="relationships-info">
										<p>The database schema includes the following key relationships:</p>
										<ul>
											<li>
												<strong>Users and Roles:</strong> The <code>users</code> table is linked to
												the
												<code>roles</code> table via the <code>role_id</code> foreign key.
											</li>
											<li>
												<strong>Schedules and Employees:</strong> The <code>schedules</code> table
												is linked to the <code>employee_schedules</code> table via the
												<code>schedule_id</code> foreign key.
											</li>
											<li>
												<strong>Daily Metrics:</strong> The <code>daily_metric_review</code> table
												is linked to the <code>users</code> table to associate metrics with users.
											</li>
										</ul>
										<p>
											Refer to the ERD (Entity-Relationship Diagram) for a visual representation of
											the database schema.
										</p>
									</div>
								</div>

								<div class="doc-links">
									<a href="/docs/database-schema-documentation.md" target="_blank" class="doc-link">
										<i class="material-icons-outlined">description</i>
										View Complete Documentation
									</a>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			{:else if activeTab === 'maintenance'}
				<div data-section="maintenance">
					<Card class="documentation-card">
						<CardHeader>
							<CardTitle>Maintenance Guide</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="documentation-content">
								<div class="doc-section">
									<h3>Overview</h3>
									<p>
										Regular maintenance is essential for optimal performance of the Parker's
										Foodservice management system. This guide provides structured maintenance
										procedures organized by frequency and importance to ensure system reliability
										and data integrity.
									</p>
								</div>

								<div class="doc-section">
									<h3>Daily Maintenance Tasks</h3>
									<div class="maintenance-schedule">
										<div class="task-category">
											<h4>🌅 Morning Tasks (Start of Business Day)</h4>
											<div class="task-checklist">
												<div class="task-item">
													<h5>System Health Check</h5>
													<ul>
														<li>Verify landing page loads correctly with current data</li>
														<li>Check that yesterday's performance metrics are populated</li>
														<li>Confirm staff schedules display properly for today and tomorrow</li>
														<li>Test weather widget functionality</li>
													</ul>
												</div>
												<div class="task-item">
													<h5>Data Verification</h5>
													<ul>
														<li>Verify `daily_metric_review` table has yesterday's data</li>
														<li>Check that employee schedules match actual staffing</li>
														<li>Review any pending leave requests</li>
														<li>Confirm employee hours data from previous day is complete</li>
													</ul>
												</div>
											</div>
										</div>

										<div class="task-category">
											<h4>🌆 End of Day Tasks</h4>
											<div class="task-checklist">
												<div class="task-item">
													<h5>Data Entry Completion</h5>
													<ul>
														<li>Ensure all employee hours are entered and saved</li>
														<li>Verify sales data synchronization from Linnworks</li>
														<li>Update daily metrics if necessary</li>
														<li>Process any new leave requests or schedule changes</li>
													</ul>
												</div>
												<div class="task-item">
													<h5>System Status Review</h5>
													<ul>
														<li>Check browser console for any error messages</li>
														<li>Review application performance during peak usage</li>
														<li>Verify all user sessions ended properly</li>
													</ul>
												</div>
											</div>
										</div>
									</div>
								</div>

								<div class="doc-section">
									<h3>Weekly Maintenance Tasks</h3>
									<div class="maintenance-schedule">
										<div class="task-category">
											<h4>📋 Every Monday</h4>
											<div class="task-checklist">
												<div class="task-item">
													<h5>Schedule Management</h5>
													<ul>
														<li>Review and finalize schedules for the coming week</li>
														<li>Check for any schedule conflicts or gaps</li>
														<li>Update schedule patterns if needed</li>
														<li>Process approved leave requests</li>
													</ul>
												</div>
												<div class="task-item">
													<h5>Data Integrity</h5>
													<ul>
														<li>Run database integrity checks</li>
														<li>Archive old employee hours data (older than 2 years)</li>
														<li>Clean up orphaned schedule records</li>
														<li>Verify employee records are up to date</li>
													</ul>
												</div>
											</div>
										</div>

										<div class="task-category">
											<h4>📊 Every Friday</h4>
											<div class="task-checklist">
												<div class="task-item">
													<h5>Performance Review</h5>
													<ul>
														<li>Analyze week's performance metrics</li>
														<li>Review analytics dashboard for trends</li>
														<li>Check system response times and performance</li>
														<li>Document any recurring issues</li>
													</ul>
												</div>
												<div class="task-item">
													<h5>Preparation for Next Week</h5>
													<ul>
														<li>Preview next week's schedules</li>
														<li>Prepare for any known system maintenance</li>
														<li>Review upcoming leave requests</li>
													</ul>
												</div>
											</div>
										</div>
									</div>
								</div>

								<div class="doc-section">
									<h3>Monthly Maintenance Tasks</h3>
									<div class="maintenance-schedule">
										<div class="task-category">
											<h4>🗓️ First Monday of Each Month</h4>
											<div class="task-checklist">
												<div class="task-item">
													<h5>System Optimization</h5>
													<ul>
														<li>Review database performance statistics</li>
														<li>Update database table statistics and indexes</li>
														<li>Archive old historical sales data</li>
														<li>Clean up expired user sessions</li>
													</ul>
												</div>
												<div class="task-item">
													<h5>Security & Access Review</h5>
													<ul>
														<li>Review user access permissions</li>
														<li>Check for any security updates needed</li>
														<li>Verify backup procedures are working</li>
														<li>Test disaster recovery procedures</li>
													</ul>
												</div>
											</div>
										</div>

										<div class="task-category">
											<h4>📈 Mid-Month Analysis</h4>
											<div class="task-checklist">
												<div class="task-item">
													<h5>Trend Analysis</h5>
													<ul>
														<li>Generate monthly performance reports</li>
														<li>Analyze seasonal trends and patterns</li>
														<li>Review staffing efficiency metrics</li>
														<li>Document insights for management</li>
													</ul>
												</div>
											</div>
										</div>
									</div>
								</div>

								<div class="doc-section">
									<h3>Emergency Procedures</h3>
									<div class="emergency-procedures">
										<div class="procedure-category">
											<h4>⚠️ System Outage Response</h4>
											<ol>
												<li>
													<strong>Immediate Assessment</strong> - Check Supabase status and hosting provider
												</li>
												<li>
													<strong>Communication</strong> - Notify affected users of the issue
												</li>
												<li>
													<strong>Diagnosis</strong> - Review recent changes and error logs
												</li>
												<li>
													<strong>Resolution</strong> - Implement fix or rollback as appropriate
												</li>
												<li>
													<strong>Verification</strong> - Test all critical functions before declaring
													resolved
												</li>
												<li>
													<strong>Documentation</strong> - Record incident details and lessons learned
												</li>
											</ol>
										</div>

										<div class="procedure-category">
											<h4>🔄 Data Recovery Process</h4>
											<ol>
												<li>
													<strong>Stop Operations</strong> - Prevent further data corruption
												</li>
												<li>
													<strong>Assess Damage</strong> - Determine scope and timing of data loss
												</li>
												<li>
													<strong>Backup Recovery</strong> - Restore from most recent valid backup
												</li>
												<li>
													<strong>Data Verification</strong> - Verify restored data integrity
												</li>
												<li>
													<strong>User Communication</strong> - Inform users of any data gaps
												</li>
												<li>
													<strong>Process Review</strong> - Update procedures to prevent recurrence
												</li>
											</ol>
										</div>
									</div>
								</div>

								<div class="doc-section">
									<h3>Maintenance Tools & Commands</h3>
									<div class="maintenance-tools">
										<div class="tool-category">
											<h4>Database Maintenance</h4>
											<div class="code-block">
												{@html `
												<pre><code>-- Archive old employee hours (run monthly)
DELETE FROM daily_employee_hours WHERE date &lt; NOW() - INTERVAL '2 years';

-- Clean up orphaned schedules  
DELETE FROM employee_schedules WHERE employee_id NOT IN (SELECT id FROM employees);

-- Update table statistics
ANALYZE daily_metric_review, daily_employee_hours, employee_schedules;</code></pre>
											`}
											</div>
										</div>

										<div class="tool-category">
											<h4>System Health Checks</h4>
											<div class="code-block">
												{@html `
												<pre><code>-- Check recent metric updates
SELECT date, total_sales FROM daily_metric_review ORDER BY date DESC LIMIT 7;

-- Verify employee data integrity
SELECT COUNT(*) as total_employees FROM employees WHERE active = true;</code></pre>
											`}
											</div>
										</div>
									</div>
								</div>

								<div class="doc-links">
									<a
										href="/docs/maintenance-guide-documentation.md"
										target="_blank"
										class="doc-link"
									>
										<i class="material-icons-outlined">description</i>
										View Complete Maintenance Guide
									</a>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			{:else if activeTab === 'troubleshooting'}
				<div data-section="troubleshooting">
					<Card class="documentation-card">
						<CardHeader>
							<CardTitle>Troubleshooting Guide</CardTitle>
						</CardHeader>
						<CardContent>
							<div class="documentation-content">
								<div class="doc-section">
									<h3>Overview</h3>
									<p>
										This comprehensive troubleshooting guide covers common issues encountered in the
										Parker's Foodservice management system and provides step-by-step resolution
										procedures. Use this guide to quickly diagnose and resolve problems.
									</p>
								</div>

								<div class="doc-section">
									<h3>Authentication Issues</h3>
									<details class="troubleshooting-item">
										<summary>User Cannot Log In</summary>
										<div class="troubleshooting-content">
											<p>
												<strong>Symptoms:</strong> Login page shows error or redirects back repeatedly
											</p>
											<p><strong>Common Causes:</strong></p>
											<ul>
												<li>Invalid credentials in Supabase</li>
												<li>Session storage issues</li>
												<li>Browser cookies disabled</li>
												<li>Network connectivity problems</li>
											</ul>
											<p><strong>Resolution Steps:</strong></p>
											<ol>
												<li>Verify user exists in Supabase Auth dashboard</li>
												<li>Clear browser storage and cookies</li>
												<li>Check network connectivity</li>
												<li>Verify Supabase project configuration</li>
												<li>Check browser console for authentication errors</li>
											</ol>
										</div>
									</details>

									<details class="troubleshooting-item">
										<summary>Session Expires Frequently</summary>
										<div class="troubleshooting-content">
											<p><strong>Symptoms:</strong> User gets logged out unexpectedly</p>
											<p><strong>Resolution:</strong></p>
											<ul>
												<li>Check Supabase session timeout settings</li>
												<li>Verify token refresh mechanism</li>
												<li>Clear browser storage and re-login</li>
											</ul>
										</div>
									</details>
								</div>

								<div class="doc-section">
									<h3>Landing Page Issues</h3>
									<details class="troubleshooting-item">
										<summary>Staff Schedule Not Displaying</summary>
										<div class="troubleshooting-content">
											<p>
												<strong>Symptoms:</strong> Schedule section shows empty or incorrect staff assignments
											</p>
											<p><strong>Common Causes:</strong></p>
											<ul>
												<li>
													Day of week mapping mismatch (Database: 0=Monday vs JavaScript: 0=Sunday)
												</li>
												<li>Missing employee records</li>
												<li>Incorrect `is_working` flag in employee_schedules</li>
												<li>Schedule patterns not properly configured</li>
											</ul>
											<p><strong>Resolution Steps:</strong></p>
											<ol>
												<li>Check `employee_schedules` table for correct day_of_week values</li>
												<li>Verify employee records exist in `employees` table</li>
												<li>Ensure `is_working` flag is set to `true`</li>
												<li>Check schedule patterns in `schedule_patterns` table</li>
												<li>Verify date range calculations in landing page component</li>
											</ol>
										</div>
									</details>

									<details class="troubleshooting-item">
										<summary>Performance Metrics Show Zeros</summary>
										<div class="troubleshooting-content">
											<p>
												<strong>Symptoms:</strong> Yesterday's metrics display as 0 or don't load
											</p>
											<p><strong>Common Causes:</strong></p>
											<ul>
												<li>Missing data in `daily_metric_review` table</li>
												<li>Date format mismatch</li>
												<li>Database query errors</li>
												<li>Fallback to `daily_metrics` not working</li>
											</ul>
											<p><strong>Resolution Steps:</strong></p>
											<ol>
												<li>Check if data exists for yesterday's date in `daily_metric_review`</li>
												<li>Verify date format matches database expectations (YYYY-MM-DD)</li>
												<li>Test fallback query to `daily_metrics` table</li>
												<li>Check database connection and query logs</li>
												<li>Run manual metric update if needed</li>
											</ol>
										</div>
									</details>
								</div>

								<div class="doc-section">
									<h3>Employee Hours Issues</h3>
									<details class="troubleshooting-item">
										<summary>Hours Not Saving</summary>
										<div class="troubleshooting-content">
											<p>
												<strong>Symptoms:</strong> Changes made but not persisted after save
											</p>
											<p><strong>Common Causes:</strong></p>
											<ul>
												<li>Database connection issues</li>
												<li>Validation errors (hours outside 0-24 range)</li>
												<li>User session expired</li>
												<li>Constraint violations</li>
											</ul>
											<p><strong>Resolution Steps:</strong></p>
											<ol>
												<li>Check browser console for error messages</li>
												<li>Verify hours are within valid range (0-24, 0.5 increments)</li>
												<li>Ensure user is authenticated</li>
												<li>Check database connection and constraints</li>
												<li>Verify `daily_employee_hours` table permissions</li>
											</ol>
										</div>
									</details>
								</div>

								<div class="doc-section">
									<h3>Analytics Dashboard Issues</h3>
									<details class="troubleshooting-item">
										<summary>Charts Not Rendering</summary>
										<div class="troubleshooting-content">
											<p>
												<strong>Symptoms:</strong> Chart areas show blank or loading indefinitely
											</p>
											<p><strong>Common Causes:</strong></p>
											<ul>
												<li>Missing chart library dependencies</li>
												<li>Data format issues</li>
												<li>Large dataset causing performance problems</li>
												<li>Browser compatibility issues</li>
											</ul>
											<p><strong>Resolution Steps:</strong></p>
											<ol>
												<li>Check browser console for chart library errors</li>
												<li>Verify data format matches chart expectations</li>
												<li>Test with smaller date ranges</li>
												<li>Update browser or try different browser</li>
												<li>Check chart library version compatibility</li>
											</ol>
										</div>
									</details>

									<details class="troubleshooting-item">
										<summary>Slow Performance</summary>
										<div class="troubleshooting-content">
											<p>
												<strong>Symptoms:</strong> Dashboard takes long time to load or becomes unresponsive
											</p>
											<p><strong>Resolution:</strong></p>
											<ul>
												<li>Reduce date range being queried</li>
												<li>Check database query performance</li>
												<li>Clear browser cache</li>
												<li>Optimize database indexes if needed</li>
												<li>Consider pagination for large datasets</li>
											</ul>
										</div>
									</details>
								</div>

								<div class="doc-section">
									<h3>Database Issues</h3>
									<details class="troubleshooting-item">
										<summary>Connection Timeouts</summary>
										<div class="troubleshooting-content">
											<p>
												<strong>Symptoms:</strong> Application shows database connection errors
											</p>
											<p><strong>Resolution:</strong></p>
											<ol>
												<li>Check Supabase project status</li>
												<li>Verify database connection string</li>
												<li>Check network connectivity</li>
												<li>Monitor connection pool usage</li>
											</ol>
										</div>
									</details>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* Main Documentation Layout Styles */
	.documentation-container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 24px;
		background: #f8fafc;
		background-image: radial-gradient(
			circle at 1px 1px,
			rgba(59, 130, 246, 0.05) 1px,
			transparent 0
		);
		background-size: 20px 20px;
		min-height: 100vh;
	}

	.documentation-header {
		text-align: center;
		margin-bottom: 32px;
		padding: 40px 0;
		background: white;
		border-radius: 12px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.documentation-header h1 {
		margin: 0 0 8px 0;
		color: #1f2937;
		font-size: 2.5rem;
		font-weight: 700;
	}

	.header-subtitle {
		color: #6b7280;
		font-size: 1.1rem;
		margin: 0 0 24px 0;
		max-width: 600px;
		margin-left: auto;
		margin-right: auto;
		line-height: 1.5;
	}

	/* Search Controls */
	.search-controls {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-width: 800px;
		margin: 0 auto;
		align-items: center;
	}

	.search-input-container {
		position: relative;
		width: 100%;
		max-width: 500px;
	}

	.search-icon {
		position: absolute;
		left: 16px;
		top: 50%;
		transform: translateY(-50%);
		color: #6b7280;
		font-size: 1.2rem;
	}

	.search-input {
		width: 100%;
		padding: 12px 16px 12px 48px;
		border: 2px solid #e5e7eb;
		border-radius: 25px;
		font-size: 1rem;
		background: white;
		transition: all 0.2s ease;
		outline: none;
	}

	.search-input:focus {
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.clear-search {
		position: absolute;
		right: 16px;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		color: #6b7280;
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		transition: all 0.2s ease;
	}

	.clear-search:hover {
		background: #f3f4f6;
		color: #374151;
	}

	.filter-controls {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
		justify-content: center;
	}

	.filter-select {
		padding: 8px 16px;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		background: white;
		font-size: 0.9rem;
		color: #374151;
		cursor: pointer;
		transition: all 0.2s ease;
		outline: none;
	}

	.filter-select:focus {
		border-color: #3b82f6;
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
	}

	.results-summary {
		margin-top: 16px;
		padding: 12px 16px;
		background: #f8fafc;
		border-radius: 8px;
		border: 1px solid #e2e8f0;
	}

	.results-count {
		font-weight: 600;
		color: #374151;
		font-size: 0.9rem;
	}

	.no-results {
		color: #6b7280;
		font-style: italic;
		margin-left: 8px;
	}

	/* Quick Access Panel */
	.quick-access-panel {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		border-radius: 12px;
		padding: 24px;
		margin-bottom: 32px;
		color: white;
	}

	.quick-access-panel h3 {
		color: white;
		margin-bottom: 16px;
		font-weight: 600;
	}

	.quick-access-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 12px;
	}

	.quick-access-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 16px 12px;
		border: 2px solid rgba(255, 255, 255, 0.2);
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.1);
		color: white;
		cursor: pointer;
		transition: all 0.3s ease;
		font-size: 0.85rem;
		font-weight: 500;
	}

	.quick-access-item:hover {
		background: rgba(255, 255, 255, 0.2);
		border-color: rgba(255, 255, 255, 0.4);
		transform: translateY(-2px);
	}

	.quick-access-item i {
		font-size: 1.5rem;
	}

	/* Enhanced Tab Navigation Styles */
	.tab-navigation-enhanced {
		background: white;
		border-radius: 16px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
		padding: 20px;
		margin-bottom: 32px;
		overflow: hidden;
	}

	.primary-nav {
		margin-bottom: 20px;
		padding-bottom: 16px;
		border-bottom: 2px solid #f1f5f9;
	}

	.overview-tab.active {
		background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
		color: white;
		box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
		transform: translateY(-2px);
	}

	.category-nav-section {
		margin-bottom: 20px;
	}

	.category-nav-header {
		margin-bottom: 12px;
	}

	.category-label {
		font-size: 0.85rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		padding: 4px 12px;
		border-radius: 20px;
		display: inline-block;
	}

	.category-label.blue {
		background: rgba(59, 130, 246, 0.1);
		color: #1e40af;
	}
	.category-label.green {
		background: rgba(16, 185, 129, 0.1);
		color: #065f46;
	}
	.category-label.purple {
		background: rgba(139, 92, 246, 0.1);
		color: #5b21b6;
	}
	.category-label.orange {
		background: rgba(245, 158, 11, 0.1);
		color: #92400e;
	}
	.category-label.red {
		background: rgba(239, 68, 68, 0.1);
		color: #991b1b;
	}

	.category-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.category-tab {
		position: relative;
		font-size: 0.85rem;
	}

	.category-tab.blue.active {
		background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
		border-color: #3b82f6;
	}
	.category-tab.green.active {
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		border-color: #10b981;
	}
	.category-tab.purple.active {
		background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
		border-color: #8b5cf6;
	}
	.category-tab.orange.active {
		background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
		border-color: #f59e0b;
	}
	.category-tab.red.active {
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
		border-color: #ef4444;
	}

	.priority-indicator {
		position: absolute;
		top: -4px;
		right: -4px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		font-size: 0.7rem;
		font-weight: bold;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.priority-indicator.high {
		background: #ef4444;
		color: white;
	}

	/* Enhanced Overview Styles */
	.priority-summary {
		background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
		border-radius: 12px;
		padding: 24px;
		border: 1px solid #e2e8f0;
	}

	.priority-card {
		background: white;
		border-radius: 10px;
		padding: 20px;
		text-align: center;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
		border: 2px solid transparent;
		transition: all 0.3s ease;
	}

	.priority-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
	}

	.priority-card.high {
		border-color: #ef4444;
		background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
	}

	.priority-card.medium {
		border-color: #f59e0b;
		background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
	}

	.priority-card.low {
		border-color: #6b7280;
		background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
	}

	.priority-header {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font-weight: 600;
		font-size: 0.9rem;
		margin-bottom: 8px;
	}

	.priority-count {
		font-size: 1.5rem;
		font-weight: 700;
		color: #1f2937;
	}

	/* Category Sections */
	.categories-container {
		display: flex;
		flex-direction: column;
		gap: 32px;
	}

	.category-section {
		margin-bottom: 32px;
	}

	.category-header {
		margin-bottom: 20px;
		padding: 16px 20px;
		border-radius: 12px;
		background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%);
		border: 1px solid rgba(59, 130, 246, 0.2);
	}

	.category-header.blue {
		background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%);
		border-color: rgba(59, 130, 246, 0.2);
	}

	.category-header.green {
		background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%);
		border-color: rgba(16, 185, 129, 0.2);
	}

	.category-header.purple {
		background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%);
		border-color: rgba(139, 92, 246, 0.2);
	}

	.category-header.orange {
		background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%);
		border-color: rgba(245, 158, 11, 0.2);
	}

	.category-header.red {
		background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%);
		border-color: rgba(239, 68, 68, 0.2);
	}

	.category-title {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.category-title h3 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: #1f2937;
	}

	.section-count {
		font-size: 0.85rem;
		color: #6b7280;
		font-weight: 500;
	}

	.category-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 20px;
	}

	/* Enhanced Overview Items */
	.overview-item {
		background: white;
		border: 2px solid #e5e7eb;
		border-radius: 12px;
		padding: 24px;
		transition: all 0.3s ease;
		cursor: pointer;
		position: relative;
		overflow: hidden;
	}

	.overview-item::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 4px;
		background: #e5e7eb;
		transition: all 0.3s ease;
	}

	.overview-item.priority-high::before {
		background: linear-gradient(90deg, #ef4444, #dc2626);
	}

	.overview-item.priority-medium::before {
		background: linear-gradient(90deg, #f59e0b, #d97706);
	}

	.overview-item.priority-low::before {
		background: linear-gradient(90deg, #6b7280, #4b5563);
	}

	.overview-item:hover {
		box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
		border-color: #d1d5db;
		transform: translateY(-4px);
	}

	.section-info h4 {
		margin: 0;
		color: #1f2937;
		font-size: 1.1rem;
		font-weight: 600;
		margin-bottom: 8px;
	}

	.section-meta {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
	}

	.priority-indicator.priority-high {
		background: rgba(239, 68, 68, 0.1);
		color: #dc2626;
		font-size: 0.7rem;
		padding: 2px 6px;
		border-radius: 4px;
		text-transform: uppercase;
		font-weight: 600;
		border: 1px solid rgba(239, 68, 68, 0.2);
	}

	.priority-indicator.priority-medium {
		background: rgba(245, 158, 11, 0.1);
		color: #d97706;
		font-size: 0.7rem;
		padding: 2px 6px;
		border-radius: 4px;
		text-transform: uppercase;
		font-weight: 600;
		border: 1px solid rgba(245, 158, 11, 0.2);
	}

	.priority-indicator.priority-low {
		background: rgba(107, 114, 128, 0.1);
		color: #4b5563;
		font-size: 0.7rem;
		padding: 2px 6px;
		border-radius: 4px;
		text-transform: uppercase;
		font-weight: 600;
		border: 1px solid rgba(107, 114, 128, 0.2);
	}

	/* Enhanced System Dependencies */
	.system-dependencies {
		background: white;
		border-radius: 12px;
		padding: 24px;
		border: 1px solid #e5e7eb;
		margin-top: 32px;
	}

	.dependency-flow-enhanced {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		flex-wrap: wrap;
	}

	.flow-section {
		flex: 1;
		min-width: 200px;
		text-align: center;
	}

	.flow-title {
		font-weight: 600;
		color: #374151;
		margin-bottom: 16px;
		font-size: 1rem;
	}

	.flow-items {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.dependency-item {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px 16px;
		border-radius: 8px;
		font-size: 0.9rem;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.dependency-item.source {
		background: rgba(59, 130, 246, 0.1);
		color: #1e40af;
		border: 1px solid rgba(59, 130, 246, 0.2);
	}

	.dependency-item.process {
		background: rgba(245, 158, 11, 0.1);
		color: #92400e;
		border: 1px solid rgba(245, 158, 11, 0.2);
	}

	.dependency-item.storage {
		background: rgba(16, 185, 129, 0.1);
		color: #065f46;
		border: 1px solid rgba(16, 185, 129, 0.2);
	}

	.dependency-item.display {
		background: rgba(139, 92, 246, 0.1);
		color: #5b21b6;
		border: 1px solid rgba(139, 92, 246, 0.2);
	}

	.flow-arrow-container {
		display: flex;
		align-items: center;
		justify-content: center;
		color: #6b7280;
	}

	.flow-arrow {
		font-size: 2rem;
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.5;
			transform: scale(1);
		}
		50% {
			opacity: 1;
			transform: scale(1.1);
		}
	}

	/* Original Tab Navigation Styles (kept for backward compatibility) */
	.tab-navigation {
		display: flex;
		gap: 8px;
		margin-bottom: 32px;
		background: white;
		padding: 16px;
		border-radius: 12px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		overflow-x: auto;
	}

	.tab-button {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		background: transparent;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
		font-size: 0.9rem;
		color: #6b7280;
		position: relative;
		overflow: hidden;
	}

	.tab-button::before {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
		transition: left 0.5s;
	}

	.tab-button:hover::before {
		left: 100%;
	}

	.tab-button:hover {
		background: #f3f4f6;
		border-color: #d1d5db;
		color: #374151;
	}

	.tab-button.active {
		background: #3b82f6;
		border-color: #3b82f6;
		color: white;
		box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
	}

	.tab-icon {
		font-size: 1.2rem;
	}

	.tab-title {
		font-weight: 500;
	}

	.status-badge {
		padding: 2px 8px;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: capitalize;
	}

	.status-badge.complete {
		background: rgba(16, 185, 129, 0.1);
		color: #065f46;
		position: relative;
		overflow: hidden;
	}

	.status-badge.complete::before {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.3), transparent);
		animation: shimmer 2s infinite;
	}

	@keyframes shimmer {
		0% {
			left: -100%;
		}
		100% {
			left: 100%;
		}
	}

	/* Content Area */
	.content-area {
		min-height: 600px;
	}

	/* Documentation Content Styling */
	.documentation-content {
		max-width: none;
		line-height: 1.7;
		color: #374151;
	}

	.doc-section {
		margin-bottom: 2.5rem;
		padding: 0;
	}

	.doc-section:last-child {
		margin-bottom: 0;
	}

	.doc-section h3 {
		font-size: 1.25rem;
		font-weight: 600;
		color: #1f2937;
		margin: 0 0 1rem 0;
		padding-bottom: 0.5rem;
		border-bottom: 2px solid #e5e7eb;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.doc-section h4 {
		font-size: 1.1rem;
		font-weight: 600;
		color: #374151;
		margin: 1.5rem 0 0.75rem 0;
	}

	.doc-section p {
		margin: 0 0 1rem 0;
		color: #4b5563;
		line-height: 1.7;
	}

	.doc-section ul,
	.doc-section ol {
		margin: 0 0 1.5rem 0;
		padding-left: 1.5rem;
	}

	.doc-section li {
		margin-bottom: 0.5rem;
		color: #4b5563;
		line-height: 1.6;
	}

	.doc-section li strong {
		color: #1f2937;
		font-weight: 600;
	}

	.doc-section code {
		background: #f3f4f6;
		padding: 0.2rem 0.4rem;
		border-radius: 0.25rem;
		font-family:
			'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
		font-size: 0.875rem;
		color: #dc2626;
		border: 1px solid #e5e7eb;
	}

	.code-block {
		margin: 1.5rem 0;
		border-radius: 0.5rem;
		overflow: hidden;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		border: 1px solid #e5e7eb;
	}

	.code-block :global(pre) {
		background: #1f2937;
		color: #f9fafb;
		padding: 1.5rem;
		margin: 0;
		overflow-x: auto;
		font-family:
			'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.code-block :global(code) {
		background: transparent;
		padding: 0;
		border: none;
		color: inherit;
		font-size: inherit;
	}

	/* Dependency Table Styling */
	.dependency-table {
		background: #f8fafc;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		overflow: hidden;
		margin: 1.5rem 0;
	}

	.dependency-row {
		display: grid;
		grid-template-columns: 1fr 2fr 1fr;
		gap: 1rem;
		padding: 1rem;
		border-bottom: 1px solid #e5e7eb;
		align-items: center;
	}

	.dependency-row:last-child {
		border-bottom: none;
	}

	.dependency-row:nth-child(even) {
		background: #ffffff;
	}

	.dependency-source {
		font-weight: 600;
		color: #1f2937;
	}

	.dependency-tables {
		font-family:
			'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
		font-size: 0.875rem;
		color: #4b5563;
	}

	.dependency-frequency {
		color: #059669;
		font-weight: 500;
		text-align: center;
		background: #ecfdf5;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.875rem;
	}

	/* Tech Details Styling */
	.tech-details {
		background: #eff6ff;
		border: 1px solid #dbeafe;
		border-radius: 0.5rem;
		padding: 1.5rem;
		margin: 1.5rem 0;
	}

	.tech-details h4 {
		color: #1e40af;
		margin-top: 0;
		margin-bottom: 1rem;
		font-size: 1rem;
		font-weight: 600;
	}

	.tech-details ul {
		margin-bottom: 0;
	}

	.tech-details li {
		color: #1e40af;
	}

	.tech-details code {
		background: #dbeafe;
		color: #1e40af;
		border-color: #bfdbfe;
	}

	/* Maintenance Info Styling */
	.maintenance-info {
		background: #fef3c7;
		border: 1px solid #fcd34d;
		border-radius: 0.5rem;
		padding: 1.5rem;
		margin: 1.5rem 0;
	}

	.maintenance-info h4 {
		color: #92400e;
		margin-top: 0;
		margin-bottom: 1rem;
		font-size: 1rem;
		font-weight: 600;
	}

	.maintenance-info p {
		color: #92400e;
	}

	.maintenance-info ul {
		margin-bottom: 0;
	}

	.maintenance-info li {
		color: #92400e;
	}

	.maintenance-info code {
		background: #fcd34d;
		color: #92400e;
		border-color: #f59e0b;
	}

	/* Maintenance Procedures Styling */
	.maintenance-procedures {
		display: grid;
		gap: 1.5rem;
		margin: 1.5rem 0;
	}

	.procedure-category {
		background: #f0f9ff;
		border: 1px solid #e0f2fe;
		border-radius: 0.5rem;
		padding: 1.5rem;
	}

	.procedure-category h4 {
		color: #0369a1;
		margin-top: 0;
		margin-bottom: 1rem;
		font-size: 1rem;
		font-weight: 600;
	}

	.procedure-category ul {
		margin-bottom: 0;
	}

	.procedure-category li {
		color: #0369a1;
	}

	/* Troubleshooting Styling */
	.troubleshooting-item {
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		margin: 1rem 0;
		overflow: hidden;
	}

	.troubleshooting-item summary {
		background: #f9fafb;
		padding: 1rem 1.5rem;
		cursor: pointer;
		font-weight: 600;
		color: #1f2937;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		transition: background-color 0.2s ease;
	}

	.troubleshooting-item summary:hover {
		background: #f3f4f6;
	}

	.troubleshooting-item summary::marker {
		display: none;
	}

	.troubleshooting-item summary::before {
		content: '▶';
		color: #6b7280;
		font-size: 0.875rem;
		transition: transform 0.2s ease;
	}

	.troubleshooting-item[open] summary::before {
		transform: rotate(90deg);
	}

	.solution-content {
		padding: 1.5rem;
		background: white;
		border-top: 1px solid #e5e7eb;
	}

	.solution-content p:first-child {
		margin-top: 0;
	}

	.solution-content p:last-child {
		margin-bottom: 0;
	}

	/* Warning and Alert Styling */
	.warning {
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-left: 4px solid #ef4444;
		border-radius: 0.5rem;
		padding: 1rem 1.5rem;
		margin: 1.5rem 0;
	}

	.warning :global(p) {
		color: #dc2626;
		margin: 0;
	}

	.warning :global(code) {
		background: #fecaca;
		color: #dc2626;
		border-color: #f87171;
	}

	/* Success/Info Styling */
	.success {
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
		border-left: 4px solid #22c55e;
		border-radius: 0.5rem;
		padding: 1rem 1.5rem;
		margin: 1.5rem 0;
	}

	.success :global(p) {
		color: #15803d;
		margin: 0;
	}

	.success :global(code) {
		background: #bbf7d0;
		color: #15803d;
		border-color: #86efac;
	}

	/* Overview Card Styles */
	.overview-card {
		background: white;
		border-radius: 12px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		border: 1px solid #e5e7eb;
	}

	.overview-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 20px;
		margin-bottom: 32px;
	}

	.overview-item {
		background: #f8fafc;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 20px;
		transition: all 0.2s ease;
		cursor: pointer;
	}

	.overview-item:hover {
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		border-color: #d1d5db;
		transform: translateY(-2px);
	}

	.overview-header {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 12px;
	}

	.overview-icon {
		color: #3b82f6;
		font-size: 1.5rem;
	}

	.overview-item h3 {
		margin: 0;
		color: #1f2937;
		font-size: 1.1rem;
		font-weight: 600;
	}

	.overview-description {
		color: #6b7280;
		font-size: 0.9rem;
		line-height: 1.5;
		margin: 0 0 16px 0;
	}

	.view-docs-button {
		background: #3b82f6;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 6px;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		width: 100%;
	}

	.view-docs-button:hover:not(:disabled) {
		background: #2563eb;
		transform: translateY(-1px);
	}

	.view-docs-button:disabled {
		background: #9ca3af;
		cursor: not-allowed;
		opacity: 0.7;
	}

	/* Documentation Card Styles */
	.documentation-card {
		background: white;
		border-radius: 12px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		border: 1px solid #e5e7eb;
		overflow: hidden;
		animation: slideInUp 0.6s ease-out;
	}

	.documentation-card :global(.card-header) {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		padding: 24px;
		position: relative;
		overflow: hidden;
	}

	.documentation-card :global(.card-header)::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(45deg, rgba(255, 255, 255, 0.1) 0%, transparent 50%);
		pointer-events: none;
	}

	.documentation-card :global(.card-title) {
		color: white;
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0;
		position: relative;
		z-index: 1;
	}

	.documentation-card :global(.card-content) {
		padding: 2.5rem;
		background: white;
		min-height: 400px;
	}

	/* Different header colors for different sections */
	.overview-card :global(.card-header) {
		background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
	}

	/* Troubleshooting section gets a different color */
	.content-area [data-section='troubleshooting'] :global(.card-header) {
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
	}

	/* Database section gets a different color */
	.content-area [data-section='database'] :global(.card-header) {
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
	}

	/* Maintenance section gets a different color */
	.content-area [data-section='maintenance'] :global(.card-header) {
		background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
	}

	/* Enhanced Button Styles for Navigation */
	.navigate-button {
		background: #3b82f6;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 6px;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.navigate-button:hover {
		background: #2563eb;
		transform: translateY(-1px);
	}

	.navigate-button i {
		font-size: 1.1rem;
	}

	/* Enhanced Animations and Transitions */
	@keyframes slideInUp {
		from {
			opacity: 0;
			transform: translateY(30px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Improved Loading Animation */
	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(59, 130, 246, 0.1);
		border-radius: 50%;
		border-top-color: #3b82f6;
		animation: spin 1s ease-in-out infinite;
		margin-bottom: 16px;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Enhanced Mobile Responsiveness */
	@media (max-width: 768px) {
		.documentation-container {
			padding: 16px;
		}

		.documentation-header {
			padding: 24px 16px;
		}

		.documentation-header h1 {
			font-size: 2rem;
		}

		.search-controls {
			padding: 0 16px;
		}

		.filter-controls {
			flex-direction: column;
			align-items: stretch;
			width: 100%;
			max-width: 300px;
		}

		.filter-select {
			width: 100%;
		}

		.quick-access-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 8px;
		}

		.quick-access-item {
			padding: 12px 8px;
			font-size: 0.8rem;
		}

		.tab-navigation-enhanced {
			padding: 16px;
		}

		.category-nav-section {
			margin-bottom: 16px;
		}

		.category-tabs {
			flex-direction: column;
			gap: 8px;
		}

		.category-tab {
			justify-content: flex-start;
			width: 100%;
		}

		.overview-grid,
		.category-grid {
			grid-template-columns: 1fr;
		}

		.documentation-card :global(.card-content) {
			padding: 20px;
		}

		.priority-summary {
			padding: 16px;
		}

		.dependency-flow-enhanced {
			flex-direction: column;
			gap: 16px;
		}

		.flow-section {
			min-width: unset;
		}

		.flow-arrow-container .flow-arrow {
			transform: rotate(90deg);
		}

		.priority-card {
			padding: 16px;
		}

		.category-header {
			padding: 12px 16px;
		}

		.overview-item {
			padding: 20px;
		}

		.system-dependencies {
			padding: 16px;
		}

		/* Documentation Content Mobile Styles */
		.documentation-content {
			font-size: 0.9rem;
		}

		.doc-section {
			margin-bottom: 2rem;
		}

		.doc-section h3 {
			font-size: 1.125rem;
		}

		.doc-section h4 {
			font-size: 1rem;
		}

		.dependency-row {
			grid-template-columns: 1fr;
			gap: 0.5rem;
			text-align: left;
		}

		.dependency-frequency {
			text-align: left;
			display: inline-block;
			width: fit-content;
		}

		.code-block :global(pre) {
			padding: 1rem;
			font-size: 0.8rem;
		}

		.tech-details,
		.maintenance-info,
		.procedure-category {
			padding: 1rem;
		}

		.troubleshooting-item summary {
			padding: 0.75rem 1rem;
		}

		.solution-content {
			padding: 1rem;
		}
	}

	@media (max-width: 480px) {
		.documentation-header h1 {
			font-size: 1.75rem;
		}

		.header-subtitle {
			font-size: 1rem;
		}

		.tab-button {
			padding: 10px 12px;
			font-size: 0.85rem;
		}

		.category-grid {
			grid-template-columns: 1fr;
			gap: 16px;
		}

		.overview-item {
			padding: 16px;
		}

		.priority-summary {
			padding: 12px;
		}

		.priority-card {
			padding: 12px;
		}

		.category-header {
			padding: 12px;
		}

		.system-dependencies {
			padding: 12px;
		}
	}
</style>
