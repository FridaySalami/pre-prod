import type { RequestHandler } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE } from '$env/static/private';
import { getScheduledHoursForDateRange } from '$lib/schedule/hours-service';
import { uploadDailyMetricReview, transformMetricsForReview } from '$lib/dailyMetricReviewService';

if (!PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
	throw new Error('Missing Supabase configuration in environment variables');
}

const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// Helper function to get Monday of current week
function getMonday(date: Date = new Date()): Date {
	const d = new Date(date);
	const day = d.getDay();
	const diff = d.getDate() - day + (day === 0 ? -6 : 1);
	return new Date(d.setDate(diff));
}

// Validation function for current week data
function validateCurrentWeekData(data: any[], expectedWeekStart: Date, expectedWeekEnd: Date, dataSource: string): void {
	const weekStartStr = expectedWeekStart.toISOString().split('T')[0];
	const weekEndStr = expectedWeekEnd.toISOString().split('T')[0];
	
	console.log(`🔍 Validating ${dataSource} data for current week range: ${weekStartStr} to ${weekEndStr}`);
	
	data.forEach((dayData, index) => {
		if (!dayData || !dayData.date) {
			console.warn(`⚠️ Missing date in ${dataSource} data at index ${index}`);
			return;
		}
		
		const dataDate = new Date(dayData.date);
		const isInRange = dataDate >= expectedWeekStart && dataDate <= expectedWeekEnd;
		
		if (!isInRange) {
			const error = `❌ CONTAMINATION DETECTED: ${dataSource} contains data from ${dayData.date} which is outside current week range ${weekStartStr} to ${weekEndStr}`;
			console.error(error);
			throw new Error(error);
		}
		
		console.log(`✅ ${dataSource} data for ${dayData.date}: VALID (within current week)`);
	});
}

// Logging function for data sources
function logDataSources(data: any, source: string, weekRange: string): void {
	console.log(`📊 DATA SOURCE AUDIT: ${source}`);
	console.log(`📅 Week Range: ${weekRange}`);
	console.log(`📈 Sample Data:`, data);
	console.log(`🔢 Data Count:`, Array.isArray(data) ? data.length : 'Single object');
}

// Interface definitions
interface LinnworksOrderData {
	date: string;
	count: number;
	formattedDate: string;
	channels?: {
		amazon: number;
		ebay: number;
		shopify: number;
		other: number;
	};
}

interface ExtendedMetric {
	name: string;
	values: number[];
	metricField: string | null;
	isHeader?: boolean;
	isSpacer?: boolean;
	isReadOnly?: boolean;
	isSubItem?: boolean;
	tooltip?: string;
}

// Load employee hours function (server-side adaptation)
async function loadEmployeeHoursForDateRange(
	startDate: Date,
	endDate: Date
): Promise<{
	totalHours: Record<string, number>;
	roleBreakdowns: Record<
		string,
		{
			management: number;
			packing: number;
			picking: number;
		}
	>;
}> {
	try {
		const startDateStr = startDate.toISOString().split('T')[0];
		const endDateStr = endDate.toISOString().split('T')[0];

		const { data, error } = await supabaseAdmin
			.from('daily_employee_hours')
			.select('work_date, hours_worked, employee_role')
			.gte('work_date', startDateStr)
			.lte('work_date', endDateStr);

		if (error) {
			console.error('Error fetching employee hours:', error);
			return { totalHours: {}, roleBreakdowns: {} };
		}

		// Group by date and sum hours
		const totalHours: Record<string, number> = {};
		const roleBreakdowns: Record<
			string,
			{
				management: number;
				packing: number;
				picking: number;
			}
		> = {};

		data?.forEach((record) => {
			const date = record.work_date;
			const hours = record.hours_worked || 0;
			const role = record.employee_role?.toLowerCase() || '';

			// Initialize if needed
			if (!totalHours[date]) {
				totalHours[date] = 0;
			}
			if (!roleBreakdowns[date]) {
				roleBreakdowns[date] = { management: 0, packing: 0, picking: 0 };
			}

			// Add to total
			totalHours[date] += hours;

			// Categorize by role
			if (role.includes('supervisor') || role.includes('manager')) {
				roleBreakdowns[date].management += hours;
			} else if (role.includes('associate')) {
				roleBreakdowns[date].packing += hours;
			} else if (role.includes('picking')) {
				roleBreakdowns[date].picking += hours;
			}
		});

		return { totalHours, roleBreakdowns };
	} catch (err) {
		console.error('Error loading employee hours:', err);
		return { totalHours: {}, roleBreakdowns: {} };
	}
}

