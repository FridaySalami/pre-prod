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
	import { testDirectInsert } from '$lib/notesService';
	import { showToast } from '$lib/toastStore';
	import { getScheduledHoursForDateRange } from '$lib/schedule/hours-service';

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
	// Define the NoteData interface to resolve type errors.
	interface NoteData {
		id: string;
		content: string;
		createdAt: string;
		updatedAt?: string;
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
		return metricName === '2.0 Total Sales'; // This will be formatted with £ symbol
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
			metricField: 'shipments', // CHANGED from "shipments_packed" to match database column name
			isReadOnly: false,
			tooltip: 'Daily count of shipments packed and shipped.'
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
			name: '1.3 Actual Hours Worked',
			values: new Array(daysCount).fill(0),
			metricField: 'hours_worked', // CHANGED from "actual_hours_worked" to match database column name
			isReadOnly: false,
			tooltip: 'Actual labor hours used for packing operations.'
		},
		{
			name: '1.4 Labor Efficiency (shipments/hour)',
			values: new Array(daysCount).fill(0),
			metricField: null,
			tooltip:
				'Calculated as Shipments Packed ÷ Actual Hours Worked. Measures the number of shipments processed per labor hour.'
		},
		{
			name: '1.5 Labor Utilization (%)',
			values: new Array(daysCount).fill(0),
			metricField: null,
			tooltip:
				'Calculated as (Actual Hours Worked ÷ Scheduled Hours) × 100. Measures how efficiently scheduled labor hours are being used.'
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
			name: '2.1.4 Other Orders',
			values: new Array(daysCount).fill(0),
			metricField: 'linnworks_other_orders',
			isReadOnly: true,
			isSubItem: true,
			tooltip: 'Number of orders from other channels each day.'
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
		},
		{
			name: '2.2.4 Other Orders %',
			values: new Array(daysCount).fill(0),
			metricField: null,
			isReadOnly: true,
			tooltip: 'Percentage of orders coming from other channels.'
		}
	];

	// Combine sections.
	let metrics: ExtendedMetric[] = [...b2cMetrics, spacer, ...b2bMetrics];

	// Week navigation and date calculations.
	let weekOffset: number = 0;
	const msPerDay = 24 * 60 * 60 * 1000;
	let loading = false;

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
				metrics.find((m) => m.name === '1.1 Shipments Packed')?.values ??
				new Array(daysCount).fill(0);
			const hours =
				metrics.find((m) => m.name === '1.3 Actual Hours Worked')?.values ??
				new Array(daysCount).fill(0);
			return weekDates.map((_, i) =>
				hours[i] > 0 ? Math.round((shipments[i] / hours[i]) * 100) / 100 : 0
			);
		} else if (metric.name === '1.5 Labor Utilization (%)') {
			const actualHours =
				metrics.find((m) => m.name === '1.3 Actual Hours Worked')?.values ??
				new Array(daysCount).fill(0);
			const scheduledHrs =
				metrics.find((m) => m.name === '1.2 Scheduled Hours')?.values ??
				new Array(daysCount).fill(0);
			return weekDates.map((_, i) =>
				scheduledHrs[i] > 0 ? Math.round((actualHours[i] / scheduledHrs[i]) * 10000) / 100 : 0
			);
		} else if (metric.name === '1.7 Packing Errors DPMO') {
			const shipments =
				metrics.find((m) => m.name === '1.1 Shipments Packed')?.values ??
				new Array(daysCount).fill(0);
			const defects =
				metrics.find((m) => m.name === '1.6 Packing Errors')?.values ??
				new Array(daysCount).fill(0);
			return weekDates.map((_, i) =>
				shipments[i] > 0 ? Math.round((defects[i] / shipments[i]) * 1000000) : 0
			);
		} else if (metric.name === '1.8 Order Accuracy (%)') {
			const shipments =
				metrics.find((m) => m.name === '1.1 Shipments Packed')?.values ??
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
		} else if (metric.name === '2.2.4 Other Orders %') {
			const totalOrders =
				metrics.find((m) => m.name === '2.1 Linnworks Total Orders')?.values ??
				new Array(daysCount).fill(0);
			const otherOrders =
				metrics.find((m) => m.name === '2.1.4 Other Orders')?.values ??
				new Array(daysCount).fill(0);
			return weekDates.map((_, i) =>
				totalOrders[i] > 0 ? Math.round((otherOrders[i] / totalOrders[i]) * 10000) / 100 : 0
			);
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
				metric.name === '2.2.3 Shopify Orders %' ||
				metric.name === '2.2.4 Other Orders %'
			) {
				// For error metrics and channel percentages, compute average
				return computeMetricAverage(currentSlice, weekDates.slice(0, end + 1), {
					ignoreZeros: false,
					excludeSundays: true
				});
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

			// Get other metrics from daily_metrics
			const { data: prevWeekMetricsData } = await supabase
				.from('daily_metrics')
				.select('*')
				.gte('date', startDateStr)
				.lte('date', endDateStr)
				.order('date');

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

			// Create a lookup map
			const dataByDay: Record<string, any> = {};
			prevWeekMetricsData?.forEach((record) => {
				dataByDay[record.date] = { ...record };

				// Replace scheduled_hours with data from hours service if available
				const hoursRecord = scheduledHoursData.find((h) => h.date === record.date);
				if (hoursRecord) {
					dataByDay[record.date].scheduled_hours = hoursRecord.hours;
				}
			});

			// Add any dates that exist in hours service but not in metrics
			scheduledHoursData.forEach((hoursRecord) => {
				if (!dataByDay[hoursRecord.date]) {
					dataByDay[hoursRecord.date] = {
						date: hoursRecord.date,
						scheduled_hours: hoursRecord.hours
					};
				}
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
				}
			});

			// Process data for each day
			for (let i = 0; i < previousWeekDates.length; i++) {
				const dateStr = previousWeekDates[i].toISOString().split('T')[0];
				const data = dataByDay[dateStr];

				metrics.forEach((metric, idx) => {
					// For data rows (those with a non-null metricField), update the previous week values
					if (metric.metricField !== null && data) {
						let fieldName = metric.metricField;
						if (fieldName === 'shipments_packed') fieldName = 'shipments';

						const val = data[fieldName] ?? 0;
						previousWeekMetrics[idx][i] = val;
						totals[idx] += val;
					}
				});
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
					previousWeekMetrics[metrics.findIndex((m) => m.name === '1.1 Shipments Packed')]?.reduce(
						(acc, val) => acc + val,
						0
					) ?? 0;
				const totHours =
					previousWeekMetrics[
						metrics.findIndex((m) => m.name === '1.3 Actual Hours Worked')
					]?.reduce((acc, val) => acc + val, 0) ?? 0;
				return totHours > 0 ? Math.round((totShipments / totHours) * 100) / 100 : 0;
			}
			if (metric.name === '1.5 Labor Utilization (%)') {
				const totActualHours =
					previousWeekMetrics[
						metrics.findIndex((m) => m.name === '1.3 Actual Hours Worked')
					]?.reduce((acc, val) => acc + val, 0) ?? 0;
				const totScheduledHours =
					previousWeekMetrics[metrics.findIndex((m) => m.name === '1.2 Scheduled Hours')]?.reduce(
						(acc, val) => acc + val,
						0
					) ?? 0;
				return totScheduledHours > 0
					? Math.round((totActualHours / totScheduledHours) * 10000) / 100
					: 0;
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
				const shipmentIdx = metrics.findIndex((m) => m.name === '1.1 Shipments Packed');
				const hoursIdx = metrics.findIndex((m) => m.name === '1.3 Actual Hours Worked');

				const shipments = previousWeekMetrics[shipmentIdx]?.slice(0, end + 1) ?? [];
				const hours = previousWeekMetrics[hoursIdx]?.slice(0, end + 1) ?? [];

				const totalShipments = shipments.reduce((acc, val) => acc + val, 0);
				const totalHours = hours.reduce((acc, val) => acc + val, 0);

				return totalHours > 0 ? Math.round((totalShipments / totalHours) * 100) / 100 : 0;
			}
			if (metric.name === '1.5 Labor Utilization (%)') {
				const actualHoursIdx = metrics.findIndex((m) => m.name === '1.3 Actual Hours Worked');
				const scheduledHoursIdx = metrics.findIndex((m) => m.name === '1.2 Scheduled Hours');

				const actualHours = previousWeekMetrics[actualHoursIdx]?.slice(0, end + 1) ?? [];
				const scheduledHours = previousWeekMetrics[scheduledHoursIdx]?.slice(0, end + 1) ?? [];

				const totalActualHours = actualHours.reduce((acc, val) => acc + val, 0);
				const totalScheduledHours = scheduledHours.reduce((acc, val) => acc + val, 0);

				return totalScheduledHours > 0
					? Math.round((totalActualHours / totalScheduledHours) * 10000) / 100
					: 0;
			}
			// For other metrics that need special averaging
			if (
				metric.name === '2.2.1 Amazon Orders %' ||
				metric.name === '2.2.2 eBay Orders %' ||
				metric.name === '2.2.3 Shopify Orders %' ||
				metric.name === '2.2.4 Other Orders %'
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

			// Fetch current week data
			const { data: currentWeekData, error } = await supabase
				.from('daily_metrics')
				.select('*')
				.gte('date', mondayStr)
				.lte('date', sundayStr)
				.order('date');

			if (error) {
				console.error('Error fetching metrics:', error);
				throw error;
			}

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

			// Create a lookup map for database records
			const dataByDay: Record<string, any> = {};
			currentWeekData?.forEach((record) => {
				dataByDay[record.date] = { ...record };

				// Replace scheduled_hours with data from hours service if available
				const hoursRecord = scheduledHoursData.find((h) => h.date === record.date);
				if (hoursRecord) {
					dataByDay[record.date].scheduled_hours = hoursRecord.hours;
				}
			});

			// Add any dates that exist in hours service but not in metrics
			scheduledHoursData.forEach((hoursRecord) => {
				if (!dataByDay[hoursRecord.date]) {
					dataByDay[hoursRecord.date] = {
						date: hoursRecord.date,
						scheduled_hours: hoursRecord.hours
					};
				}
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
				};
			}

			financialData?.forEach((dayData: FinancialDayData) => {
				const date = dayData.date; // Using the ISO date string directly
				if (dataByDay[date]) {
					dataByDay[date].total_sales = dayData.salesData.totalSales;
				} else {
					console.log('Missing data for date:', date, 'in dataByDay');
				}
			});

			console.log('Financial data mapping:', {
				financialData,
				dataByDay
			});

			// Reset metrics to default values
			let updatedMetrics = JSON.parse(JSON.stringify(metrics));

			// Populate with data from database and APIs
			for (let i = 0; i < weekDates.length; i++) {
				const dateStr = weekDates[i].toISOString().split('T')[0];
				const dayData = dataByDay[dateStr];

				if (dayData) {
					// Update each metric with database values
					updatedMetrics = updatedMetrics.map((metric: any) => {
						if (!metric.metricField) return metric;

						// Map metricField to actual database column names
						let dbField = metric.metricField;
						if (metric.metricField === 'shipments_packed') {
							dbField = 'shipments'; // Correct field name from schema
						}
						if (dayData[dbField] !== undefined) {
							const newValues = [...metric.values];
							if (dbField === 'total_sales') {
								newValues[i] = dayData.total_sales || 0;
							} else {
								newValues[i] = dayData[dbField] || 0;
							}
							return { ...metric, values: newValues };
						}
						return metric;
					});
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

	async function saveMetricsForDate(dateStr: string, metricsData: any) {
		try {
			console.log('Saving metrics for date:', dateStr, 'Data:', metricsData);

			const { data, error } = await supabase
				.from('daily_metrics')
				.upsert(
					{
						date: dateStr,
						...metricsData
					},
					{
						onConflict: 'date'
					}
				)
				.select(); // Chain select() to get the returned data

			if (error) {
				console.error('Error saving metrics:', error);
			}

			console.log('Metrics saved successfully');
			return data;
		} catch (err) {
			console.error('Error in saveMetricsForDay:', err);
			throw err;
		}
	}

	async function saveMetricsForDay(dayIndex: number) {
		try {
			const dateStr = weekDates[dayIndex].toISOString().split('T')[0];

			// Create a data object with exact database column names
			const data: Record<string, any> = {
				date: dateStr // Always include the date
			};

			// List of valid DB columns that exist in the daily_metrics table
			const validColumns = [
				'shipments',
				'hours_worked',
				'defects',
				'scheduled_hours',
				'dpmo',
				'order_accuracy'
			];

			// Map metrics to database columns correctly based on your schema
			metrics.forEach((metric: ExtendedMetric) => {
				// Skip read-only fields, headers, spacers, and non-database fields
				if (metric.isReadOnly || metric.isHeader || metric.isSpacer || !metric.metricField) return;

				// Only save if there's a valid value AND the column exists in the database
				if (metric.values[dayIndex] === null || metric.values[dayIndex] === undefined) {
					return;
				}

				// Important: Check if this is a valid column before trying to save it
				if (validColumns.includes(metric.metricField)) {
					data[metric.metricField] = Number(metric.values[dayIndex]);
				} else {
					console.log(`Skipping save for non-existent column: ${metric.metricField}`);
				}
			});

			console.log('Saving day data:', dateStr, data);

			// Check if record exists first
			const { data: existingRecord, error: fetchError } = await supabase
				.from('daily_metrics')
				.select('id')
				.eq('date', dateStr)
				.maybeSingle();

			if (fetchError) {
				console.error('Error checking for existing record:', fetchError);
				showToast(
					`Failed to check if record exists for ${dateStr}: ${fetchError.message}`,
					'error'
				);
				throw fetchError;
			}

			let result;
			if (existingRecord?.id) {
				// Update existing record
				result = await supabase.from('daily_metrics').update(data).eq('id', existingRecord.id);

				if (result.error) {
					console.error('Error updating metrics:', result.error);
					showToast(`Failed to update data for ${dateStr}: ${result.error.message}`, 'error');
					throw result.error;
				}
			} else {
				// Insert new record
				result = await supabase.from('daily_metrics').insert(data);

				if (result.error) {
					console.error('Error inserting metrics:', result.error);
					showToast(`Failed to save data for ${dateStr}: ${result.error.message}`, 'error');
					throw result.error;
				}
			}

			// Ensure the toast is visible with a longer duration
			showToast(
				`Metrics for ${new Date(dateStr).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} updated`,
				'success',
				3000
			);
			return result;
		} catch (err) {
			console.error('Failed to save day:', dayIndex, err);
			// Make sure error is displayed in the toast
			showToast(
				`Failed to save data: ${err instanceof Error ? err.message : 'Unknown error'}`,
				'error',
				5000
			);
			throw err;
		}
	}

	async function saveAllMetrics() {
		try {
			loading = true;
			console.log('Starting saveAllMetrics...');

			for (let i = 0; i < weekDates.length; i++) {
				await saveMetricsForDay(i);
			}

			await tick();
			await loadMetrics();
			await loadPreviousWeekTotals();

			console.log('saveAllMetrics completed successfully');
			showToast('All metrics saved successfully', 'success');
			loading = false;
		} catch (err) {
			console.error('Failed to save all metrics:', err);
			showToast('Failed to save all metrics', 'error');
			loading = false;
		}
	}

	function handleInputChange(metricIndex: number, dayIndex: number, newValue?: number) {
		if (newValue === undefined) return;

		console.log('Input changed:', {
			metricIndex,
			dayIndex,
			date: weekDates[dayIndex].toISOString().split('T')[0],
			metricName: metrics[metricIndex].name,
			newValue
		});

		// Get metric and check if it's read-only or Linnworks data
		const metric = metrics[metricIndex];
		if (metric.isReadOnly) {
			showToast(`"${metric.name}" is read-only. It's automatically updated.`, 'info');
			return;
		}

		if (metric.metricField === 'linnworks_completed_orders') {
			showToast(
				`"${metric.name}" is retrieved from the Linnworks API and cannot be edited.`,
				'info'
			);
			return;
		}

		// Update the metric value in the array
		const newValues = [...metric.values];
		newValues[dayIndex] = newValue;

		// Create a new metrics array with the updated values
		metrics = metrics.map((m, i) => {
			if (i === metricIndex) {
				return { ...m, values: newValues };
			}
			return m;
		});

		// Save the updated metric for this specific day
		saveMetricsForDay(dayIndex)
			.then(() => {
				// Quietly show success message
				showToast(
					`Updated ${metric.name} for ${weekDates[dayIndex].toLocaleDateString(undefined, { weekday: 'long' })}`,
					'success',
					2000
				);
			})
			.catch((err) => {
				console.error('Failed to save after input change:', err);
				showToast(`Failed to save ${metric.name}`, 'error');
			});
	}

	async function changeWeek(offset: number) {
		weekOffset += offset;
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 100));
		await loadMetrics();
		await loadPreviousWeekTotals(); // Ensure previous week data is reloaded.
	}

	// Function to test the database connection and table
	async function runTest() {
		console.log('Running direct insert test...');
		const result = await testDirectInsert();
		console.log('Test direct insert result:', result);
	}

	// Fix incomplete function definitions.
	async function openNotePanel(metricIndex: number, dayIndex: number) {
		console.log('Opening note panel for metric index:', metricIndex, 'day index:', dayIndex);
		// Add implementation or leave as a placeholder.
	}

	function closeMetricsPanel() {
		console.log('Closing metrics panel');
		// Add implementation or leave as a placeholder.
	}

	async function handleUpdateNote(event: CustomEvent<{ updatedNote: NoteData }>) {
		console.log('Handling note update:', event.detail.updatedNote);
		// Add implementation or leave as a placeholder.
	}

	function flagClicked(metricIndex: number, dayIndex: number) {
		console.log('Flag clicked for metric index:', metricIndex, 'day index:', dayIndex);
		// Add implementation or leave as a placeholder.
	}

	// Helper function for formatting dates
	function getFormattedDate(date: Date): string {
		return date.toISOString().split('T')[0];
	}

	onMount(() => {
		loadMetrics();
		loadPreviousWeekTotals();
		// Run test to check if direct inserts work
		runTest();
	});

	let showMetricsPanel = false;
	let selectedMetricIndex = -1;
	let selectedDayIndex = -1;
	let panelNoteData: any = {};
	let notesMap: Record<string, any> = {};
	let activeNote: NoteData | null = null;
	let activeNoteId: string | null = null;
	let activeMetricId: string | null = null;
	let activeDayId: string | null = null;

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

	// Add this to your existing variables
	let isLoading = true;
	let loadError: string | null = null;

	// Fix the query in loadMetricsData function
	async function loadMetricsData() {
		isLoading = true;
		loadError = null;

		try {
			console.log('Loading metrics data from Supabase...');

			// Get the selected week's dates for querying
			const start = weekDates[0];
			const end = weekDates[weekDates.length - 1];

			console.log(`Fetching data for week: ${start.toISOString()} to ${end.toISOString()}`);

			// CHANGE THIS: Use 'daily_metrics' instead of 'metrics'
			const { data, error } = await supabase
				.from('daily_metrics') // Changed from 'metrics' to 'daily_metrics'
				.select('*')
				.gte('date', start.toISOString().split('T')[0])
				.lte('date', end.toISOString().split('T')[0])
				.order('date', { ascending: true });

			if (error) {
				console.error('Supabase query error:', error);
				loadError = error.message;
				return;
			}

			console.log(`Loaded ${data?.length || 0} records from Supabase`);
			console.log('Sample data:', data?.slice(0, 2));

			// Map the data to metrics
			if (data && data.length > 0) {
				// Group by date
				const metricsByDate = data.reduce((acc, item) => {
					const dateStr = item.date;
					if (!acc[dateStr]) acc[dateStr] = [];
					acc[dateStr].push(item);
					return acc;
				}, {});

				// Now update the metrics with the data
				metrics = metrics.map((metric, idx) => {
					// Skip headers and spacers
					if (metric.isHeader || metric.isSpacer) return metric;

					// Only update metrics that have a corresponding field in the database
					if (!metric.metricField) return metric;

					const newValues = [...metric.values];

					// For each day in our week
					weekDates.forEach((date, dayIndex) => {
						const dateStr = date.toISOString().split('T')[0];
						const dayData = metricsByDate[dateStr];

						if (dayData && dayData.length > 0) {
							// Fix the 'd' parameter type
							const matchingRecord = dayData.find((d: Record<string, any>) =>
								d.hasOwnProperty(metric.metricField as string)
							);

							if (matchingRecord && metric.metricField) {
								// Add null check for metricField
								console.log(
									`Found data for ${metric.name} on ${dateStr}:`,
									matchingRecord[metric.metricField]
								);
								newValues[dayIndex] = matchingRecord[metric.metricField] || 0;
							}
						}
					});

					return {
						...metric,
						values: newValues
					};
				});

				console.log('Updated metrics with Supabase data');
				// Check specific metrics we're concerned about
				const shipmentsPacked = metrics.find((m) => m.name === '1.1 Shipments Packed');
				const actualHours = metrics.find((m) => m.name === '1.3 Actual Hours Worked');
				const packingErrors = metrics.find((m) => m.name === '1.6 Packing Errors');

				console.log('1.1 Shipments Packed values:', shipmentsPacked?.values);
				console.log('1.3 Actual Hours Worked values:', actualHours?.values);
				console.log('1.6 Packing Errors values:', packingErrors?.values);
			}
		} catch (err: unknown) {
			// Type the error as unknown
			console.error('Error loading metrics data:', err);
			loadError = err instanceof Error ? err.message : String(err);
		} finally {
			isLoading = false;
		}
	}

	// Call this in onMount to load data when the component initializes
	onMount(() => {
		loadMetricsData();
	});

	// Also add a watcher for weekDates to reload data when the week changes
	$: if (weekDates && weekDates.length > 0) {
		loadMetricsData();
	}

	$: previousWeekMetrics = metrics.map((metric: ExtendedMetric, idx): number[] => {
		if (metric.metricField === null) {
			// For Labor Efficiency, we need to keep track of both shipments and hours for accurate averaging
			if (metric.name === '1.4 Labor Efficiency (shipments/hour)') {
				const shipments =
					previousWeekMetrics[metrics.findIndex((m) => m.name === '1.1 Shipments Packed')] ??
					new Array(daysCount).fill(0);
				const hours =
					previousWeekMetrics[metrics.findIndex((m) => m.name === '1.3 Actual Hours Worked')] ??
					new Array(daysCount).fill(0);

				// For daily efficiency values
				const dailyEfficiency = previousWeekDates.map((_, i) =>
					hours[i] > 0 ? Math.round((shipments[i] / hours[i]) * 100) / 100 : 0
				);

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
			} else if (metric.name === '2.2.4 Other Orders %') {
				const totalOrders =
					previousWeekMetrics[metrics.findIndex((m) => m.name === '2.1 Linnworks Total Orders')] ??
					new Array(daysCount).fill(0);
				const otherOrders =
					previousWeekMetrics[metrics.findIndex((m) => m.name === '2.1.4 Other Orders')] ??
					new Array(daysCount).fill(0);
				return previousWeekDates.map((_, i) =>
					totalOrders[i] > 0 ? Math.round((otherOrders[i] / totalOrders[i]) * 10000) / 100 : 0
				);
			}
			return metric.values;
		}
		return metric.values;
	});
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
									metric.name === '1.3 Actual Hours Worked' ||
										metric.name === '1.6 Packing Errors' ||
										metric.name === '1.7 Packing Errors DPMO'
								)}
								{handleInputChange}
								currentTotal={currentTotals[metricIndex]}
								byThisTimeLastWeek={isCurrentWeek
									? partialPreviousTotalsComputed[metricIndex]
									: previousTotalsComputed[metricIndex]}
								previousTotal={previousTotalsComputed[metricIndex]}
								isReadOnly={metric.isReadOnly}
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

<!-- Chart Footer: Save All Changes button aligned right -->
<div class="chart-footer">
	<button on:click={saveAllMetrics} disabled={loading}>
		{loading ? 'Saving...' : 'Save All Changes'}
	</button>
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

	.chart-footer {
		display: flex;
		justify-content: flex-end; /* Align to the right */
		padding: 12px 24px; /* Match the card's horizontal padding */
		margin: 0 24px; /* Match the card's horizontal margin */
	}

	.chart-footer button {
		background: #004225;
		color: #fff;
		border: none;
		padding: 8px 14px;
		font-size: 0.9em;
		font-weight: 500; /* Medium weight instead of bold */
		cursor: pointer;
		border-radius: 6px; /* More rounded corners */
		transition: all 0.2s ease;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); /* Subtle shadow */
	}

	.chart-footer button:hover {
		background: #006339; /* Slightly darker on hover for depth */
		transform: translateY(-1px); /* Subtle lift effect */
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
	}

	.chart-footer button:active {
		transform: translateY(0); /* Press effect */
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
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
</style>
