<script lang="ts">
	import * as Accordion from '$lib/shadcn/ui/accordion';
</script>

<main class="release-notes">
	<header class="release-header">
		<h1>Release Notes</h1>
		<p class="version-info">Latest Version: 1.2 | Release Date: June 17, 2025</p>
	</header>

	<!-- Accordion container for different versions -->
	<div class="release-container">
		<Accordion.Root type="multiple" class="release-accordion" value={['v1.2']}>
			<!-- Version 1.2 Release Notes -->
			<Accordion.Item value="v1.2" class="version-section">
				<Accordion.Trigger class="version-header">
					<div class="version-title">
						<div class="version-info-left">
							<h2>Version 1.2</h2>
							<span class="version-date">June 17, 2025</span>
						</div>
					</div>
				</Accordion.Trigger>
				<Accordion.Content class="version-content">
					<section class="release-section">
						<h3>Employee Hours Integration & Data Migration</h3>
						<ul class="feature-list">
							<li>
								Migrated employee hours tracking from manual entry to automated Supabase-based
								system with dedicated daily_employee_hours table
							</li>
							<li>
								Created comprehensive TypeScript service layer (dailyHoursService.ts) for employee
								hours management with full CRUD operations
							</li>
							<li>
								Implemented role-based hour tracking with dedicated columns for Management, Packing,
								and Picking positions
							</li>
							<li>
								Built intuitive Employee Hours management page with real-time data validation and
								error handling
							</li>
							<li>
								Added automated daily metric review system with structured data persistence for
								historical tracking
							</li>
							<li>Integrated Make.com automation for seamless data import from external systems</li>
							<li>
								Enhanced data integrity with proper TypeScript typing and validation throughout the
								service layer
							</li>
						</ul>
					</section>

					<section class="release-section">
						<h3>Dashboard Transformation & Metrics Overhaul</h3>
						<ul class="feature-list">
							<li>
								Completely refactored ShipmentChart.svelte to use API-driven data instead of manual
								entries
							</li>
							<li>
								Replaced manual "Actual Hours Worked" with automated "Total Hours Used" calculation
								from employee hours data
							</li>
							<li>
								Added comprehensive role-based hour breakdowns: Management Hours Used, Packing Hours
								Used, and Picking Hours Used
							</li>
							<li>
								Updated labor efficiency calculations to focus on productive hours (Packing +
								Picking only, excluding Management)
							</li>
							<li>
								Transformed "Shipments Packed" metric to use API total orders data for improved
								accuracy and consistency
							</li>
							<li>
								Implemented read-only metric system for automated calculations while maintaining
								manual override capabilities where needed
							</li>
							<li>
								Enhanced week-over-week percentage calculations with proper role-based breakdowns
								and totals
							</li>
							<li>
								Fixed current week and previous week totals to accurately sum role breakdown metrics
							</li>
							<li>
								Added comprehensive error handling and data validation throughout the dashboard
								calculations
							</li>
						</ul>
					</section>

					<section class="release-section">
						<h3>API & Export System Enhancement</h3>
						<ul class="feature-list">
							<li>
								Updated daily report API endpoint (+server.ts) to include all new role-based metrics
								and naming conventions
							</li>
							<li>
								Enhanced CSV export functionality to reflect new metric structure with proper column
								headers and data formatting
							</li>
							<li>
								Integrated real-time data synchronization between dashboard metrics and export
								systems
							</li>
							<li>
								Implemented consistent metric naming across all API endpoints and reporting
								interfaces
							</li>
							<li>Added comprehensive data validation and error handling for all API operations</li>
							<li>Created detailed documentation for API changes and migration procedures</li>
						</ul>
					</section>

					<section class="release-section">
						<h3>Sidebar Navigation Enhancement</h3>
						<ul class="feature-list">
							<li>
								Integrated modern shadcn/ui sidebar components for improved consistency and
								maintainability
							</li>
							<li>
								Added visual separators between logical navigation groups for better information
								hierarchy
							</li>
							<li>
								Implemented smooth hover effects with icon scaling animations and background
								transitions
							</li>
							<li>
								Enhanced active state visualization with border highlights and subtle pulse
								animations
							</li>
							<li>
								Added comprehensive tooltip system for collapsed sidebar states with proper
								positioning
							</li>
							<li>
								Improved accessibility with proper ARIA attributes and keyboard navigation support
							</li>
							<li>
								Created TypeScript type guards for navigation items ensuring type safety and
								maintainability
							</li>
							<li>
								Optimized CSS animations with hardware acceleration and performance considerations
							</li>
							<li>
								Added ripple effects on click interactions for modern, responsive user feedback
							</li>
							<li>
								Fixed separator visibility issues with robust fallback styling and cross-browser
								compatibility
							</li>
							<li>
								Implemented intelligent mobile sidebar behavior with auto-close on navigation and
								click-outside functionality
							</li>
							<li>
								Added responsive mobile detection system that adjusts sidebar behavior based on
								screen size (768px breakpoint)
							</li>
							<li>
								Enhanced mobile navigation flow with automatic sidebar closure when users tap
								navigation links or click outside the sidebar area
							</li>
						</ul>
					</section>

					<section class="release-section">
						<h3>Mobile Experience Optimization</h3>
						<ul class="feature-list">
							<li>
								Completely redesigned Employee Hours page for mobile-first experience with
								scrollbar-free navigation
							</li>
							<li>
								Eliminated fixed height constraints and nested scrollbars in favor of natural
								content flow and single-page scrolling
							</li>
							<li>
								Implemented touch-friendly interface with minimum 44px touch targets for all
								interactive elements following iOS Human Interface Guidelines
							</li>
							<li>
								Enhanced input field experience with 16px+ font sizes to prevent unwanted iOS zoom
								and improved tap targets for hour entry
							</li>
							<li>
								Added comprehensive responsive breakpoints: 768px (tablets), 480px (small phones),
								and 900px+ (large phones) for optimal viewing across all devices
							</li>
							<li>
								Transformed employee input cards to single-column layout on mobile with centered
								controls and improved readability
							</li>
							<li>
								Optimized role breakdown section for mobile with stacked layout and larger touch
								targets for better thumb navigation
							</li>
							<li>
								Enhanced button interactions with proper touch feedback, removed tap highlights, and
								full-width controls on small screens
							</li>
							<li>
								Implemented progressive enhancement where mobile layouts gracefully degrade while
								maintaining full functionality
							</li>
							<li>
								Added intelligent sidebar auto-close functionality that detects mobile usage and
								closes navigation after link clicks or outside taps
							</li>
							<li>
								Created seamless mobile navigation experience with proper state management and
								smooth transitions between pages
							</li>
						</ul>
					</section>

					<section class="release-section">
						<h3>Database Schema & Service Architecture</h3>
						<ul class="feature-list">
							<li>
								Designed and implemented daily_employee_hours table schema with proper indexing and
								constraints
							</li>
							<li>
								Created daily_metric_review table for comprehensive metric tracking and historical
								analysis
							</li>
							<li>
								Built robust dailyMetricReviewService.ts with full CRUD operations and data
								validation
							</li>
							<li>
								Implemented proper error handling and transaction management for data integrity
							</li>
							<li>
								Added comprehensive TypeScript interfaces for all database entities and service
								responses
							</li>
							<li>
								Created efficient query patterns for optimal database performance and data retrieval
							</li>
						</ul>
					</section>

					<section class="release-section">
						<h3>Documentation & Quality Assurance</h3>
						<ul class="feature-list">
							<li>
								Created comprehensive documentation files: DAILY_METRIC_REVIEW_UPDATE.md,
								DAILY_REPORT_API_UPDATE.md, SHIPMENTS_PACKED_API_FIX.md
							</li>
							<li>
								Implemented systematic error checking after each major change to ensure code quality
							</li>
							<li>
								Added detailed inline code comments explaining complex calculations and business
								logic
							</li>
							<li>Created migration guides for transitioning from manual to automated systems</li>
							<li>
								Validated all changes with real production data through Make.com integration testing
							</li>
							<li>Ensured backward compatibility while implementing new automated features</li>
						</ul>
					</section>

					<section class="release-section">
						<h3>Performance & User Experience</h3>
						<ul class="feature-list">
							<li>
								Optimized database queries for faster dashboard loading with role-based calculations
							</li>
							<li>
								Improved real-time data synchronization between components and external systems
							</li>
							<li>
								Enhanced loading states and error boundaries for better user experience during data
								operations
							</li>
							<li>Reduced manual data entry requirements through comprehensive automation</li>
							<li>
								Implemented efficient caching strategies for frequently accessed employee hours data
							</li>
							<li>Added progressive enhancement for sidebar animations and interactions</li>
							<li>
								Eliminated scrollbar dependencies on mobile devices for more intuitive navigation
								patterns
							</li>
							<li>
								Improved mobile performance by removing fixed height containers and complex overflow
								calculations
							</li>
							<li>
								Enhanced touch interaction responsiveness with optimized event handling and reduced
								layout thrashing
							</li>
							<li>
								Implemented intelligent mobile detection and responsive behavior that adapts to
								device capabilities and screen sizes
							</li>
							<li>
								Optimized font sizes and spacing for mobile readability while maintaining desktop
								design consistency
							</li>
						</ul>
					</section>
				</Accordion.Content>
			</Accordion.Item>

			<!-- Version 1.1 Release Notes -->
			<Accordion.Item value="v1.1" class="version-section">
				<Accordion.Trigger class="version-header">
					<div class="version-title">
						<div class="version-info-left">
							<h2>Version 1.1</h2>
							<span class="version-date">June 12, 2025</span>
						</div>
					</div>
				</Accordion.Trigger>
				<Accordion.Content class="version-content">
					<section class="release-section">
						<h3>Monthly Analytics</h3>
						<ul class="feature-list">
							<li>
								Developed comprehensive monthly analytics dashboard with shadcn/ui components for
								enhanced visual consistency
							</li>
							<li>
								Implemented interactive chart selection with organized categories: Sales
								Performance, Order Analytics, and Operational Metrics
							</li>
							<li>
								Created responsive multi-channel sales visualization showing Amazon, eBay, and
								Shopify performance trends
							</li>
							<li>
								Added dynamic month/year selection with intuitive navigation controls and date
								validation
							</li>
							<li>
								Built advanced data aggregation system supporting daily, weekly, and monthly rollups
								from Linnworks API
							</li>
							<li>
								Integrated real-time loading states and error handling for improved user experience
								during data fetches
							</li>
							<li>
								Implemented Chart.js integration with custom styling to match application design
								system
							</li>
							<li>Added comprehensive data export functionality with CSV download capabilities</li>
							<li>
								Created intelligent chart type selection with appropriate visualizations for
								different data types
							</li>
							<li>
								Developed responsive layout that adapts seamlessly across desktop, tablet, and
								mobile devices
							</li>
							<li>
								Enhanced performance optimization with efficient data caching and processing
								algorithms
							</li>
							<li>
								Added detailed tooltips and data point interactions for better data exploration
							</li>
							<li>
								Implemented consistent color coding across all charts for immediate channel
								recognition
							</li>
							<li>
								Built accessible navigation with keyboard support and screen reader compatibility
							</li>
						</ul>
					</section>

					<section class="release-section">
						<h3>Landing Page Performance Optimization</h3>
						<ul class="feature-list">
							<li>
								Completed comprehensive shadcn/ui migration for Yesterday's Performance section with
								modern component architecture
							</li>
							<li>
								Achieved significant space optimization with 55-60% total height reduction through
								strategic compacting
							</li>
							<li>
								Implemented responsive grid layouts that maintain readability while maximizing
								information density
							</li>
							<li>
								Enhanced visual hierarchy with optimized typography scaling from text-xl to text-lg
								for improved scanning
							</li>
							<li>
								Reduced component padding and margins systematically (pt-4/pb-4 → pt-2/pb-2) for
								tighter layout
							</li>
							<li>
								Streamlined loading skeleton states with proportionally adjusted sizes for better
								visual consistency
							</li>
							<li>Optimized badge components with smaller text sizing for space efficiency</li>
							<li>
								Maintained full mobile responsiveness while achieving aggressive desktop compacting
							</li>
							<li>
								Preserved all functionality including color coding, visual distinctions, and data
								integrity
							</li>
							<li>
								Enhanced overall dashboard layout by freeing up vertical space for additional
								content sections
							</li>
							<li>
								Improved user experience with faster visual scanning and reduced scroll requirements
							</li>
							<li>
								Created comprehensive documentation tracking optimization phases and performance
								benefits
							</li>
						</ul>
					</section>

					<section class="release-section">
						<h3>Enhanced Performance & Security</h3>
						<ul class="feature-list">
							<li>Implemented systematic UI component optimization reducing render complexity</li>
							<li>Enhanced build performance with optimized bundle sizes and code splitting</li>
							<li>Improved memory efficiency through strategic component state management</li>
							<li>
								Added comprehensive error boundary implementations for graceful failure handling
							</li>
							<li>
								Optimized chart rendering performance with efficient data processing algorithms
							</li>
						</ul>
					</section>
				</Accordion.Content>
			</Accordion.Item>

			<!-- Version 1.0 Release Notes -->
			<Accordion.Item value="v1.0" class="version-section">
				<Accordion.Trigger class="version-header">
					<div class="version-title">
						<div class="version-info-left">
							<h2>Version 1.0</h2>
							<span class="version-date">April 7, 2025</span>
						</div>
					</div>
				</Accordion.Trigger>
				<Accordion.Content class="version-content">
					<section class="release-section">
						<h3>Core Dashboard Features</h3>
						<ul class="feature-list">
							<li>
								Updated previous week totals to calculate averages from previous week data, ensuring
								accurate WoW % changes
							</li>
							<li>
								Implemented inversion logic in WoW calculation for metrics where a decrease is
								positive
							</li>
							<li>Refactored data structures to enforce consistent type definitions</li>
							<li>Enhanced week navigation logic to correctly reload previous week data</li>
							<li>Removed note and flag functionality to streamline the interface</li>
							<li>Reduced cell sizes throughout the dashboard for a more compact layout</li>
							<li>Added CSV export functionality with comprehensive data</li>
							<li>Fixed naming consistency for metrics across all calculations</li>
							<li>Improved header display with weekday names above date formats</li>
							<li>Added tooltips for calculated fields showing formulas</li>
						</ul>
					</section>

					<section class="release-section">
						<h3>Kaizen Projects</h3>
						<ul class="feature-list">
							<li>
								Developed a Kanban board with columns: New Suggestions, Under Review, In Progress,
								and Completed
							</li>
							<li>Enabled drag‑and‑drop functionality with immediate updates via Supabase</li>
							<li>Introduced a side panel for project details with read‑only and edit modes</li>
							<li>Implemented project commenting system with author attribution and timestamps</li>
							<li>Added "thumbs up" reactions to help prioritize popular improvement ideas</li>
							<li>
								Created streamlined new project submission form with auto-filled user information
							</li>
							<li>
								Enhanced accessibility throughout with proper ARIA attributes, keyboard navigation,
								and screen reader support
							</li>
							<li>Implemented robust error handling with user-friendly notifications</li>
							<li>Added verification steps for database operations to ensure data consistency</li>
							<li>
								Optimized UI with smooth animations, intuitive controls, and responsive design
							</li>
							<li>
								Improved visual hierarchy with clear section organization and consistent typography
							</li>
							<li>
								Added support for project metadata including deadlines, owners, and detailed
								descriptions
							</li>
							<li>Implemented proper date formatting for improved readability</li>
						</ul>
					</section>

					<section class="release-section">
						<h3>Schedule Management</h3>
						<ul class="feature-list">
							<li>Created interactive employee scheduling system with monthly calendar view</li>
							<li>
								Implemented weekly recurring schedule patterns with intuitive checkbox interface
							</li>
							<li>
								Added role-based visual organization with color coding for different positions
							</li>
							<li>Developed employee management system with add/remove functionality</li>
							<li>Integrated real-time data persistence via Supabase database</li>
							<li>
								Implemented dynamic employee count indicators showing staffing levels for each day
							</li>
							<li>
								Created responsive, mobile-friendly calendar design that adapts to screen size
							</li>
							<li>Added month navigation for easy historical and future schedule viewing</li>
							<li>
								Implemented dual view system: Calendar View for visualization and Schedule Manager
								for pattern setup
							</li>
							<li>Enhanced accessibility with proper ARIA attributes and keyboard navigation</li>
							<li>Improved empty state handling with helpful prompts and clear user flow</li>
							<li>
								Created role-based ordering on calendar to display employees by position hierarchy
							</li>
							<li>Added employee leave management with visual indicators in the calendar</li>
							<li>Implemented single-day and date range leave request capabilities</li>
							<li>Added intelligent leave management that respects employee work schedules</li>
							<li>Created an employee leave modal with type selection and date controls</li>
							<li>Developed bulk leave request functionality for efficient time-off management</li>
							<li>Integrated leave status indicators with calendar view for visual feedback</li>
							<li>Added automatic employee count adjustments to exclude employees on leave</li>
							<!-- New release items we should add -->
							<li>
								Enhanced employee display with compact initials and detailed tooltips for better
								space utilization
							</li>
							<li>
								Added flexible month, week, and day view toggle options for varied schedule
								management needs
							</li>
							<li>
								Implemented intelligent tooltip positioning that adjusts based on available screen
								space
							</li>
							<li>Redesigned calendar UI with clear visual separation of weekends from weekdays</li>
							<li>
								Improved schedule pattern visualization with collapsible week cards and clear week
								headers
							</li>
							<li>
								Added comprehensive status icon system (available, holiday, sick) for better
								schedule clarity
							</li>
							<li>
								Enhanced shift display with detailed time information (morning: 08:00-16:30, etc.)
							</li>
							<li>
								Improved accessibility compliance with proper ARIA attributes and keyboard
								navigation
							</li>
							<li>
								Optimized layout for better information density while maintaining visual clarity
							</li>
							<li>Added error handling and loading states for smooth user experience</li>
							<li>
								Secured route with proper authentication protection matching application standards
							</li>
						</ul>
					</section>

					<section class="release-section">
						<h3>Landing Page</h3>
						<ul class="feature-list">
							<li>
								Created a new centralized landing page with key operational information at a glance
							</li>
							<li>
								Implemented responsive dashboard layout optimized for desktop and tablet views
							</li>
							<li>
								Added today's and tomorrow's staffing sections with role-based grouping and visual
								separators
							</li>
							<li>
								Integrated upcoming leave calendar with consolidated date ranges for cleaner display
							</li>
							<li>
								Added real-time weather widget with current conditions, high/low temperatures, and
								tomorrow's forecast
							</li>
							<li>Included yesterday's performance metrics summarizing key operational data</li>
							<li>
								Implemented session-based authentication with automatic redirects for unauthorized
								access
							</li>
							<li>
								Created elegant loading states for all async data fetches to improve perceived
								performance
							</li>
							<li>
								Integrated with Supabase for real-time employee scheduling and leave management data
							</li>
							<li>Added proper date formatting throughout to maintain consistent UI language</li>
							<li>
								Designed clean card-based layout with subtle shadows and clear visual hierarchy
							</li>
							<li>
								Implemented error handling for API failures with user-friendly fallback states
							</li>
							<li>
								Added support for showing employees grouped by role with subtle visual separators
							</li>
							<li>
								Built modular component architecture for improved maintainability and future
								expansion
							</li>
							<li>
								Migrated Yesterday's Performance section to modern shadcn/ui components for design
								consistency
							</li>
							<li>
								Optimized layout density with intelligent spacing reduction while maintaining
								professional appearance
							</li>
							<li>
								Enhanced mobile experience with improved information hierarchy and reduced scroll
								requirements
							</li>
						</ul>
					</section>

					<section class="release-section">
						<h3>Process Map</h3>
						<ul class="feature-list">
							<li>
								Created interactive process mapping tool for documenting and analyzing operational
								workflows
							</li>
							<li>
								Implemented structured issue tracking with severity levels (low, medium, high) and
								status tracking (open, in-progress, resolved)
							</li>
							<li>
								Built responsive Apple-inspired design with clean visual hierarchy and consistent
								styling
							</li>
							<li>
								Developed comprehensive step management system with add, edit, delete, duplicate and
								reorder capabilities
							</li>
							<li>Added real-time search and filtering to quickly locate specific process steps</li>
							<li>
								Created role-based assignment system to track step ownership and responsibility
							</li>
							<li>
								Implemented detailed issue management with multi-issue support for each process step
							</li>
							<li>Integrated print-friendly view for easy documentation sharing</li>
							<li>Added efficient keyboard navigation support with shortcuts for common actions</li>
							<li>Built informative tooltips to guide users through the interface</li>
							<li>
								Implemented responsive design that maintains usability on various screen sizes
							</li>
							<li>Enhanced step editing with context-sensitive controls and validation</li>
							<li>Created smooth animations and transitions for a polished user experience</li>
							<li>
								Added centralized "Add Step" controls at both top and bottom for better usability
								with large process maps
							</li>
							<li>Integrated with authentication system to protect process data</li>
							<li>Implemented Supabase integration for real-time data storage and retrieval</li>
						</ul>
					</section>

					<section class="release-section">
						<h3>Performance & Security</h3>
						<ul class="feature-list">
							<li>Optimized database queries for faster dashboard loading</li>
							<li>Improved authentication flow with better session management</li>
							<li>Added input sanitization to prevent security vulnerabilities</li>
							<li>Enhanced error handling and logging throughout the application</li>
							<li>Improved Supabase integration for more efficient data synchronization</li>
						</ul>
					</section>
				</Accordion.Content>
			</Accordion.Item>
		</Accordion.Root>
	</div>

	<footer class="release-footer">
		<p>By Jack Weston</p>
	</footer>