// Create base metrics structure
function createBaseMetrics(): ExtendedMetric[] {
	return [
		{ name: '1.0 OPERATIONAL EFFICIENCY', values: [], metricField: null, isHeader: true },
		{ name: '1.1 Shipments Packed', values: new Array(7).fill(0), metricField: 'shipments_packed' },
		{ name: '1.2 Scheduled Hours', values: new Array(7).fill(0), metricField: 'scheduled_hours' },
		{ name: '1.3 Total Hours Used', values: new Array(7).fill(0), metricField: 'total_hours_used' },
		{ name: '1.3.1 Management Hours Used', values: new Array(7).fill(0), metricField: 'management_hours_used', isSubItem: true },
		{ name: '1.3.2 Packing Hours Used', values: new Array(7).fill(0), metricField: 'packing_hours_used', isSubItem: true },
		{ name: '1.3.3 Picking Hours Used', values: new Array(7).fill(0), metricField: 'picking_hours_used', isSubItem: true },
		{ name: '1.4 Labor Efficiency (shipments/hour)', values: new Array(7).fill(0), metricField: null },
		{ name: '1.5 Labor Utilization (%)', values: new Array(7).fill(0), metricField: null },
		{ name: '1.6 Packing Errors', values: new Array(7).fill(0), metricField: 'packing_errors' },
		{ name: '1.7 Packing Errors DPMO', values: new Array(7).fill(0), metricField: null },
		{ name: '1.8 Order Accuracy (%)', values: new Array(7).fill(0), metricField: null },
		{ name: '', values: [], metricField: null, isSpacer: true },
		{ name: '2.0 SALES & ORDER VOLUME', values: [], metricField: null, isHeader: true },
		{ name: '2.0 Total Sales', values: new Array(7).fill(0), metricField: 'total_sales' },
		{ name: '2.0.1 Amazon Sales', values: new Array(7).fill(0), metricField: 'amazon_sales', isSubItem: true },
		{ name: '2.0.2 eBay Sales', values: new Array(7).fill(0), metricField: 'ebay_sales', isSubItem: true },
		{ name: '2.0.3 Shopify Sales', values: new Array(7).fill(0), metricField: 'shopify_sales', isSubItem: true },
		{ name: '2.1 Linnworks Total Orders', values: new Array(7).fill(0), metricField: 'linnworks_total_orders' },
		{ name: '2.1.1 Amazon Orders', values: new Array(7).fill(0), metricField: 'amazon_orders', isSubItem: true },
		{ name: '2.1.2 eBay Orders', values: new Array(7).fill(0), metricField: 'ebay_orders', isSubItem: true },
		{ name: '2.1.3 Shopify Orders', values: new Array(7).fill(0), metricField: 'shopify_orders', isSubItem: true },
		{ name: '2.2 CHANNEL DISTRIBUTION', values: [], metricField: null, isHeader: true },
		{ name: '2.2.1 Amazon Orders %', values: new Array(7).fill(0), metricField: null },
		{ name: '2.2.2 eBay Orders %', values: new Array(7).fill(0), metricField: null },
		{ name: '2.2.3 Shopify Orders %', values: new Array(7).fill(0), metricField: null }
	];
}

