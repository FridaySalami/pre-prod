<script lang="ts">
	import { onMount, tick, onDestroy } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import ExportCsv from '$lib/ExportCsv.svelte';
	import {
		getMonday,
		formatNumber,
		getWeekNumber,
		isToday,
		formatPercentage,
		getWowColor
	} from './utils';
	import MetricRow from './MetricRow.svelte';
	import { showToast } from '$lib/toastStore';
	import { getScheduledHoursForDateRange } from '$lib/schedule/hours-service';
	import {
		uploadDailyMetricReview,
		transformMetricsForReview
	} from '$lib/dailyMetricReviewService';
	import { getDailyHours } from '$lib/dailyHoursService';

	// Add this interface to your type definitions section at the top
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
		isSubItem?: boolean; // Add this line to fix the errors
		tooltip?: string;
	}

	const daysCount = 7;

	/**
	 * Computes an average from the given values and dates.
	 * @param values - The array of numbers.
	 * @param dates - The corresponding array of Date objects.
	 * @param options - Options to ignore zeros or exclude Sundays.
	 * @returns The computed average (or 0 if no values qualify).
	 */
	function computeMetricAverage(
		values: number[],
		dates: Date[],
		options: { ignoreZeros?: boolean; excludeSundays?: boolean } = {}
	): number {
		const { ignoreZeros = false, excludeSundays = false } = options;
		let total = 0;
		let count = 0;
		for (let i = 0; i < values.length; i++) {
			// Exclude Sundays if requested (getDay() returns 0 for Sunday)
			if (excludeSundays && dates[i].getDay() === 0) continue;
			// For shipments per hour, we want to ignore any zeros
			if (ignoreZeros && values[i] === 0) continue;
			total += values[i];
			count++;
		}
		return count > 0 ? total / count : 0;
	}

	function computeWoWChange(current: number, previous: number, invert: boolean = false): string {
		if (previous === 0) return 'N/A';
		// If 'invert' is true, a decrease (current < previous) becomes a positive percentage.
		let change = invert
			? ((previous - current) / previous) * 100
			: ((current - previous) / previous) * 100;
		return change.toFixed(2) + '%';
	}

	// Add this helper function to determine if a metric is a percentage metric
	function isCurrencyMetric(metricName: string): boolean {
		return (
			metricName === '2.0 Total Sales' ||
			metricName === '2.0.1 Amazon Sales' ||
			metricName === '2.0.2 eBay Sales' ||
			metricName === '2.0.3 Shopify Sales'
		); // These will be formatted with £ symbol
	}

	function isPercentageMetric(metricName: string): boolean {
		return (
			metricName.includes('%') ||
			metricName === '1.5 Labor Utilization (%)' ||
			metricName === '1.8 Order Accuracy (%)' ||
			metricName.startsWith('2.2.')
		); // All channel distribution percentage metrics
	}

	// B2C Amazon Fulfilment section with tooltips
	let b2cMetrics: ExtendedMetric[] = [
		{
			name: 'B2C Amazon Fulfilment',
			isHeader: true,
			values: new Array(daysCount).fill(0),
			metricField: null
		},
		{
			name: '1.1 Shipments Packed',
			values: new Array(daysCount).fill(0),
			metricField: null, // Changed to null since this will be auto-populated from Linnworks orders data
			isReadOnly: true, // Changed to read-only since this will be auto-populated
			tooltip:
				'Daily count of shipments packed and shipped. Automatically matches Linnworks Total Orders (2.1).'
		},
		{
			name: '1.2 Scheduled Hours',
			values: new Array(daysCount).fill(0),
			metricField: 'scheduled_hours',
			isReadOnly: true,
			tooltip:
				'Total scheduled work hours based on employee availability from the schedule page. This is automatically calculated and can only be modified by updating employee schedules and leave.'
		},
		{
			name: '1.3 Total Hours Used',
			values: new Array(daysCount).fill(0),
			metricField: 'hours_worked', // CHANGED from "actual_hours_worked" to match database column name
			isReadOnly: true, // Changed to read-only since this will be auto-populated
			tooltip:
				'Total labor hours from employee time tracking. Automatically calculated from daily employee hours data.'
		},
		{
			name: '1.3.1 Management Hours Used',
			values: new Array(daysCount).fill(0),
			metricField: null,
			isReadOnly: true,
			isSubItem: true,
			tooltip:
				'Total hours for management roles (Supervisor, Manager, B2C Accounts Manager). Automatically calculated from daily employee hours data.'
		},
		{
			name: '1.3.2 Packing Hours Used',
			values: new Array(daysCount).fill(0),
			metricField: null,
			isReadOnly: true,
			isSubItem: true,
			tooltip:
				'Total hours for packing roles (all Associate positions). Automatically calculated from daily employee hours data.'
		},
		{
			name: '1.3.3 Picking Hours Used',
			values: new Array(daysCount).fill(0),
			metricField: null,
			isReadOnly: true,
			isSubItem: true,
			tooltip:
				'Total hours for picking roles. Automatically calculated from daily employee hours data.'
		},
		{
			name: '1.4 Labor Efficiency (shipments/hour)',
			values: new Array(daysCount).fill(0),
			metricField: null,
			tooltip:
				'Calculated as Shipments Packed ÷ (Packing Hours Used + Picking Hours Used). Measures the number of shipments processed per direct fulfillment labor hour.'
		},
		{
			name: '1.5 Labor Utilization (%)',
			values: new Array(daysCount).fill(0),
			metricField: null,
			tooltip:
				'Calculated as (Total Hours Used ÷ Scheduled Hours) × 100. Measures how efficiently scheduled labor hours are being used.'
		}
	];

	// Spacer row.
	let spacer: ExtendedMetric = {
		name: '',
		isSpacer: true,
		values: new Array(daysCount).fill(0),
		metricField: null
	};

	// B2B Warehouse and On‑road section with tooltips
	let b2bMetrics: ExtendedMetric[] = [
		{
			name: 'B2C Amazon Financials',
			isHeader: true,
			values: new Array(daysCount).fill(0),
			metricField: null
		},
		{
			name: '2.0 Total Sales',
			values: new Array(daysCount).fill(0),
			metricField: 'total_sales',
			isReadOnly: true,
			tooltip: 'Total sales value for all orders from all channels each day.'
		},
		{
			name: '2.0.1 Amazon Sales',
			values: new Array(daysCount).fill(0),
			metricField: 'amazon_sales',
			isReadOnly: true,
			isSubItem: true,
			tooltip: 'Total sales value from Amazon orders each day.'
		},
		{
			name: '2.0.2 eBay Sales',
			values: new Array(daysCount).fill(0),
			metricField: 'ebay_sales',
			isReadOnly: true,
			isSubItem: true,
			tooltip: 'Total sales value from eBay orders each day.'
		},
		{
			name: '2.0.3 Shopify Sales',
			values: new Array(daysCount).fill(0),
			metricField: 'shopify_sales',
			isReadOnly: true,
			isSubItem: true,
			tooltip: 'Total sales value from Shopify orders each day.'
		},
		{
			name: '2.1 Linnworks Total Orders',
			values: new Array(daysCount).fill(0),
			metricField: 'linnworks_completed_orders',
			isReadOnly: true, // Mark as read-only since it's from an external API
			tooltip:
				'Total number of completed orders in Linnworks each day. Automatically synced from Linnworks API.'
		},
		{
			name: '2.1.1 Amazon Orders',
			values: new Array(daysCount).fill(0),
			metricField: 'linnworks_amazon_orders',
			isReadOnly: true,
			isSubItem: true,
			tooltip: 'Number of completed Amazon orders each day.'
		},
		{
			name: '2.1.2 eBay Orders',
			values: new Array(daysCount).fill(0),
			metricField: 'linnworks_ebay_orders',
			isReadOnly: true,
			isSubItem: true,
			tooltip: 'Number of completed eBay orders each day.'
		},
		{
			name: '2.1.3 Shopify Orders',
			values: new Array(daysCount).fill(0),
			metricField: 'linnworks_shopify_orders',
			isReadOnly: true,
			isSubItem: true,
			tooltip: 'Number of completed Shopify orders each day.'
		},
		{
			name: '2.2 Channel Percentage Distribution',
			isHeader: true,
			values: new Array(daysCount).fill(0),
			metricField: null
		},
		{
			name: '2.2.1 Amazon Orders %',
			values: new Array(daysCount).fill(0),
			metricField: null,
			isReadOnly: true,
			tooltip: 'Percentage of orders coming from Amazon channel.'
		},
		{
			name: '2.2.2 eBay Orders %',
			values: new Array(daysCount).fill(0),
			metricField: null,
			isReadOnly: true,
			tooltip: 'Percentage of orders coming from eBay channel.'
		},
		{
			name: '2.2.3 Shopify Orders %',
			values: new Array(daysCount).fill(0),
			metricField: null,
			isReadOnly: true,
			tooltip: 'Percentage of orders coming from Shopify channel.'
		}
	];

	// Create spacer for after Other Sales
	let salesOrdersSpacer: ExtendedMetric = {
		name: '',
		isSpacer: true,
		values: new Array(daysCount).fill(0),
		metricField: null
	};

	// Insert the spacer after 2.0.3 Shopify Sales (at index 5)
	let financialsWithSpacer = [...b2bMetrics.slice(0, 5), salesOrdersSpacer, ...b2bMetrics.slice(5)];

	// Combine sections.
	let metrics: ExtendedMetric[] = [...b2cMetrics, spacer, ...financialsWithSpacer];

	// Week navigation and date calculations.
	let weekOffset: number = 0;
	const msPerDay = 24 * 60 * 60 * 1000;
	let loading = false;

	// Add missing variables for the template
	let isLoading = false;
	let loadError: string | null = null;

	$: displayedMonday = (() => {
		const currentMonday = getMonday(new Date());
		return new Date(currentMonday.getTime() + weekOffset * 7 * msPerDay);
	})();

	$: isCurrentWeek =
		getMonday(new Date()).toISOString() === getMonday(new Date(displayedMonday)).toISOString();

	$: weekDates = (() => {
		const dates: Date[] = [];
		for (let i = 0; i < daysCount; i++) {
			dates.push(new Date(displayedMonday.getTime() + i * msPerDay));
		}
		return dates;
	})();

	$: previousWeekDates = (() => {
		const prevMonday = new Date(displayedMonday.getTime() - 7 * msPerDay);
		const dates: Date[] = [];
		for (let i = 0; i < daysCount; i++) {
			dates.push(new Date(prevMonday.getTime() + i * msPerDay));
		}
		return dates;
	})();

	$: currentDayIndex = isCurrentWeek
		? Math.max(weekDates.findIndex((date) => isToday(date)) - 1, 0)
		: daysCount - 1;

	// Modify the computedMetrics calculation to include the percentage calculations
	$: computedMetrics = metrics.map((metric: ExtendedMetric, idx): number[] => {
		if (!metric.values) return [];

		if (metric.name === '1.4 Labor Efficiency (shipments/hour)') {
			const shipments =
				metrics.find((m) => m.name === '2.1 Linnworks Total Orders')?.values ??
				new Array(daysCount).fill(0);
			const packingHours =
				metrics.find((m) => m.name === '1.3.2 Packing Hours Used')?.values ??
				new Array(daysCount).fill(0);
			const pickingHours =
				metrics.find((m) => m.name === '1.3.3 Picking Hours Used')?.values ??
				new Array(daysCount).fill(0);
			return weekDates.map((_, i) => {
				const totalPackingPickingHours = (packingHours[i] || 0) + (pickingHours[i] || 0);
				return totalPackingPickingHours > 0
					? Math.round((shipments[i] / totalPackingPickingHours) * 100) / 100
					: 0;
			});
		} else if (metric.name === '1.5 Labor Utilization (%)') {
			const actualHours =
				metrics.find((m) => m.name === '1.3 Total Hours Used')?.values ??
				new Array(daysCount).fill(0);
			const scheduledHrs =
				metrics.find((m) => m.name === '1.2 Scheduled Hours')?.values ??
				new Array(daysCount).fill(0);
			return weekDates.map((_, i) =>
				scheduledHrs[i] > 0 ? Math.round((actualHours[i] / scheduledHrs[i]) * 10000) / 100 : 0
			);
		} else if (metric.name === '1.7 Packing Errors DPMO') {
			const shipments =
				metrics.find((m) => m.name === '2.1 Linnworks Total Orders')?.values ??
				new Array(daysCount).fill(0);
			const defects =
				metrics.find((m) => m.name === '1.6 Packing Errors')?.values ??
				new Array(daysCount).fill(0);
			return weekDates.map((_, i) =>
				shipments[i] > 0 ? Math.round((defects[i] / shipments[i]) * 1000000) : 0
			);
		} else if (metric.name === '1.8 Order Accuracy (%)') {
			const shipments =
				metrics.find((m) => m.name === '2.1 Linnworks Total Orders')?.values ??
				new Array(daysCount).fill(0);
			const defects =
				metrics.find((m) => m.name === '1.6 Packing Errors')?.values ??
				new Array(daysCount).fill(0);
			return weekDates.map((_, i) =>
				shipments[i] > 0
					? Math.round(((shipments[i] - defects[i]) / shipments[i]) * 10000) / 100
					: 0
			);
		}
		// Add new percentage calculations for channel distribution
		else if (metric.name === '2.2.1 Amazon Orders %') {
			const totalOrders =
				metrics.find((m) => m.name === '2.1 Linnworks Total Orders')?.values ??
				new Array(daysCount).fill(0);
			const amazonOrders =
				metrics.find((m) => m.name === '2.1.1 Amazon Orders')?.values ??
				new Array(daysCount).fill(0);
			return weekDates.map((_, i) =>
				totalOrders[i] > 0 ? Math.round((amazonOrders[i] / totalOrders[i]) * 10000) / 100 : 0
			);
		} else if (metric.name === '2.2.2 eBay Orders %') {
			const totalOrders =
				metrics.find((m) => m.name === '2.1 Linnworks Total Orders')?.values ??
				new Array(daysCount).fill(0);
			const ebayOrders =
				metrics.find((m) => m.name === '2.1.2 eBay Orders')?.values ?? new Array(daysCount).fill(0);
			return weekDates.map((_, i) =>
				totalOrders[i] > 0 ? Math.round((ebayOrders[i] / totalOrders[i]) * 10000) / 100 : 0
			);
		} else if (metric.name === '2.2.3 Shopify Orders %') {
			const totalOrders =
				metrics.find((m) => m.name === '2.1 Linnworks Total Orders')?.values ??
				new Array(daysCount).fill(0);
			const shopifyOrders =
				metrics.find((m) => m.name === '2.1.3 Shopify Orders')?.values ??
				new Array(daysCount).fill(0);
			return weekDates.map((_, i) =>
				totalOrders[i] > 0 ? Math.round((shopifyOrders[i] / totalOrders[i]) * 10000) / 100 : 0
			);
			// Other Orders % calculation removed
		}
		return metric.values;
	});

	// Update the week-over-week calculations to handle percentage metrics correctly
	$: weekOverWeekChanges = metrics.map((metric, idx) => {
		// Skip headers and spacers
		if (metric.isHeader || metric.isSpacer) return 'N/A';

		let currentTotal: number;
		let prevTotal: number;

		// Determine if we should use partial or full previous week based on current week status
		if (isCurrentWeek) {
			currentTotal = currentTotals[idx];
			prevTotal = partialPreviousTotalsComputed[idx]; // Use partial previous week data
		} else {
			currentTotal = currentTotals[idx];
			prevTotal = previousTotalsComputed[idx]; // Use full previous week data
		}

		// If previous total is 0, we can't calculate a percentage change
		if (prevTotal === 0) return 'N/A';

		const change = ((currentTotal - prevTotal) / prevTotal) * 100;

		// Format the change value
		return `${change > 0 ? '+' : ''}${change.toFixed(2)}%`;
	});

	$: exportMetrics = metrics.map((metric: ExtendedMetric, idx) => {
		if (metric.isHeader || metric.isSpacer) {
			return metric;
		} else if (metric.metricField === null) {
			// For computed metrics, replace values with the computed values
			return {
				...metric,
				values: computedMetrics[idx] || metric.values
			};
		} else {
			return metric;
		}
	});

	// Add a function to format metric values with appropriate units
	function formatMetricValue(value: number, metricName: string): string {
		if (isPercentageMetric(metricName)) {
			return formatPercentage(value);
		}
		if (isCurrencyMetric(metricName)) {
			return new Intl.NumberFormat('en-GB', {
				style: 'currency',
				currency: 'GBP',
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			}).format(value);
		}
		return formatNumber(value);
	}

	// Compute current totals.
	$: currentTotals = metrics.map((metric: ExtendedMetric, idx) => {
		if (!metric.values) return 0;
		// Choose the source array: for computed metrics use computedMetrics; for others, use metric.values.
		let arr: number[] = metric.metricField === null ? computedMetrics[idx] : metric.values;
		const end = isCurrentWeek
			? currentDayIndex >= 0
				? currentDayIndex
				: daysCount - 1
			: arr.length - 1;
		const currentSlice = arr.slice(0, end + 1);

		if (metric.metricField === null) {
			// For computed metrics, compute an average instead of summing.
			if (
				metric.name === '1.4 Labor Efficiency (shipments/hour)' ||
				metric.name === '1.5 Labor Utilization (%)'
			) {
				// For both Labor Efficiency and Utilization, exclude zeros and Sundays
				return computeMetricAverage(currentSlice, weekDates.slice(0, end + 1), {
					ignoreZeros: true,
					excludeSundays: true
				});
			} else if (
				metric.name === '1.7 Packing Errors DPMO' ||
				metric.name === '1.8 Order Accuracy (%)' ||
				metric.name === '2.2.1 Amazon Orders %' ||
				metric.name === '2.2.2 eBay Orders %' ||
				metric.name === '2.2.3 Shopify Orders %'
			) {
				// For error metrics and channel percentages, compute average
				return computeMetricAverage(currentSlice, weekDates.slice(0, end + 1), {
					ignoreZeros: false,
					excludeSundays: true
				});
			} else if (
				metric.name === '1.1 Shipments Packed' ||
				metric.name === '1.3.1 Management Hours Used' ||
				metric.name === '1.3.2 Packing Hours Used' ||
				metric.name === '1.3.3 Picking Hours Used'
			) {
				// For shipments packed and role breakdown hours, sum the values (they're additive totals)
				return currentSlice.reduce((acc, v) => acc + v, 0);
			} else {
				return 0;
			}
		} else {
			// For non-computed metrics, sum the values.
			return currentSlice.reduce((acc, v) => acc + v, 0);
		}
	});
	// Previous week totals.
	let previousTotals: number[] = metrics.map(() => 0);
	let previousWeekMetrics: number[][] = metrics.map(() => new Array(daysCount).fill(0));
	async function loadPreviousWeekTotals() {
		try {
			let totals = metrics.map(() => 0);
			previousWeekMetrics = metrics.map(() => new Array(daysCount).fill(0));

			// Format dates for API
			const startDateStr = previousWeekDates[0].toISOString().split('T')[0];
			const endDateStr = previousWeekDates[previousWeekDates.length - 1]
				.toISOString()
				.split('T')[0];

			// Get scheduled hours from hours service
			const scheduledHoursData = await getScheduledHoursForDateRange(
				new Date(startDateStr),
				new Date(endDateStr)
			);

			// Fetch Linnworks and financial data for previous week
			let linnworksOrdersData: LinnworksOrderData[] = [];
			let prevWeekFinancialData: any = null;
			try {
				console.log(
					'Fetching previous week Linnworks and financial data for date range:',
					startDateStr,
					'to',
					endDateStr
				);
				const [linnworksResponse, financialResponse] = await Promise.all([
					fetch(`/api/linnworks/weeklyOrderCounts?startDate=${startDateStr}&endDate=${endDateStr}`),
					fetch(`/api/linnworks/financialData?startDate=${startDateStr}&endDate=${endDateStr}`)
				]);

				if (!linnworksResponse.ok) {
					throw new Error(
						`API Error ${linnworksResponse.status}: ${await linnworksResponse.text()}`
					);
				}

				const [linnworksData, financialJson] = await Promise.all([
					linnworksResponse.json(),
					financialResponse.json()
				]);

				linnworksOrdersData = linnworksData.dailyOrders || [];
				prevWeekFinancialData = financialJson.dailyData || [];
				console.log('Fetched previous week data:', {
					orders: linnworksOrdersData,
					financial: prevWeekFinancialData
				});
			} catch (err) {
				console.error('Failed to fetch previous week data:', err);
				// Continue without Linnworks/financial data
			}

			// Create a lookup map for API data only
			const dataByDay: Record<string, any> = {};

			// Add scheduled hours
			scheduledHoursData.forEach((hoursRecord) => {
				dataByDay[hoursRecord.date] = {
					date: hoursRecord.date,
					scheduled_hours: hoursRecord.hours
				};
			});

			// Add Linnworks data to the lookup map
			linnworksOrdersData.forEach((dayData: LinnworksOrderData) => {
				const date = dayData.date;
				if (!dataByDay[date]) {
					dataByDay[date] = { date };
				}
				// Add Linnworks data to our lookup map
				dataByDay[date].linnworks_completed_orders = dayData.count;

				// Add channel-specific metrics if available
				if (dayData.channels) {
					dataByDay[date].linnworks_amazon_orders = dayData.channels.amazon;
					dataByDay[date].linnworks_ebay_orders = dayData.channels.ebay;
					dataByDay[date].linnworks_shopify_orders = dayData.channels.shopify;
					dataByDay[date].linnworks_other_orders = dayData.channels.other;
				}
			});

			// Add financial data to the lookup map
			prevWeekFinancialData?.forEach((dayData: any) => {
				const date = dayData.date;
				if (dataByDay[date]) {
					dataByDay[date].total_sales = dayData.salesData.totalSales;

					// Add channel-specific sales data
					dataByDay[date].amazon_sales = dayData.salesData.amazonSales || 0;
					dataByDay[date].ebay_sales = dayData.salesData.ebaySales || 0;
					dataByDay[date].shopify_sales = dayData.salesData.shopifySales || 0;
					dataByDay[date].other_sales = dayData.salesData.otherSales || 0;
				}
			});

			// Fetch employee hours data for previous week
			let prevEmployeeHoursData: Record<string, number> = {};
			let prevEmployeeRoleBreakdowns: Record<
				string,
				{
					management: number;
					packing: number;
					picking: number;
				}
			> = {};
			try {
				const prevWeekStartDate = previousWeekDates[0];
				const prevWeekEndDate = previousWeekDates[previousWeekDates.length - 1];
				const hoursResult = await loadEmployeeHoursForDateRange(prevWeekStartDate, prevWeekEndDate);
				prevEmployeeHoursData = hoursResult.totalHours;
				prevEmployeeRoleBreakdowns = hoursResult.roleBreakdowns;
				console.log('Fetched previous week employee hours data:', prevEmployeeHoursData);
				console.log('Fetched previous week role breakdowns:', prevEmployeeRoleBreakdowns);
			} catch (err) {
				console.error('Failed to fetch previous week employee hours data:', err);
				// Continue without employee hours data
			}

			// Process data for each day
			for (let i = 0; i < previousWeekDates.length; i++) {
				const dateStr = previousWeekDates[i].toISOString().split('T')[0];
				const data = dataByDay[dateStr];

				// Only populate scheduled hours from hours service (no database metrics)
				const scheduledHoursMetricIndex = metrics.findIndex(
					(m) => m.name === '1.2 Scheduled Hours'
				);
				if (scheduledHoursMetricIndex !== -1 && data?.scheduled_hours !== undefined) {
					previousWeekMetrics[scheduledHoursMetricIndex][i] = data.scheduled_hours || 0;
					totals[scheduledHoursMetricIndex] += data.scheduled_hours || 0;
				}

				// Populate Linnworks and financial data for previous week
				if (data) {
					// Total Sales
					const totalSalesIndex = metrics.findIndex((m) => m.name === '2.0 Total Sales');
					if (totalSalesIndex !== -1 && data.total_sales !== undefined) {
						previousWeekMetrics[totalSalesIndex][i] = data.total_sales || 0;
						totals[totalSalesIndex] += data.total_sales || 0;
					}

					// Channel-specific sales
					const amazonSalesIndex = metrics.findIndex((m) => m.name === '2.0.1 Amazon Sales');
					if (amazonSalesIndex !== -1 && data.amazon_sales !== undefined) {
						previousWeekMetrics[amazonSalesIndex][i] = data.amazon_sales || 0;
						totals[amazonSalesIndex] += data.amazon_sales || 0;
					}

					const ebaySalesIndex = metrics.findIndex((m) => m.name === '2.0.2 eBay Sales');
					if (ebaySalesIndex !== -1 && data.ebay_sales !== undefined) {
						previousWeekMetrics[ebaySalesIndex][i] = data.ebay_sales || 0;
						totals[ebaySalesIndex] += data.ebay_sales || 0;
					}

					const shopifySalesIndex = metrics.findIndex((m) => m.name === '2.0.3 Shopify Sales');
					if (shopifySalesIndex !== -1 && data.shopify_sales !== undefined) {
						previousWeekMetrics[shopifySalesIndex][i] = data.shopify_sales || 0;
						totals[shopifySalesIndex] += data.shopify_sales || 0;
					}

					// Linnworks Total Orders
					const linnworksTotalIndex = metrics.findIndex(
						(m) => m.name === '2.1 Linnworks Total Orders'
					);
					if (linnworksTotalIndex !== -1 && data.linnworks_completed_orders !== undefined) {
						previousWeekMetrics[linnworksTotalIndex][i] = data.linnworks_completed_orders || 0;
						totals[linnworksTotalIndex] += data.linnworks_completed_orders || 0;
					}

					// Channel-specific orders
					const amazonOrdersIndex = metrics.findIndex((m) => m.name === '2.1.1 Amazon Orders');
					if (amazonOrdersIndex !== -1 && data.linnworks_amazon_orders !== undefined) {
						previousWeekMetrics[amazonOrdersIndex][i] = data.linnworks_amazon_orders || 0;
						totals[amazonOrdersIndex] += data.linnworks_amazon_orders || 0;
					}

					const ebayOrdersIndex = metrics.findIndex((m) => m.name === '2.1.2 eBay Orders');
					if (ebayOrdersIndex !== -1 && data.linnworks_ebay_orders !== undefined) {
						previousWeekMetrics[ebayOrdersIndex][i] = data.linnworks_ebay_orders || 0;
						totals[ebayOrdersIndex] += data.linnworks_ebay_orders || 0;
					}

					const shopifyOrdersIndex = metrics.findIndex((m) => m.name === '2.1.3 Shopify Orders');
					if (shopifyOrdersIndex !== -1 && data.linnworks_shopify_orders !== undefined) {
						previousWeekMetrics[shopifyOrdersIndex][i] = data.linnworks_shopify_orders || 0;
						totals[shopifyOrdersIndex] += data.linnworks_shopify_orders || 0;
					}
				}

				// Populate employee hours data for previous week (overrides database values)
				const totalHoursMetricIndex = metrics.findIndex((m) => m.name === '1.3 Total Hours Used');
				if (totalHoursMetricIndex !== -1 && prevEmployeeHoursData[dateStr] !== undefined) {
					previousWeekMetrics[totalHoursMetricIndex][i] = prevEmployeeHoursData[dateStr] || 0;
					// Update totals accordingly
					totals[totalHoursMetricIndex] += prevEmployeeHoursData[dateStr] || 0;
				}

				// Populate role breakdown hours for previous week
				const roleBreakdown = prevEmployeeRoleBreakdowns[dateStr];
				if (roleBreakdown) {
					const managementHoursIndex = metrics.findIndex(
						(m) => m.name === '1.3.1 Management Hours Used'
					);
					if (managementHoursIndex !== -1) {
						previousWeekMetrics[managementHoursIndex][i] = roleBreakdown.management || 0;
						totals[managementHoursIndex] += roleBreakdown.management || 0;
					}

					const packingHoursIndex = metrics.findIndex((m) => m.name === '1.3.2 Packing Hours Used');
					if (packingHoursIndex !== -1) {
						previousWeekMetrics[packingHoursIndex][i] = roleBreakdown.packing || 0;
						totals[packingHoursIndex] += roleBreakdown.packing || 0;
					}

					const pickingHoursIndex = metrics.findIndex((m) => m.name === '1.3.3 Picking Hours Used');
					if (pickingHoursIndex !== -1) {
						previousWeekMetrics[pickingHoursIndex][i] = roleBreakdown.picking || 0;
						totals[pickingHoursIndex] += roleBreakdown.picking || 0;
					}
				}

				// Populate shipments packed with Linnworks Total Orders data for previous week (auto-sync)
				const shipmentsPackedIndex = metrics.findIndex((m) => m.name === '1.1 Shipments Packed');
				const linnworksOrdersIndex = metrics.findIndex(
					(m) => m.name === '2.1 Linnworks Total Orders'
				);
				if (shipmentsPackedIndex !== -1 && linnworksOrdersIndex !== -1) {
					const ordersValue = previousWeekMetrics[linnworksOrdersIndex][i] || 0;
					previousWeekMetrics[shipmentsPackedIndex][i] = ordersValue;
					totals[shipmentsPackedIndex] += ordersValue;
				}
			}

			previousTotals = totals;
		} catch (err) {
			console.error('Error loading previous week data:', err);
		}
	}
	$: previousTotalsComputed = metrics.map((metric, idx) => {
		if (!metric.values) return 0;
		if (metric.metricField === null) {
			// For Labor Efficiency and Utilization, compute using totals
			if (metric.name === '1.4 Labor Efficiency (shipments/hour)') {
				const totShipments =
					previousWeekMetrics[
						metrics.findIndex((m) => m.name === '2.1 Linnworks Total Orders')
					]?.reduce((acc, val) => acc + val, 0) ?? 0;
				const totPackingHours =
					previousWeekMetrics[
						metrics.findIndex((m) => m.name === '1.3.2 Packing Hours Used')
					]?.reduce((acc, val) => acc + val, 0) ?? 0;
				const totPickingHours =
					previousWeekMetrics[
						metrics.findIndex((m) => m.name === '1.3.3 Picking Hours Used')
					]?.reduce((acc, val) => acc + val, 0) ?? 0;
				const totPackingPickingHours = totPackingHours + totPickingHours;
				return totPackingPickingHours > 0
					? Math.round((totShipments / totPackingPickingHours) * 100) / 100
					: 0;
			}
			if (metric.name === '1.5 Labor Utilization (%)') {
				const totActualHours =
					previousWeekMetrics[metrics.findIndex((m) => m.name === '1.3 Total Hours Used')]?.reduce(
						(acc, val) => acc + val,
						0
					) ?? 0;
				const totScheduledHours =
					previousWeekMetrics[metrics.findIndex((m) => m.name === '1.2 Scheduled Hours')]?.reduce(
						(acc, val) => acc + val,
						0
					) ?? 0;
				return totScheduledHours > 0
					? Math.round((totActualHours / totScheduledHours) * 10000) / 100
					: 0;
			}
			// For shipments packed and role breakdown hours, sum the values (they're additive totals)
			if (
				metric.name === '1.1 Shipments Packed' ||
				metric.name === '1.3.1 Management Hours Used' ||
				metric.name === '1.3.2 Packing Hours Used' ||
				metric.name === '1.3.3 Picking Hours Used'
			) {
				return previousWeekMetrics[idx].reduce((acc, v) => acc + v, 0);
			}
			// For other computed metrics, average over all days of the previous week
			return computeMetricAverage(previousWeekMetrics[idx], previousWeekDates, {
				ignoreZeros: false,
				excludeSundays: true
			});
		} else {
			// For non-computed metrics, sum the values.
			return previousWeekMetrics[idx].reduce((acc, v) => acc + v, 0);
		}
	});
	$: partialPreviousTotalsComputed = metrics.map((metric, idx) => {
		let arr = previousWeekMetrics[idx];
		const end = isCurrentWeek
			? currentDayIndex >= 0
				? currentDayIndex
				: daysCount - 1
			: arr.length - 1;
		const slicedValues = arr.slice(0, end + 1);
		const slicedDates = previousWeekDates.slice(0, end + 1);

		// Check if this is a percentage metric that should be averaged
		if (metric.metricField === null) {
			// For Labor Efficiency and Utilization, compute using total values for the period
			if (metric.name === '1.4 Labor Efficiency (shipments/hour)') {
				const shipmentIdx = metrics.findIndex((m) => m.name === '2.1 Linnworks Total Orders');
				const packingHoursIdx = metrics.findIndex((m) => m.name === '1.3.2 Packing Hours Used');
				const pickingHoursIdx = metrics.findIndex((m) => m.name === '1.3.3 Picking Hours Used');

				const shipments = previousWeekMetrics[shipmentIdx]?.slice(0, end + 1) ?? [];
				const packingHours = previousWeekMetrics[packingHoursIdx]?.slice(0, end + 1) ?? [];
				const pickingHours = previousWeekMetrics[pickingHoursIdx]?.slice(0, end + 1) ?? [];

				const totalShipments = shipments.reduce((acc, val) => acc + val, 0);
				const totalPackingHours = packingHours.reduce((acc, val) => acc + val, 0);
				const totalPickingHours = pickingHours.reduce((acc, val) => acc + val, 0);
				const totalPackingPickingHours = totalPackingHours + totalPickingHours;

				return totalPackingPickingHours > 0
					? Math.round((totalShipments / totalPackingPickingHours) * 100) / 100
					: 0;
			}
			if (metric.name === '1.5 Labor Utilization (%)') {
				const actualHoursIdx = metrics.findIndex((m) => m.name === '1.3 Total Hours Used');
				const scheduledHoursIdx = metrics.findIndex((m) => m.name === '1.2 Scheduled Hours');

				const actualHours = previousWeekMetrics[actualHoursIdx]?.slice(0, end + 1) ?? [];
				const scheduledHours = previousWeekMetrics[scheduledHoursIdx]?.slice(0, end + 1) ?? [];

				const totalActualHours = actualHours.reduce((acc, val) => acc + val, 0);
				const totalScheduledHours = scheduledHours.reduce((acc, val) => acc + val, 0);

				return totalScheduledHours > 0
					? Math.round((totalActualHours / totalScheduledHours) * 10000) / 100
					: 0;
			}
			// For shipments packed and role breakdown hours, sum the values (they're additive totals)
			if (
				metric.name === '1.1 Shipments Packed' ||
				metric.name === '1.3.1 Management Hours Used' ||
				metric.name === '1.3.2 Packing Hours Used' ||
				metric.name === '1.3.3 Picking Hours Used'
			) {
				return slicedValues.reduce((acc, v) => acc + v, 0);
			}
			// For other metrics that need special averaging
			if (
				metric.name === '2.2.1 Amazon Orders %' ||
				metric.name === '2.2.2 eBay Orders %' ||
				metric.name === '2.2.3 Shopify Orders %'
			) {
				return computeMetricAverage(slicedValues, slicedDates, {
					ignoreZeros: false,
					excludeSundays: true
				});
			}
		}
		// For non-computed metrics, sum the values
		return slicedValues.reduce((acc, v) => acc + v, 0);
	});

	async function loadMetrics() {
		try {
			loading = true;

			// Format dates for API queries
			const mondayStr = displayedMonday.toISOString().split('T')[0];
			const sundayStr = new Date(displayedMonday.getTime() + 6 * 24 * 60 * 60 * 1000)
				.toISOString()
				.split('T')[0];

			// Get scheduled hours from hours service
			const scheduledHoursData = await getScheduledHoursForDateRange(
				new Date(mondayStr),
				new Date(sundayStr)
			);

			// Fetch Linnworks orders and financial data
			let linnworksOrdersData: LinnworksOrderData[] = [];
			let financialData: any = null;
			try {
				console.log('Fetching Linnworks data for date range:', mondayStr, 'to', sundayStr);
				const [linnworksResponse, financialResponse] = await Promise.all([
					fetch(`/api/linnworks/weeklyOrderCounts?startDate=${mondayStr}&endDate=${sundayStr}`),
					fetch(`/api/linnworks/financialData?startDate=${mondayStr}&endDate=${sundayStr}`)
				]);

				if (!linnworksResponse.ok) {
					throw new Error(
						`API Error ${linnworksResponse.status}: ${await linnworksResponse.text()}`
					);
				}

				if (!linnworksResponse.ok || !financialResponse.ok) {
					throw new Error(
						`API Error - Orders: ${linnworksResponse.status}, Financial: ${financialResponse.status}`
					);
				}

				const [linnworksData, financialJson] = await Promise.all([
					linnworksResponse.json(),
					financialResponse.json()
				]);

				linnworksOrdersData = linnworksData.dailyOrders || [];
				financialData = financialJson.dailyData || [];
				console.log('Fetched Linnworks data:', {
					orders: linnworksOrdersData,
					financial: financialData
				});
			} catch (err) {
				console.error('Failed to fetch Linnworks data:', err);
				// Continue without Linnworks data
			}

			// Fetch employee hours data
			let employeeHoursData: Record<string, number> = {};
			let employeeRoleBreakdowns: Record<
				string,
				{
					management: number;
					packing: number;
					picking: number;
				}
			> = {};
			try {
				const sundayDate = new Date(displayedMonday.getTime() + 6 * 24 * 60 * 60 * 1000);
				const hoursResult = await loadEmployeeHoursForDateRange(displayedMonday, sundayDate);
				employeeHoursData = hoursResult.totalHours;
				employeeRoleBreakdowns = hoursResult.roleBreakdowns;
				console.log('Fetched employee hours data:', employeeHoursData);
				console.log('Fetched role breakdowns:', employeeRoleBreakdowns);
			} catch (err) {
				console.error('Failed to fetch employee hours data:', err);
				// Continue without employee hours data
			}

			// Create a lookup map for API data
			const dataByDay: Record<string, any> = {};

			// Add scheduled hours to lookup map
			scheduledHoursData.forEach((hoursRecord) => {
				dataByDay[hoursRecord.date] = {
					date: hoursRecord.date,
					scheduled_hours: hoursRecord.hours
				};
			});

			// Add Linnworks data to the lookup map
			linnworksOrdersData.forEach((dayData: LinnworksOrderData) => {
				const date = dayData.date;
				if (!dataByDay[date]) {
					dataByDay[date] = { date };
				}
				// Add Linnworks data to our lookup map
				dataByDay[date].linnworks_completed_orders = dayData.count;

				// Add channel-specific metrics if available
				if (dayData.channels) {
					dataByDay[date].linnworks_amazon_orders = dayData.channels.amazon;
					dataByDay[date].linnworks_ebay_orders = dayData.channels.ebay;
					dataByDay[date].linnworks_shopify_orders = dayData.channels.shopify;
					dataByDay[date].linnworks_other_orders = dayData.channels.other;
				}
			});

			// Add financial data
			interface FinancialDayData {
				date: string;
				formattedDate: string;
				salesData: {
					totalSales: number;
					amazonSales?: number;
					ebaySales?: number;
					shopifySales?: number;
					otherSales?: number;
				};
			}

			financialData?.forEach((dayData: FinancialDayData) => {
				const date = dayData.date; // Using the ISO date string directly
				if (dataByDay[date]) {
					dataByDay[date].total_sales = dayData.salesData.totalSales;

					// Add channel-specific sales data
					dataByDay[date].amazon_sales = dayData.salesData.amazonSales || 0;
					dataByDay[date].ebay_sales = dayData.salesData.ebaySales || 0;
					dataByDay[date].shopify_sales = dayData.salesData.shopifySales || 0;
					dataByDay[date].other_sales = dayData.salesData.otherSales || 0;
				} else {
					console.log('Missing data for date:', date, 'in dataByDay');
				}
			});

			console.log('Financial data mapping:', {
				financialData,
				dataByDay
			});

			// Reset metrics to default values (initialize with zeros)
			let updatedMetrics = metrics.map((metric) => ({
				...metric,
				values: new Array(daysCount).fill(0)
			}));

			// Populate with data from APIs only (no database fields)
			for (let i = 0; i < weekDates.length; i++) {
				const dateStr = weekDates[i].toISOString().split('T')[0];
				const dayData = dataByDay[dateStr];

				// Populate scheduled hours from hours service
				const scheduledHoursMetricIndex = updatedMetrics.findIndex(
					(m) => m.name === '1.2 Scheduled Hours'
				);
				if (scheduledHoursMetricIndex !== -1 && dayData?.scheduled_hours !== undefined) {
					updatedMetrics[scheduledHoursMetricIndex].values[i] = dayData.scheduled_hours || 0;
				}

				// Populate Linnworks orders data
				if (dayData) {
					// Total Sales
					const totalSalesIndex = updatedMetrics.findIndex((m) => m.name === '2.0 Total Sales');
					if (totalSalesIndex !== -1 && dayData.total_sales !== undefined) {
						updatedMetrics[totalSalesIndex].values[i] = dayData.total_sales || 0;
					}

					// Channel-specific sales
					const amazonSalesIndex = updatedMetrics.findIndex((m) => m.name === '2.0.1 Amazon Sales');
					if (amazonSalesIndex !== -1 && dayData.amazon_sales !== undefined) {
						updatedMetrics[amazonSalesIndex].values[i] = dayData.amazon_sales || 0;
					}

					const ebaySalesIndex = updatedMetrics.findIndex((m) => m.name === '2.0.2 eBay Sales');
					if (ebaySalesIndex !== -1 && dayData.ebay_sales !== undefined) {
						updatedMetrics[ebaySalesIndex].values[i] = dayData.ebay_sales || 0;
					}

					const shopifySalesIndex = updatedMetrics.findIndex(
						(m) => m.name === '2.0.3 Shopify Sales'
					);
					if (shopifySalesIndex !== -1 && dayData.shopify_sales !== undefined) {
						updatedMetrics[shopifySalesIndex].values[i] = dayData.shopify_sales || 0;
					}

					// Linnworks Total Orders
					const linnworksTotalIndex = updatedMetrics.findIndex(
						(m) => m.name === '2.1 Linnworks Total Orders'
					);
					if (linnworksTotalIndex !== -1 && dayData.linnworks_completed_orders !== undefined) {
						updatedMetrics[linnworksTotalIndex].values[i] = dayData.linnworks_completed_orders || 0;
					}

					// Channel-specific orders
					const amazonOrdersIndex = updatedMetrics.findIndex(
						(m) => m.name === '2.1.1 Amazon Orders'
					);
					if (amazonOrdersIndex !== -1 && dayData.linnworks_amazon_orders !== undefined) {
						updatedMetrics[amazonOrdersIndex].values[i] = dayData.linnworks_amazon_orders || 0;
					}

					const ebayOrdersIndex = updatedMetrics.findIndex((m) => m.name === '2.1.2 eBay Orders');
					if (ebayOrdersIndex !== -1 && dayData.linnworks_ebay_orders !== undefined) {
						updatedMetrics[ebayOrdersIndex].values[i] = dayData.linnworks_ebay_orders || 0;
					}

					const shopifyOrdersIndex = updatedMetrics.findIndex(
						(m) => m.name === '2.1.3 Shopify Orders'
					);
					if (shopifyOrdersIndex !== -1 && dayData.linnworks_shopify_orders !== undefined) {
						updatedMetrics[shopifyOrdersIndex].values[i] = dayData.linnworks_shopify_orders || 0;
					}
				}

				// Populate employee hours data (overrides database values for this metric)
				const totalHoursMetricIndex = updatedMetrics.findIndex(
					(m) => m.name === '1.3 Total Hours Used'
				);
				if (totalHoursMetricIndex !== -1 && employeeHoursData[dateStr] !== undefined) {
					updatedMetrics[totalHoursMetricIndex].values[i] = employeeHoursData[dateStr] || 0;
				}

				// Populate role breakdown hours
				const roleBreakdown = employeeRoleBreakdowns[dateStr];
				if (roleBreakdown) {
					const managementHoursIndex = updatedMetrics.findIndex(
						(m) => m.name === '1.3.1 Management Hours Used'
					);
					if (managementHoursIndex !== -1) {
						updatedMetrics[managementHoursIndex].values[i] = roleBreakdown.management || 0;
					}

					const packingHoursIndex = updatedMetrics.findIndex(
						(m) => m.name === '1.3.2 Packing Hours Used'
					);
					if (packingHoursIndex !== -1) {
						updatedMetrics[packingHoursIndex].values[i] = roleBreakdown.packing || 0;
					}

					const pickingHoursIndex = updatedMetrics.findIndex(
						(m) => m.name === '1.3.3 Picking Hours Used'
					);
					if (pickingHoursIndex !== -1) {
						updatedMetrics[pickingHoursIndex].values[i] = roleBreakdown.picking || 0;
					}
				}

				// Populate shipments packed with Linnworks Total Orders data (auto-sync)
				const shipmentsPackedIndex = updatedMetrics.findIndex(
					(m) => m.name === '1.1 Shipments Packed'
				);
				const linnworksOrdersIndex = updatedMetrics.findIndex(
					(m) => m.name === '2.1 Linnworks Total Orders'
				);
				if (shipmentsPackedIndex !== -1 && linnworksOrdersIndex !== -1) {
					updatedMetrics[shipmentsPackedIndex].values[i] =
						updatedMetrics[linnworksOrdersIndex].values[i] || 0;
				}
			}

			// Use updated metrics
			metrics = updatedMetrics;

			// Also reload previous week data for comparison
			await loadPreviousWeekTotals();

			loading = false;
		} catch (err) {
			console.error('Error in loadMetrics:', err);
			loading = false;
		}
	}

	async function changeWeek(offset: number) {
		weekOffset += offset;
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 100));
		await loadMetrics();
		await loadPreviousWeekTotals(); // Ensure previous week data is reloaded.
	}

	// Helper function to fetch fresh current week data for upload (not for display)
	async function fetchFreshCurrentWeekData(): Promise<ExtendedMetric[]> {
		console.log('🚀 Starting fetchFreshCurrentWeekData for upload...');

		// Get current week dates (not displayed week which could be previous week)
		const currentMonday = getMonday(new Date());
		const mondayStr = currentMonday.toISOString().split('T')[0];
		const sundayStr = new Date(currentMonday.getTime() + 6 * 24 * 60 * 60 * 1000)
			.toISOString()
			.split('T')[0];

		const currentWeekStart = new Date(mondayStr);
		const currentWeekEnd = new Date(sundayStr);
		const weekRange = `${mondayStr} to ${sundayStr}`;

		// Generate current week dates array for upload
		const currentWeekDates = Array.from({ length: 7 }, (_, i) => {
			const date = new Date(currentMonday);
			date.setDate(currentMonday.getDate() + i);
			return date;
		});

		console.log(`📅 UPLOAD TARGET WEEK (CURRENT WEEK): ${weekRange}`);
		console.log(
			`🎯 Current week validation bounds: ${currentWeekStart.toISOString()} to ${currentWeekEnd.toISOString()}`
		);

		// Get scheduled hours from hours service
		const scheduledHoursData = await getScheduledHoursForDateRange(
			currentWeekStart,
			currentWeekEnd
		);

		// Validate scheduled hours data
		validateCurrentWeekData(
			scheduledHoursData,
			currentWeekStart,
			currentWeekEnd,
			'Scheduled Hours API'
		);
		logDataSources(scheduledHoursData, 'Scheduled Hours Service', weekRange);

		// Get fresh Linnworks and financial data for current week
		console.log(`🔄 Fetching Linnworks and Financial data for: ${weekRange}`);
		const [linnworksResponse, financialResponse] = await Promise.all([
			fetch(`/api/linnworks/weeklyOrderCounts?startDate=${mondayStr}&endDate=${sundayStr}`),
			fetch(`/api/linnworks/financialData?startDate=${mondayStr}&endDate=${sundayStr}`)
		]);

		const [linnworksData, financialJson] = await Promise.all([
			linnworksResponse.json(),
			financialResponse.json()
		]);

		const linnworksOrdersData = linnworksData.dailyOrders || [];
		const financialData = financialJson.dailyData || [];

		// Validate API data for current week
		validateCurrentWeekData(
			linnworksOrdersData,
			currentWeekStart,
			currentWeekEnd,
			'Linnworks Orders API'
		);
		validateCurrentWeekData(financialData, currentWeekStart, currentWeekEnd, 'Financial Data API');

		logDataSources(linnworksOrdersData, 'Linnworks Orders API', weekRange);
		logDataSources(financialData, 'Financial Data API', weekRange);

		// Create a fresh, clean metrics array for current week only (no previous week contamination)
		let freshMetrics = JSON.parse(JSON.stringify(metrics));

		// Reset all values to 0 to prevent previous week contamination
		freshMetrics.forEach((metric: any) => {
			if (metric.values && Array.isArray(metric.values)) {
				metric.values = new Array(7).fill(0);
			}
		});

		console.log('🧹 Created clean fresh metrics array with all zeros for current week');

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
		for (let i = 0; i < currentWeekDates.length; i++) {
			const dateStr = currentWeekDates[i].toISOString().split('T')[0];
			const dayData = dataByDay[dateStr];

			// Populate scheduled hours from hours service
			if (dayData?.scheduled_hours !== undefined) {
				const scheduledHoursIndex = freshMetrics.findIndex(
					(m: any) => m.name === '1.2 Scheduled Hours'
				);
				if (scheduledHoursIndex !== -1) {
					const newValues = [...freshMetrics[scheduledHoursIndex].values];
					newValues[i] = dayData.scheduled_hours || 0;
					freshMetrics[scheduledHoursIndex] = {
						...freshMetrics[scheduledHoursIndex],
						values: newValues
					};
				}
			}

			// Populate Linnworks and financial data
			if (dayData) {
				// Total Sales
				const totalSalesIndex = freshMetrics.findIndex((m: any) => m.name === '2.0 Total Sales');
				if (totalSalesIndex !== -1 && dayData.total_sales !== undefined) {
					const newValues = [...freshMetrics[totalSalesIndex].values];
					newValues[i] = dayData.total_sales || 0;
					freshMetrics[totalSalesIndex] = { ...freshMetrics[totalSalesIndex], values: newValues };
				}

				// Channel-specific sales
				const amazonSalesIndex = freshMetrics.findIndex(
					(m: any) => m.name === '2.0.1 Amazon Sales'
				);
				if (amazonSalesIndex !== -1 && dayData.amazon_sales !== undefined) {
					const newValues = [...freshMetrics[amazonSalesIndex].values];
					newValues[i] = dayData.amazon_sales || 0;
					freshMetrics[amazonSalesIndex] = { ...freshMetrics[amazonSalesIndex], values: newValues };
				}

				const ebaySalesIndex = freshMetrics.findIndex((m: any) => m.name === '2.0.2 eBay Sales');
				if (ebaySalesIndex !== -1 && dayData.ebay_sales !== undefined) {
					const newValues = [...freshMetrics[ebaySalesIndex].values];
					newValues[i] = dayData.ebay_sales || 0;
					freshMetrics[ebaySalesIndex] = { ...freshMetrics[ebaySalesIndex], values: newValues };
				}

				const shopifySalesIndex = freshMetrics.findIndex(
					(m: any) => m.name === '2.0.3 Shopify Sales'
				);
				if (shopifySalesIndex !== -1 && dayData.shopify_sales !== undefined) {
					const newValues = [...freshMetrics[shopifySalesIndex].values];
					newValues[i] = dayData.shopify_sales || 0;
					freshMetrics[shopifySalesIndex] = {
						...freshMetrics[shopifySalesIndex],
						values: newValues
					};
				}

				// Linnworks Total Orders
				const linnworksTotalIndex = freshMetrics.findIndex(
					(m: any) => m.name === '2.1 Linnworks Total Orders'
				);
				if (linnworksTotalIndex !== -1 && dayData.linnworks_completed_orders !== undefined) {
					const newValues = [...freshMetrics[linnworksTotalIndex].values];
					newValues[i] = dayData.linnworks_completed_orders || 0;
					freshMetrics[linnworksTotalIndex] = {
						...freshMetrics[linnworksTotalIndex],
						values: newValues
					};
				}

				// Channel-specific orders
				const amazonOrdersIndex = freshMetrics.findIndex(
					(m: any) => m.name === '2.1.1 Amazon Orders'
				);
				if (amazonOrdersIndex !== -1 && dayData.linnworks_amazon_orders !== undefined) {
					const newValues = [...freshMetrics[amazonOrdersIndex].values];
					newValues[i] = dayData.linnworks_amazon_orders || 0;
					freshMetrics[amazonOrdersIndex] = {
						...freshMetrics[amazonOrdersIndex],
						values: newValues
					};
				}

				const ebayOrdersIndex = freshMetrics.findIndex((m: any) => m.name === '2.1.2 eBay Orders');
				if (ebayOrdersIndex !== -1 && dayData.linnworks_ebay_orders !== undefined) {
					const newValues = [...freshMetrics[ebayOrdersIndex].values];
					newValues[i] = dayData.linnworks_ebay_orders || 0;
					freshMetrics[ebayOrdersIndex] = { ...freshMetrics[ebayOrdersIndex], values: newValues };
				}

				const shopifyOrdersIndex = freshMetrics.findIndex(
					(m: any) => m.name === '2.1.3 Shopify Orders'
				);
				if (shopifyOrdersIndex !== -1 && dayData.linnworks_shopify_orders !== undefined) {
					const newValues = [...freshMetrics[shopifyOrdersIndex].values];
					newValues[i] = dayData.linnworks_shopify_orders || 0;
					freshMetrics[shopifyOrdersIndex] = {
						...freshMetrics[shopifyOrdersIndex],
						values: newValues
					};
				}
			}
		}

		// ⚠️ CRITICAL: Fetch fresh employee hours data for current week upload
		console.log(`👥 Fetching Employee Hours data for upload: ${weekRange}`);
		let employeeHoursData: Record<string, number> = {};
		let employeeRoleBreakdowns: Record<
			string,
			{
				management: number;
				packing: number;
				picking: number;
			}
		> = {};

		try {
			const hoursResult = await loadEmployeeHoursForDateRange(currentWeekStart, currentWeekEnd);
			employeeHoursData = hoursResult.totalHours;
			employeeRoleBreakdowns = hoursResult.roleBreakdowns;

			// Validate employee hours data dates
			Object.keys(employeeHoursData).forEach((dateStr) => {
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
			for (let i = 0; i < currentWeekDates.length; i++) {
				const dateStr = currentWeekDates[i].toISOString().split('T')[0];

				// Total Hours Used
				const totalHoursIndex = freshMetrics.findIndex(
					(m: any) => m.name === '1.3 Total Hours Used'
				);
				if (totalHoursIndex !== -1 && employeeHoursData[dateStr] !== undefined) {
					const newValues = [...freshMetrics[totalHoursIndex].values];
					newValues[i] = employeeHoursData[dateStr] || 0;
					freshMetrics[totalHoursIndex] = { ...freshMetrics[totalHoursIndex], values: newValues };
					console.log(`📊 Upload: Set Total Hours for ${dateStr}: ${employeeHoursData[dateStr]}`);
				}

				// Role breakdown hours
				const roleBreakdown = employeeRoleBreakdowns[dateStr];
				if (roleBreakdown) {
					// Management Hours
					const managementIndex = freshMetrics.findIndex(
						(m: any) => m.name === '1.3.1 Management Hours Used'
					);
					if (managementIndex !== -1) {
						const newValues = [...freshMetrics[managementIndex].values];
						newValues[i] = roleBreakdown.management || 0;
						freshMetrics[managementIndex] = { ...freshMetrics[managementIndex], values: newValues };
						console.log(
							`📊 Upload: Set Management Hours for ${dateStr}: ${roleBreakdown.management}`
						);
					}

					// Packing Hours
					const packingIndex = freshMetrics.findIndex(
						(m: any) => m.name === '1.3.2 Packing Hours Used'
					);
					if (packingIndex !== -1) {
						const newValues = [...freshMetrics[packingIndex].values];
						newValues[i] = roleBreakdown.packing || 0;
						freshMetrics[packingIndex] = { ...freshMetrics[packingIndex], values: newValues };
						console.log(`📊 Upload: Set Packing Hours for ${dateStr}: ${roleBreakdown.packing}`);
					}

					// Picking Hours
					const pickingIndex = freshMetrics.findIndex(
						(m: any) => m.name === '1.3.3 Picking Hours Used'
					);
					if (pickingIndex !== -1) {
						const newValues = [...freshMetrics[pickingIndex].values];
						newValues[i] = roleBreakdown.picking || 0;
						freshMetrics[pickingIndex] = { ...freshMetrics[pickingIndex], values: newValues };
						console.log(`📊 Upload: Set Picking Hours for ${dateStr}: ${roleBreakdown.picking}`);
					}
				}
			}
		} catch (err) {
			console.error('❌ Failed to fetch or validate employee hours data for upload:', err);
			throw new Error(`Employee hours data validation failed: ${err}`);
		}

		// Final validation of fresh metrics before return
		validateMetricDataForUpload(freshMetrics, currentWeekStart, currentWeekEnd);

		console.log('✅ Fresh current week data validated and ready for upload:', freshMetrics);
		return freshMetrics;
	}

	// Helper function to compute current week metrics from fresh data
	function computeCurrentWeekMetrics(
		freshMetrics: ExtendedMetric[],
		currentWeekDates: Date[]
	): number[][] {
		console.log('Computing current week metrics from fresh data...');

		return freshMetrics.map((metric: ExtendedMetric, idx): number[] => {
			if (!metric.values) return [];

			if (metric.name === '1.4 Labor Efficiency (shipments/hour)') {
				const shipments =
					freshMetrics.find((m) => m.name === '2.1 Linnworks Total Orders')?.values ??
					new Array(daysCount).fill(0);
				const packingHours =
					freshMetrics.find((m) => m.name === '1.3.2 Packing Hours Used')?.values ??
					new Array(daysCount).fill(0);
				const pickingHours =
					freshMetrics.find((m) => m.name === '1.3.3 Picking Hours Used')?.values ??
					new Array(daysCount).fill(0);
				return currentWeekDates.map((_, i) => {
					const totalPackingPickingHours = (packingHours[i] || 0) + (pickingHours[i] || 0);
					return totalPackingPickingHours > 0
						? Math.round((shipments[i] / totalPackingPickingHours) * 100) / 100
						: 0;
				});
			} else if (metric.name === '1.5 Labor Utilization (%)') {
				const actualHours =
					freshMetrics.find((m) => m.name === '1.3 Total Hours Used')?.values ??
					new Array(daysCount).fill(0);
				const scheduledHrs =
					freshMetrics.find((m) => m.name === '1.2 Scheduled Hours')?.values ??
					new Array(daysCount).fill(0);
				return currentWeekDates.map((_, i) =>
					scheduledHrs[i] > 0 ? Math.round((actualHours[i] / scheduledHrs[i]) * 10000) / 100 : 0
				);
			} else if (metric.name === '1.7 Packing Errors DPMO') {
				const shipments =
					freshMetrics.find((m) => m.name === '2.1 Linnworks Total Orders')?.values ??
					new Array(daysCount).fill(0);
				const defects =
					freshMetrics.find((m) => m.name === '1.6 Packing Errors')?.values ??
					new Array(daysCount).fill(0);
				return currentWeekDates.map((_, i) =>
					shipments[i] > 0 ? Math.round((defects[i] / shipments[i]) * 1000000) : 0
				);
			} else if (metric.name === '1.8 Order Accuracy (%)') {
				const shipments =
					freshMetrics.find((m) => m.name === '2.1 Linnworks Total Orders')?.values ??
					new Array(daysCount).fill(0);
				const defects =
					freshMetrics.find((m) => m.name === '1.6 Packing Errors')?.values ??
					new Array(daysCount).fill(0);
				return currentWeekDates.map((_, i) =>
					shipments[i] > 0
						? Math.round(((shipments[i] - defects[i]) / shipments[i]) * 10000) / 100
						: 0
				);
			} else if (metric.name === '2.2.1 Amazon Orders %') {
				const totalOrders =
					freshMetrics.find((m) => m.name === '2.1 Linnworks Total Orders')?.values ??
					new Array(daysCount).fill(0);
				const amazonOrders =
					freshMetrics.find((m) => m.name === '2.1.1 Amazon Orders')?.values ??
					new Array(daysCount).fill(0);
				return currentWeekDates.map((_, i) =>
					totalOrders[i] > 0 ? Math.round((amazonOrders[i] / totalOrders[i]) * 10000) / 100 : 0
				);
			} else if (metric.name === '2.2.2 eBay Orders %') {
				const totalOrders =
					freshMetrics.find((m) => m.name === '2.1 Linnworks Total Orders')?.values ??
					new Array(daysCount).fill(0);
				const ebayOrders =
					freshMetrics.find((m) => m.name === '2.1.2 eBay Orders')?.values ??
					new Array(daysCount).fill(0);
				return currentWeekDates.map((_, i) =>
					totalOrders[i] > 0 ? Math.round((ebayOrders[i] / totalOrders[i]) * 10000) / 100 : 0
				);
			} else if (metric.name === '2.2.3 Shopify Orders %') {
				const totalOrders =
					freshMetrics.find((m) => m.name === '2.1 Linnworks Total Orders')?.values ??
					new Array(daysCount).fill(0);
				const shopifyOrders =
					freshMetrics.find((m) => m.name === '2.1.3 Shopify Orders')?.values ??
					new Array(daysCount).fill(0);
				return currentWeekDates.map((_, i) =>
					totalOrders[i] > 0 ? Math.round((shopifyOrders[i] / totalOrders[i]) * 10000) / 100 : 0
				);
			}
			return metric.values;
		});
	}

	// Function to upload current week's data to daily_metric_review table
	async function uploadMetricReview() {
		try {
			loading = true;
			console.log('Starting daily metric review upload - fetching fresh current week data...');

			// Step 1: Re-fetch fresh current week data (not the displayed data which is for WoW)
			const currentWeekMetrics = await fetchFreshCurrentWeekData();

			// Generate current week dates for upload (not the displayed week dates)
			const currentMonday = getMonday(new Date());
			const currentWeekDates = Array.from({ length: 7 }, (_, i) => {
				const date = new Date(currentMonday);
				date.setDate(currentMonday.getDate() + i);
				return date;
			});

			// Step 2: Compute current week metrics from fresh data
			const currentWeekComputedMetrics = computeCurrentWeekMetrics(
				currentWeekMetrics,
				currentWeekDates
			);

			// Step 3: Transform current week data for upload
			const reviewData = transformMetricsForReview(
				currentWeekMetrics,
				currentWeekDates,
				currentWeekComputedMetrics
			);

			console.log('Transformed fresh current week data for upload:', reviewData);

			// Debug: Show each day's data before filtering
			console.log('🔍 RAW DATA BEFORE FILTERING:');
			reviewData.forEach((dayData, index) => {
				console.log(`Day ${index + 1} (${dayData.date}):`, {
					shipments: dayData.shipments_packed,
					hours: dayData.actual_hours_worked,
					sales: dayData.total_sales,
					orders: dayData.linnworks_total_orders
				});
			});

			// Filter out future dates - STRICT: only upload today and past days
			const today = new Date();
			today.setHours(23, 59, 59, 999); // End of today for comparison

			console.log(`🕐 Today's date for filtering: ${today.toISOString().split('T')[0]}`);

			const filteredReviewData = reviewData.filter((dayData) => {
				const dataDate = new Date(dayData.date);
				const isTodayOrPast = dataDate <= today;
				const hasActualData =
					dayData.shipments_packed > 0 ||
					dayData.actual_hours_worked > 0 ||
					dayData.total_sales > 0;

				console.log(
					`📅 Date ${dayData.date}: isTodayOrPast=${isTodayOrPast}, hasActualData=${hasActualData}, including=${isTodayOrPast}`
				);

				// STRICT: Only include dates that are today or in the past
				// This prevents uploading future dates even if they have contaminated data
				return isTodayOrPast;
			});

			console.log(
				`🔍 Filtered upload data: ${filteredReviewData.length} records (was ${reviewData.length})`
			);
			console.log('Final filtered data for upload:', filteredReviewData);

			// Step 4: Upload to Supabase
			const success = await uploadDailyMetricReview(filteredReviewData);

			if (success) {
				const uploadedDates = filteredReviewData.map((d) => d.date).join(', ');
				showToast(
					`Successfully uploaded daily metric review for ${filteredReviewData.length} days: ${uploadedDates}`,
					'success',
					4000
				);
			}

			// Step 5: Continue normal display flow (reload previous week data for WoW calculations)
			console.log('Upload completed, reloading display data...');
			await loadPreviousWeekTotals();
		} catch (err) {
			console.error('Error uploading metric review:', err);
			showToast('Failed to upload daily metric review', 'error');
		} finally {
			loading = false;
		}
	}

	// Helper function for formatting dates
	function getFormattedDate(date: Date): string {
		return date.toISOString().split('T')[0];
	}

	// Phase 1: Date validation guards for upload integrity
	function validateCurrentWeekData(
		data: any[],
		expectedWeekStart: Date,
		expectedWeekEnd: Date,
		dataSource: string
	): void {
		const weekStartStr = getFormattedDate(expectedWeekStart);
		const weekEndStr = getFormattedDate(expectedWeekEnd);

		console.log(
			`🔍 Validating ${dataSource} data for current week range: ${weekStartStr} to ${weekEndStr}`
		);

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

	function validateMetricDataForUpload(
		metrics: ExtendedMetric[],
		weekStartDate: Date,
		weekEndDate: Date
	): void {
		console.log(
			`🔍 Validating metrics data for upload - Current week: ${getFormattedDate(weekStartDate)} to ${getFormattedDate(weekEndDate)}`
		);

		metrics.forEach((metric, metricIndex) => {
			if (!metric.values || metric.values.length === 0) return;

			// Check if metric has any non-zero values outside current week
			metric.values.forEach((value, dayIndex) => {
				if (value !== 0 && dayIndex < weekDates.length) {
					const dayDate = weekDates[dayIndex];
					const isInRange = dayDate >= weekStartDate && dayDate <= weekEndDate;

					if (!isInRange) {
						const error = `❌ METRIC CONTAMINATION: ${metric.name} has value ${value} for ${getFormattedDate(dayDate)} which is outside current week`;
						console.error(error);
						throw new Error(error);
					}
				}
			});
		});

		console.log(`✅ All metrics data validated for current week upload`);
	}

	function logDataSources(data: any, source: string, weekRange: string): void {
		console.log(`📊 DATA SOURCE AUDIT: ${source}`);
		console.log(`📅 Week Range: ${weekRange}`);
		console.log(`📈 Sample Data:`, data);
		console.log(`🔢 Data Count:`, Array.isArray(data) ? data.length : 'Single object');
	}

	onMount(() => {
		loadMetrics();
		loadPreviousWeekTotals();
	});

	$: previousWeekMetrics = metrics.map((metric: ExtendedMetric, idx): number[] => {
		if (metric.metricField === null) {
			// For Labor Efficiency, we need to keep track of both shipments and hours for accurate averaging
			if (metric.name === '1.4 Labor Efficiency (shipments/hour)') {
				const shipments =
					previousWeekMetrics[metrics.findIndex((m) => m.name === '2.1 Linnworks Total Orders')] ??
					new Array(daysCount).fill(0);
				const packingHours =
					previousWeekMetrics[metrics.findIndex((m) => m.name === '1.3.2 Packing Hours Used')] ??
					new Array(daysCount).fill(0);
				const pickingHours =
					previousWeekMetrics[metrics.findIndex((m) => m.name === '1.3.3 Picking Hours Used')] ??
					new Array(daysCount).fill(0);

				// For daily efficiency values
				const dailyEfficiency = previousWeekDates.map((_, i) => {
					const totalPackingPickingHours = (packingHours[i] || 0) + (pickingHours[i] || 0);
					return totalPackingPickingHours > 0
						? Math.round((shipments[i] / totalPackingPickingHours) * 100) / 100
						: 0;
				});

				return dailyEfficiency;
			}
			// For computed channel percentage metrics
			else if (metric.name === '2.2.1 Amazon Orders %') {
				const totalOrders =
					previousWeekMetrics[metrics.findIndex((m) => m.name === '2.1 Linnworks Total Orders')] ??
					new Array(daysCount).fill(0);
				const amazonOrders =
					previousWeekMetrics[metrics.findIndex((m) => m.name === '2.1.1 Amazon Orders')] ??
					new Array(daysCount).fill(0);
				return previousWeekDates.map((_, i) =>
					totalOrders[i] > 0 ? Math.round((amazonOrders[i] / totalOrders[i]) * 10000) / 100 : 0
				);
			} else if (metric.name === '2.2.2 eBay Orders %') {
				const totalOrders =
					previousWeekMetrics[metrics.findIndex((m) => m.name === '2.1 Linnworks Total Orders')] ??
					new Array(daysCount).fill(0);
				const ebayOrders =
					previousWeekMetrics[metrics.findIndex((m) => m.name === '2.1.2 eBay Orders')] ??
					new Array(daysCount).fill(0);
				return previousWeekDates.map((_, i) =>
					totalOrders[i] > 0 ? Math.round((ebayOrders[i] / totalOrders[i]) * 10000) / 100 : 0
				);
			} else if (metric.name === '2.2.3 Shopify Orders %') {
				const totalOrders =
					previousWeekMetrics[metrics.findIndex((m) => m.name === '2.1 Linnworks Total Orders')] ??
					new Array(daysCount).fill(0);
				const shopifyOrders =
					previousWeekMetrics[metrics.findIndex((m) => m.name === '2.1.3 Shopify Orders')] ??
					new Array(daysCount).fill(0);
				return previousWeekDates.map((_, i) =>
					totalOrders[i] > 0 ? Math.round((shopifyOrders[i] / totalOrders[i]) * 10000) / 100 : 0
				);
			}
			return metric.values;
		}
		return metric.values;
	});

	/**
	 * Get total hours worked for each day in a date range from employee hours table
	 * Returns both total hours and role-based breakdowns
	 */
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

			const { data, error } = await supabase
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

	// ...existing code...
</script>

<!-- Week Navigation (aligned left) with Export button (aligned right) -->
<div class="dashboard-header">
	<div class="week-navigation">
		<button on:click={() => changeWeek(-1)}>Previous Week</button>
		<span class="week-range">
			{#if weekDates.length === daysCount}
				{weekDates[0].toLocaleDateString()} - {weekDates[daysCount - 1].toLocaleDateString()}
			{/if}
		</span>
		<button on:click={() => changeWeek(1)}>Next Week</button>
	</div>

	<div class="export-container">
		<button
			class="upload-review-btn"
			on:click={uploadMetricReview}
			disabled={loading}
			title="Upload current week's metrics to daily_metric_review table"
		>
			{#if loading}
				Uploading...
			{:else}
				📊 Upload Review
			{/if}
		</button>

		<ExportCsv
			metrics={exportMetrics}
			{weekDates}
			{currentTotals}
			previousTotals={previousTotalsComputed}
			weekNumber={getWeekNumber(displayedMonday)}
			fileName="metrics_dashboard"
			{computedMetrics}
		/>
	</div>
</div>

<!-- Add loading indicator to your template -->
{#if isLoading}
	<div class="loading-overlay">
		<div class="loading-spinner"></div>
		<p>Loading data...</p>
	</div>
{/if}

{#if loadError}
	<div class="error-message">
		Error loading data: {loadError}
	</div>
{/if}

<!-- Card Container for Dashboard Table -->
<div class="card">
	<div class="dashboard-container">
		{#if isLoading}
			<div class="skeleton-container">
				<!-- Header skeleton -->
				<div class="skeleton-header">
					<div class="skeleton-nav">
						<div class="skeleton-button"></div>
						<div class="skeleton-text w-40"></div>
						<div class="skeleton-button"></div>
					</div>
					<div class="skeleton-export"></div>
				</div>

				<!-- Table skeleton -->
				<div class="table-skeleton">
					<div class="skeleton-row header">
						<div class="skeleton-cell w-48"></div>
						{#each Array(7) as _, i}
							<div class="skeleton-cell"></div>
						{/each}
						<div class="skeleton-cell"></div>
						<div class="skeleton-cell"></div>
					</div>

					{#each Array(8) as _, i}
						<div class="skeleton-row">
							<div class="skeleton-cell w-48"></div>
							{#each Array(7) as _, j}
								<div class="skeleton-cell"></div>
							{/each}
							<div class="skeleton-cell"></div>
							<div class="skeleton-cell"></div>
						</div>
					{/each}
				</div>
			</div>
		{:else}
			<table>
				<thead>
					<tr class="table-header">
						<th class="metric-name-header">Week {getWeekNumber(displayedMonday)}</th>
						{#each weekDates as date, i}
							<th
								class:current-day={isCurrentWeek && i === currentDayIndex}
								class:highlight-column={isCurrentWeek && i === currentDayIndex}
							>
								{date.toLocaleDateString(undefined, { weekday: 'long' })}
							</th>
						{/each}
						<th class="multiline-header">Current<br />Week Total</th>
						<th class="multiline-header">By This Time<br />Last Week</th>
						<th>WoW % Change</th>
						<th class="multiline-header">Previous<br />Week Total</th>
					</tr>
					<tr class="table-header sub-header">
						<th></th>
						{#each weekDates as date, i}
							<th class:highlight-column={isCurrentWeek && i === currentDayIndex}>
								{date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
							</th>
						{/each}
						<th></th>
						<th></th>
						<th></th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each metrics as metric, metricIndex}
						{#if metric.isHeader}
							<tr class="section-header">
								<td colspan="12">{metric.name}</td>
							</tr>
						{:else if metric.isSpacer}
							<tr class="spacer-row">
								<td colspan="12"></td>
							</tr>
						{:else}
							<svelte:component
								this={MetricRow}
								name={metric.name}
								values={metric.metricField === null ? computedMetrics[metricIndex] : metric.values}
								{metricIndex}
								{currentDayIndex}
								{isCurrentWeek}
								wowChange={computeWoWChange(
									currentTotals[metricIndex],
									isCurrentWeek
										? partialPreviousTotalsComputed[metricIndex]
										: previousTotalsComputed[metricIndex],
									metric.name === '1.3 Total Hours Used' ||
										metric.name === '1.3.1 Management Hours Used' ||
										metric.name === '1.3.2 Packing Hours Used' ||
										metric.name === '1.3.3 Picking Hours Used' ||
										metric.name === '1.6 Packing Errors' ||
										metric.name === '1.7 Packing Errors DPMO'
								)}
								currentTotal={currentTotals[metricIndex]}
								byThisTimeLastWeek={isCurrentWeek
									? partialPreviousTotalsComputed[metricIndex]
									: previousTotalsComputed[metricIndex]}
								previousTotal={previousTotalsComputed[metricIndex]}
								isReadOnly={metric.isReadOnly}
								isSubItem={metric.isSubItem}
								isCurrency={isCurrencyMetric(metric.name)}
								isPercentage={isPercentageMetric(metric.name)}
								tooltip={metric.tooltip}
							/>
						{/if}
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</div>

<style>
	.dashboard-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 24px;
		margin-bottom: 0;
	}

	.export-container {
		display: flex;
		align-items: center;
	}

	.week-navigation {
		display: flex;
		justify-content: flex-start;
		align-items: center;
		gap: 16px;
		margin-bottom: 0; /* Remove bottom margin since it's in the dashboard header now */
		padding: 0; /* Remove padding since it's in the dashboard header now */
	}

	.week-navigation button {
		background: transparent;
		border: none;
		color: #004225;
		font-weight: 500; /* Apple uses medium weight instead of bold */
		cursor: pointer;
		font-size: 0.95em;
		transition: all 0.2s ease;
		padding: 6px 12px;
		border-radius: 6px;
	}

	.week-navigation button:hover {
		color: #35b07b;
		background-color: rgba(53, 176, 123, 0.1); /* Subtle background on hover */
	}

	.week-range {
		font-size: 0.95em;
		font-weight: 500;
		color: #1f2937; /* Darker text for better contrast */
	}

	.card {
		background-color: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 12px; /* Apple uses more rounded corners */
		box-shadow:
			0 1px 2px rgba(0, 0, 0, 0.04),
			0 2px 8px rgba(0, 0, 0, 0.06); /* More subtle shadow */
		margin: 8px 24px; /* Further reduced top margin */
		overflow: hidden;
		padding: 0; /* Add padding to prevent content from touching edges */
	}

	/* Table styling */
	table {
		table-layout: auto; /* Change from fixed to auto to allow more natural sizing */
		width: 100%;
		border-spacing: 0;
		font-size: 0.9em; /* Slightly smaller text */
	}

	/* Adjust the width of day columns */
	table th,
	table td {
		min-width: 100px;
		padding: 8px 12px;
		text-align: center; /* Change from right to center alignment */
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Keep the metric name column left-aligned */
	.metric-name-header,
	table th:first-child,
	table td:first-child {
		width: 200px;
		min-width: 180px;
		max-width: 220px;
		text-align: left; /* Keep this left-aligned */
	}

	/* Make the total/summary columns properly sized */
	table th:nth-child(9),
	table td:nth-child(9),
	table th:nth-child(10),
	table td:nth-child(10),
	table th:nth-child(11),
	table td:nth-child(11),
	table th:nth-child(12),
	table td:nth-child(12) {
		min-width: 100px;
		width: 100px; /* Set a fixed width for the total columns */
	}

	/* Make the dashboard container horizontally scrollable on smaller screens */
	.dashboard-container {
		overflow-x: auto;
		width: 100%;
		/* Add smooth scrolling */
		scroll-behavior: smooth;
	}

	/* Ensure day names don't wrap and have adequate space */
	.table-header th {
		white-space: nowrap;
		font-weight: 500; /* Medium weight for the main header */
		height: 40px; /* Set a fixed height for the header row */
		vertical-align: middle; /* Center text vertically */
	}

	.table-header {
		background: #f9fafb; /* Lighter, flatter header background */
		border-bottom: 1px solid #e5e7eb;
	}

	.table-header th {
		font-weight: 500; /* Medium weight for the main header */
		padding-top: 12px;
		padding-bottom: 8px;
		color: #1f2937; /* Darker text for better contrast */
	}

	.sub-header {
		background-color: #f9fafb;
		font-size: 0.75em;
		color: #6b7280; /* Slightly darker for better readability */
		border-bottom: 2px solid #e5e7eb; /* Slightly thicker bottom border */
		font-weight: 400; /* Lighter weight for the subheader */
		padding-top: 4px; /* Less padding on top since it follows the main day name */
		padding-bottom: 8px;
	}

	.section-header td {
		font-weight: 500; /* Medium weight instead of bold */
		background-color: #f0f9f6; /* Even lighter green */
		text-align: left;
		padding: 10px 16px;
		border-top: 1px solid #e5e7eb;
		border-bottom: 1px solid #e5e7eb;
		color: #004225; /* Darker green text for better contrast */
	}

	/* Add subtle hover effect to table rows */
	tbody tr:not(.section-header):not(.spacer-row):hover {
		background-color: #f5f7fa;
	}

	/* For the current day highlight */
	.current-day {
		background-color: rgba(53, 176, 123, 0.08); /* Subtle green background */
		position: relative;
		font-weight: 500;
	}

	/* Add this new CSS to highlight the entire column */
	th:nth-child(n + 2):nth-child(-n + 8).highlight-column {
		width: 2px;
		background-color: #35b07b; /* Solid green line */
	}

	th.highlight-column::before {
		left: 0;
	}

	th.highlight-column::after {
		right: 0;
	}

	.loading-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background-color: rgba(255, 255, 255, 0.8);
		z-index: 100;
	}

	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 4px solid #f3f3f3;
		border-top: 4px solid #3498db;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 16px;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.error-message {
		background-color: #fee2e2;
		color: #b91c1c;
		padding: 12px 16px;
		border-radius: 6px;
		margin-bottom: 16px;
		font-size: 0.9em;
	}

	/* Add this to your existing styles section */
	.multiline-header {
		white-space: normal !important; /* Allow text to wrap */
		height: auto !important; /* Allow height to adjust based on content */
		line-height: 1.2; /* Tighter line spacing for wrapped text */
		padding-top: 8px;
		padding-bottom: 8px;
	}

	/* Target the specific columns that need multiline headers */
	table th:nth-child(9),
	table th:nth-child(10),
	table th:nth-child(12) {
		width: 110px; /* Set a narrower fixed width to force wrapping */
		min-width: 110px;
	}

	@media (max-width: 768px) {
		.dashboard-container {
			overflow-x: auto;
		}

		table th,
		table td {
			width: 60px;
			padding: 6px 8px;
		}

		.metric-name-header,
		table th:first-child,
		table td:first-child {
			width: 140px;
			min-width: 140px;
		}
	}

	.skeleton-container {
		background: white;
		border-radius: 8px;
		padding: 20px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.skeleton-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}

	.skeleton-nav {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.skeleton-button {
		width: 120px;
		height: 36px;
		background: #f0f0f0;
		border-radius: 6px;
		animation: pulse 1.5s ease-in-out infinite;
	}

	.skeleton-text {
		height: 24px;
		background: #f0f0f0;
		border-radius: 4px;
		animation: pulse 1.5s ease-in-out infinite;
	}

	.skeleton-export {
		width: 150px;
		height: 36px;
		background: #f0f0f0;
		border-radius: 6px;
		animation: pulse 1.5s ease-in-out infinite;
	}

	.table-skeleton {
		width: 100%;
		border-spacing: 0;
		border-collapse: collapse;
	}

	.skeleton-row {
		display: flex;
		border-bottom: 1px solid #f0f0f0;
	}

	.skeleton-row.header {
		background: #fafafa;
	}

	.skeleton-cell {
		flex: 1;
		height: 40px;
		padding: 8px;
		display: flex;
		align-items: center;
	}

	.skeleton-cell::before {
		content: '';
		width: 80%;
		height: 16px;
		background: #f0f0f0;
		border-radius: 4px;
		animation: pulse 1.5s ease-in-out infinite;
	}

	.w-48 {
		width: 200px;
		min-width: 180px;
		max-width: 220px;
	}

	.w-40 {
		width: 160px;
	}

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

	/* Upload review button styling */
	.upload-review-btn {
		background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 8px;
		font-weight: 500;
		font-size: 0.9em;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 6px;
		margin-right: 12px;
		box-shadow: 0 2px 4px rgba(99, 102, 241, 0.2);
	}

	.upload-review-btn:hover:not(:disabled) {
		background: linear-gradient(135deg, #5856eb 0%, #7c3aed 100%);
		transform: translateY(-1px);
		box-shadow: 0 4px 8px rgba(99, 102, 241, 0.3);
	}

	.upload-review-btn:disabled {
		background: #d1d5db;
		cursor: not-allowed;
		transform: none;
		box-shadow: none;
	}

	.upload-review-btn:active:not(:disabled) {
		transform: translateY(0);
		box-shadow: 0 2px 4px rgba(99, 102, 241, 0.2);
	}
</style>