</main>

<style>
	.release-notes {
		max-width: 980px;
		margin: 1.5rem auto;
		padding: 0 1rem;
		font-family:
			'SF Pro Display',
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			sans-serif;
		color: #1f2937;
		font-size: 0.95rem;
		line-height: 1.4;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
	}

	.release-header {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	h1 {
		font-size: 2rem;
		margin-bottom: 0.25rem;
		color: #004225;
		font-weight: 500;
		letter-spacing: -0.02em;
	}

	.version-info {
		font-size: 0.9rem;
		color: #6b7280;
		font-weight: 400;
	}

	.release-container {
		background-color: #f8fafc;
		border-radius: 12px;
		padding: 2rem;
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.05),
			0 4px 12px rgba(0, 0, 0, 0.08);
	}

	.release-section {
		margin-bottom: 1.5rem;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid #f3f4f6;
	}

	.release-section:last-child {
		margin-bottom: 0;
		padding-bottom: 0;
		border-bottom: none;
	}

	h2 {
		font-size: 1.4rem;
		margin-bottom: 0.5rem;
		color: #004225;
		font-weight: 500;
		letter-spacing: -0.01em;
	}

	.feature-list {
		list-style: none;
		padding-left: 0;
		margin: 0.25rem 0 0 0;
	}

	.feature-list li {
		margin-bottom: 0.4rem;
		line-height: 1.4;
		position: relative;
		padding-left: 1.5rem;
	}

	.feature-list li:before {
		content: '';
		position: absolute;
		left: 0;
		top: 0.45rem;
		height: 0.45rem;
		width: 0.45rem;
		background-color: #35b07b;
		border-radius: 50%;
	}

	.release-footer {
		text-align: right;
		font-size: 0.85rem;
		color: #6b7280;
		margin-top: 0.75rem;
		font-weight: 400;
	}

	/* Accordion Styling */
	:global(.release-accordion) {
		width: 100%;
		border: none;
	}

	:global(.version-section) {
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		margin-bottom: 1rem;
		overflow: hidden;
		background: #ffffff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
	}

	:global(.version-section:last-child) {
		margin-bottom: 0;
	}

	:global(.version-header) {
		width: 100%;
		padding: 1.25rem 1.5rem;
		font-weight: normal;
		background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
		border: none;
		text-align: left;
		cursor: pointer;
		transition: all 0.2s ease;
		border-bottom: 1px solid #e5e7eb;
	}

	:global(.version-header:hover) {
		background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
	}

	:global(.version-header[data-state='open']) {
		background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
		border-bottom-color: #3b82f6;
	}

	.version-title {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
	}

	.version-info-left {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.version-info-left h2 {
		margin: 0;
		font-size: 1.4rem;
		color: #004225;
		font-weight: 600;
		line-height: 1.2;
	}

	.version-date {
		font-size: 0.85rem;
		color: #6b7280;
		font-weight: 500;
	}

	:global(.version-content) {
		padding: 1.5rem;
		background: #ffffff;
	}

	:global(.version-content h3) {
		font-size: 1.2rem;
		margin-bottom: 0.75rem;
		color: #004225;
		font-weight: 500;
		letter-spacing: -0.01em;
	}

	.version-info {
		font-size: 0.9rem;
		color: #6b7280;
		font-weight: 400;
	}

	/* Added spacing between individual list items for better readability */
	.feature-list li:last-child {
		margin-bottom: 0;
	}

	/* Slightly smaller container for better readability of single column content */
	@media (min-width: 768px) {
		.release-notes {
			font-size: 0.95rem;
		}
	}

	@media (max-width: 767px) {
		.release-container {
			padding: 1.5rem 1rem;
		}

		h2 {
			font-size: 1.3rem;
		}

		.feature-list li {
			margin-bottom: 0.5rem;
		}

		.version-info-left h2 {
			font-size: 1.2rem;
		}

		.version-date {
			font-size: 0.8rem;
		}

		:global(.version-header) {
			padding: 1rem 1.25rem;
		}

		:global(.version-content) {
			padding: 1.25rem;
		}
	}
</style>