// Main function to fetch fresh current week data
async function fetchFreshCurrentWeekData(): Promise<{ metrics: ExtendedMetric[], weekDates: Date[] }> {
	console.log('🚀 API: Starting fetchFreshCurrentWeekData for upload...');
	
	// Get current week dates
	const displayedMonday = getMonday(new Date());
	const weekDates = Array.from({ length: 7 }, (_, i) => {
		const date = new Date(displayedMonday);
		date.setDate(displayedMonday.getDate() + i);
		return date;
	});

	// Format dates for current week
	const mondayStr = displayedMonday.toISOString().split('T')[0];
	const sundayStr = new Date(displayedMonday.getTime() + 6 * 24 * 60 * 60 * 1000)
		.toISOString()
		.split('T')[0];

	const currentWeekStart = new Date(mondayStr);
	const currentWeekEnd = new Date(sundayStr);
	const weekRange = `${mondayStr} to ${sundayStr}`;

	console.log(`📅 API UPLOAD TARGET WEEK: ${weekRange}`);
	console.log(`🎯 Current week validation bounds: ${currentWeekStart.toISOString()} to ${currentWeekEnd.toISOString()}`);

	// Get scheduled hours from hours service
	const scheduledHoursData = await getScheduledHoursForDateRange(
		currentWeekStart,
		currentWeekEnd
	);

	// Validate scheduled hours data
	validateCurrentWeekData(scheduledHoursData, currentWeekStart, currentWeekEnd, 'Scheduled Hours API');
	logDataSources(scheduledHoursData, 'Scheduled Hours Service', weekRange);

	// Get fresh Linnworks and financial data for current week
	console.log(`🔄 API: Fetching Linnworks and Financial data for: ${weekRange}`);
	
	// Get the base URL for internal API calls
	const baseUrl = process.env.NODE_ENV === 'production' 
		? `https://${process.env.VERCEL_URL || 'localhost:5173'}` 
		: 'http://localhost:5173';
	
	const [linnworksResponse, financialResponse] = await Promise.all([
		fetch(`${baseUrl}/api/linnworks/weeklyOrderCounts?startDate=${mondayStr}&endDate=${sundayStr}`),
		fetch(`${baseUrl}/api/linnworks/financialData?startDate=${mondayStr}&endDate=${sundayStr}`)
	]);

	const [linnworksData, financialJson] = await Promise.all([
		linnworksResponse.json(),
		financialResponse.json()
	]);

	const linnworksOrdersData = linnworksData.dailyOrders || [];
	const financialData = financialJson.dailyData || [];

	// Validate API data for current week
	validateCurrentWeekData(linnworksOrdersData, currentWeekStart, currentWeekEnd, 'Linnworks Orders API');
	validateCurrentWeekData(financialData, currentWeekStart, currentWeekEnd, 'Financial Data API');
	
	logDataSources(linnworksOrdersData, 'Linnworks Orders API', weekRange);
	logDataSources(financialData, 'Financial Data API', weekRange);

	// Create fresh metrics
	let freshMetrics = createBaseMetrics();

	// Create lookup map for fresh data
	const dataByDay: Record<string, any> = {};

	// Add scheduled hours
	scheduledHoursData.forEach((hoursRecord) => {
		dataByDay[hoursRecord.date] = {
			date: hoursRecord.date,
			scheduled_hours: hoursRecord.hours
		};
	});

	// Add fresh Linnworks data
	linnworksOrdersData.forEach((dayData: LinnworksOrderData) => {
		const date = dayData.date;
		if (!dataByDay[date]) {
			dataByDay[date] = { date };
		}
		dataByDay[date].linnworks_completed_orders = dayData.count;

		if (dayData.channels) {
			dataByDay[date].linnworks_amazon_orders = dayData.channels.amazon;
			dataByDay[date].linnworks_ebay_orders = dayData.channels.ebay;
			dataByDay[date].linnworks_shopify_orders = dayData.channels.shopify;
			dataByDay[date].linnworks_other_orders = dayData.channels.other;
		}
	});

	// Add fresh financial data
	financialData?.forEach((dayData: any) => {
		const date = dayData.date;
		if (dataByDay[date]) {
			dataByDay[date].total_sales = dayData.salesData.totalSales;
			dataByDay[date].amazon_sales = dayData.salesData.amazonSales || 0;
			dataByDay[date].ebay_sales = dayData.salesData.ebaySales || 0;
			dataByDay[date].shopify_sales = dayData.salesData.shopifySales || 0;
			dataByDay[date].other_sales = dayData.salesData.otherSales || 0;
		}
	});

	// Populate fresh metrics with current week data (API data only)
	for (let i = 0; i < weekDates.length; i++) {
		const dateStr = weekDates[i].toISOString().split('T')[0];
		const dayData = dataByDay[dateStr];

		// Populate scheduled hours from hours service
		if (dayData?.scheduled_hours !== undefined) {
			const scheduledHoursIndex = freshMetrics.findIndex(
				(m: any) => m.name === '1.2 Scheduled Hours'
			);
			if (scheduledHoursIndex !== -1) {
				freshMetrics[scheduledHoursIndex].values[i] = dayData.scheduled_hours || 0;
			}
		}

		// Populate Linnworks and financial data
		if (dayData) {
			// Total Sales
			const totalSalesIndex = freshMetrics.findIndex((m: any) => m.name === '2.0 Total Sales');
			if (totalSalesIndex !== -1 && dayData.total_sales !== undefined) {
				freshMetrics[totalSalesIndex].values[i] = dayData.total_sales || 0;
			}

			// Channel-specific sales
			const amazonSalesIndex = freshMetrics.findIndex((m: any) => m.name === '2.0.1 Amazon Sales');
			if (amazonSalesIndex !== -1 && dayData.amazon_sales !== undefined) {
				freshMetrics[amazonSalesIndex].values[i] = dayData.amazon_sales || 0;
			}

			const ebaySalesIndex = freshMetrics.findIndex((m: any) => m.name === '2.0.2 eBay Sales');
			if (ebaySalesIndex !== -1 && dayData.ebay_sales !== undefined) {
				freshMetrics[ebaySalesIndex].values[i] = dayData.ebay_sales || 0;
			}

			const shopifySalesIndex = freshMetrics.findIndex((m: any) => m.name === '2.0.3 Shopify Sales');
			if (shopifySalesIndex !== -1 && dayData.shopify_sales !== undefined) {
				freshMetrics[shopifySalesIndex].values[i] = dayData.shopify_sales || 0;
			}

			// Linnworks Total Orders
			const linnworksTotalIndex = freshMetrics.findIndex((m: any) => m.name === '2.1 Linnworks Total Orders');
			if (linnworksTotalIndex !== -1 && dayData.linnworks_completed_orders !== undefined) {
				freshMetrics[linnworksTotalIndex].values[i] = dayData.linnworks_completed_orders || 0;
			}

			// Channel-specific orders
			const amazonOrdersIndex = freshMetrics.findIndex((m: any) => m.name === '2.1.1 Amazon Orders');
			if (amazonOrdersIndex !== -1 && dayData.linnworks_amazon_orders !== undefined) {
				freshMetrics[amazonOrdersIndex].values[i] = dayData.linnworks_amazon_orders || 0;
			}

			const ebayOrdersIndex = freshMetrics.findIndex((m: any) => m.name === '2.1.2 eBay Orders');
			if (ebayOrdersIndex !== -1 && dayData.linnworks_ebay_orders !== undefined) {
				freshMetrics[ebayOrdersIndex].values[i] = dayData.linnworks_ebay_orders || 0;
			}

			const shopifyOrdersIndex = freshMetrics.findIndex((m: any) => m.name === '2.1.3 Shopify Orders');
			if (shopifyOrdersIndex !== -1 && dayData.linnworks_shopify_orders !== undefined) {
				freshMetrics[shopifyOrdersIndex].values[i] = dayData.linnworks_shopify_orders || 0;
			}
		}
	}

	// ⚠️ CRITICAL: Fetch fresh employee hours data for current week upload
	console.log(`👥 API: Fetching Employee Hours data for upload: ${weekRange}`);
	let employeeHoursData: Record<string, number> = {};
	let employeeRoleBreakdowns: Record<string, { management: number; packing: number; picking: number; }> = {};
	
	try {
		const hoursResult = await loadEmployeeHoursForDateRange(currentWeekStart, currentWeekEnd);
		employeeHoursData = hoursResult.totalHours;
		employeeRoleBreakdowns = hoursResult.roleBreakdowns;
		
		// Validate employee hours data dates
		Object.keys(employeeHoursData).forEach(dateStr => {
			const dataDate = new Date(dateStr);
			const isInRange = dataDate >= currentWeekStart && dataDate <= currentWeekEnd;
			if (!isInRange) {
				const error = `❌ EMPLOYEE HOURS CONTAMINATION: Data for ${dateStr} is outside current week ${weekRange}`;
				console.error(error);
				throw new Error(error);
			}
		});
		
		logDataSources(employeeHoursData, 'Employee Hours Service (Upload)', weekRange);
		console.log(`✅ Employee hours data validated for current week upload`);
		
		// Populate employee hours data into fresh metrics
		for (let i = 0; i < weekDates.length; i++) {
			const dateStr = weekDates[i].toISOString().split('T')[0];
			
			// Total Hours Used
			const totalHoursIndex = freshMetrics.findIndex((m: any) => m.name === '1.3 Total Hours Used');
			if (totalHoursIndex !== -1 && employeeHoursData[dateStr] !== undefined) {
				freshMetrics[totalHoursIndex].values[i] = employeeHoursData[dateStr] || 0;
				console.log(`📊 API Upload: Set Total Hours for ${dateStr}: ${employeeHoursData[dateStr]}`);
			}
			
			// Role breakdown hours
			const roleBreakdown = employeeRoleBreakdowns[dateStr];
			if (roleBreakdown) {
				// Management Hours
				const managementIndex = freshMetrics.findIndex((m: any) => m.name === '1.3.1 Management Hours Used');
				if (managementIndex !== -1) {
					freshMetrics[managementIndex].values[i] = roleBreakdown.management || 0;
					console.log(`📊 API Upload: Set Management Hours for ${dateStr}: ${roleBreakdown.management}`);
				}
				
				// Packing Hours
				const packingIndex = freshMetrics.findIndex((m: any) => m.name === '1.3.2 Packing Hours Used');
				if (packingIndex !== -1) {
					freshMetrics[packingIndex].values[i] = roleBreakdown.packing || 0;
					console.log(`📊 API Upload: Set Packing Hours for ${dateStr}: ${roleBreakdown.packing}`);
				}
				
				// Picking Hours
				const pickingIndex = freshMetrics.findIndex((m: any) => m.name === '1.3.3 Picking Hours Used');
				if (pickingIndex !== -1) {
					freshMetrics[pickingIndex].values[i] = roleBreakdown.picking || 0;
					console.log(`📊 API Upload: Set Picking Hours for ${dateStr}: ${roleBreakdown.picking}`);
				}
			}
		}
	} catch (err) {
		console.error('❌ Failed to fetch or validate employee hours data for upload:', err);
		throw new Error(`Employee hours data validation failed: ${err}`);
	}

	console.log('✅ Fresh current week data validated and ready for upload via API');
	return { metrics: freshMetrics, weekDates };
}

// Compute current week metrics from fresh data
function computeCurrentWeekMetrics(freshMetrics: ExtendedMetric[], weekDates: Date[]): number[][] {
	console.log('API: Computing current week metrics from fresh data...');
	const daysCount = 7;

	return freshMetrics.map((metric: ExtendedMetric): number[] => {
		if (!metric.values) return [];

		if (metric.name === '1.4 Labor Efficiency (shipments/hour)') {
			const shipments = freshMetrics.find((m) => m.name === '2.1 Linnworks Total Orders')?.values ?? new Array(daysCount).fill(0);
			const packingHours = freshMetrics.find((m) => m.name === '1.3.2 Packing Hours Used')?.values ?? new Array(daysCount).fill(0);
			const pickingHours = freshMetrics.find((m) => m.name === '1.3.3 Picking Hours Used')?.values ?? new Array(daysCount).fill(0);
			return weekDates.map((_, i) => {
				const totalPackingPickingHours = (packingHours[i] || 0) + (pickingHours[i] || 0);
				return totalPackingPickingHours > 0 ? Math.round((shipments[i] / totalPackingPickingHours) * 100) / 100 : 0;
			});
		} else if (metric.name === '1.5 Labor Utilization (%)') {
			const actualHours = freshMetrics.find((m) => m.name === '1.3 Total Hours Used')?.values ?? new Array(daysCount).fill(0);
			const scheduledHrs = freshMetrics.find((m) => m.name === '1.2 Scheduled Hours')?.values ?? new Array(daysCount).fill(0);
			return weekDates.map((_, i) => scheduledHrs[i] > 0 ? Math.round((actualHours[i] / scheduledHrs[i]) * 10000) / 100 : 0);
		} else if (metric.name === '1.7 Packing Errors DPMO') {
			const shipments = freshMetrics.find((m) => m.name === '2.1 Linnworks Total Orders')?.values ?? new Array(daysCount).fill(0);
			const defects = freshMetrics.find((m) => m.name === '1.6 Packing Errors')?.values ?? new Array(daysCount).fill(0);
			return weekDates.map((_, i) => shipments[i] > 0 ? Math.round((defects[i] / shipments[i]) * 1000000) : 0);
		} else if (metric.name === '1.8 Order Accuracy (%)') {
			const shipments = freshMetrics.find((m) => m.name === '2.1 Linnworks Total Orders')?.values ?? new Array(daysCount).fill(0);
			const defects = freshMetrics.find((m) => m.name === '1.6 Packing Errors')?.values ?? new Array(daysCount).fill(0);
			return weekDates.map((_, i) => shipments[i] > 0 ? Math.round(((shipments[i] - defects[i]) / shipments[i]) * 10000) / 100 : 0);
		} else if (metric.name === '2.2.1 Amazon Orders %') {
			const totalOrders = freshMetrics.find((m) => m.name === '2.1 Linnworks Total Orders')?.values ?? new Array(daysCount).fill(0);
			const amazonOrders = freshMetrics.find((m) => m.name === '2.1.1 Amazon Orders')?.values ?? new Array(daysCount).fill(0);
			return weekDates.map((_, i) => totalOrders[i] > 0 ? Math.round((amazonOrders[i] / totalOrders[i]) * 10000) / 100 : 0);
		} else if (metric.name === '2.2.2 eBay Orders %') {
			const totalOrders = freshMetrics.find((m) => m.name === '2.1 Linnworks Total Orders')?.values ?? new Array(daysCount).fill(0);
			const ebayOrders = freshMetrics.find((m) => m.name === '2.1.2 eBay Orders')?.values ?? new Array(daysCount).fill(0);
			return weekDates.map((_, i) => totalOrders[i] > 0 ? Math.round((ebayOrders[i] / totalOrders[i]) * 10000) / 100 : 0);
		} else if (metric.name === '2.2.3 Shopify Orders %') {
			const totalOrders = freshMetrics.find((m) => m.name === '2.1 Linnworks Total Orders')?.values ?? new Array(daysCount).fill(0);
			const shopifyOrders = freshMetrics.find((m) => m.name === '2.1.3 Shopify Orders')?.values ?? new Array(daysCount).fill(0);
			return weekDates.map((_, i) => totalOrders[i] > 0 ? Math.round((shopifyOrders[i] / totalOrders[i]) * 10000) / 100 : 0);
		}
		return metric.values;
	});
}

/**
 * POST /api/upload-metric-review
 * Triggers the same upload logic as the frontend button, callable by Make.com
 * Optional body: { weekOffset: 0 } to upload a different week (0 = current week, -1 = last week)
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		console.log('🚀 API: Starting daily metric review upload via Make.com automation...');

		// Parse optional parameters
		let body = {};
		try {
			body = await request.json();
		} catch {
			// No body provided, use defaults
		}

		const { weekOffset = 0 } = body as { weekOffset?: number };

		// Step 1: Fetch fresh current week data (with optional week offset)
		const { metrics: currentWeekMetrics, weekDates } = await fetchFreshCurrentWeekData();

		// Step 2: Compute current week metrics from fresh data
		const currentWeekComputedMetrics = computeCurrentWeekMetrics(currentWeekMetrics, weekDates);

		// Step 3: Transform current week data for upload
		const reviewData = transformMetricsForReview(
			currentWeekMetrics,
			weekDates,
			currentWeekComputedMetrics
		);

		console.log('API: Transformed fresh current week data for upload:', reviewData);

		// Step 4: Upload to Supabase
		const success = await uploadDailyMetricReview(reviewData);

		if (success) {
			const message = `Successfully uploaded daily metric review for week ${weekDates[0].toLocaleDateString()} - ${weekDates[6].toLocaleDateString()} via API`;
			console.log(`✅ ${message}`);
			
			return new Response(JSON.stringify({ 
				success: true, 
				message,
				weekRange: `${weekDates[0].toLocaleDateString()} - ${weekDates[6].toLocaleDateString()}`,
				uploadedAt: new Date().toISOString()
			}), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		} else {
			throw new Error('Upload to Supabase failed');
		}

	} catch (err) {
		console.error('❌ API: Error uploading metric review:', err);
		
		return new Response(JSON.stringify({ 
			success: false, 
			error: err instanceof Error ? err.message : 'Unknown error occurred',
			timestamp: new Date().toISOString()
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};

/**
 * GET /api/upload-metric-review
 * Returns status and information about the current week that would be uploaded
 */
export const GET: RequestHandler = async () => {
	try {
		const displayedMonday = getMonday(new Date());
		const weekDates = Array.from({ length: 7 }, (_, i) => {
			const date = new Date(displayedMonday);
			date.setDate(displayedMonday.getDate() + i);
			return date;
		});

		return new Response(JSON.stringify({
			currentWeek: {
				start: weekDates[0].toISOString().split('T')[0],
				end: weekDates[6].toISOString().split('T')[0],
				range: `${weekDates[0].toLocaleDateString()} - ${weekDates[6].toLocaleDateString()}`
			},
			endpoint: '/api/upload-metric-review',
			method: 'POST',
			description: 'Call this endpoint with POST to trigger metric review upload for current week'
		}), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		return new Response(JSON.stringify({ 
			error: err instanceof Error ? err.message : 'Unknown error occurred' 
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
