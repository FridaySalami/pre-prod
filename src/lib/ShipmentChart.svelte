<script lang="ts">
  import { onMount, tick, onDestroy } from "svelte";
  import { supabase } from "$lib/supabaseClient";
  import ExportCsv from "$lib/ExportCsv.svelte";
  import { getMonday, formatNumber, getWeekNumber, isToday, formatPercentage, getWowColor } from "./utils";
  import MetricRow from "./MetricRow.svelte";
  import { testDirectInsert } from '$lib/notesService';
  import { showToast } from '$lib/toastStore';   
  import { getScheduledHoursForDateRange } from '$lib/hours-service';

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
  isSubItem?: boolean;  // Add this line to fix the errors
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
    if (previous === 0) return "N/A";
    // If 'invert' is true, a decrease (current < previous) becomes a positive percentage.
    let change = invert
      ? ((previous - current) / previous) * 100
      : ((current - previous) / previous) * 100;
    return change.toFixed(2) + "%";
  }

  // Add this helper function to determine if a metric is a percentage metric
  function isPercentageMetric(metricName: string): boolean {
    return metricName.includes('%') || 
           metricName === "1.5 Labor Utilization (%)" || 
           metricName === "1.8 Order Accuracy (%)" ||
           metricName.startsWith("2.2.");  // All channel distribution percentage metrics
  }

  // B2C Amazon Fulfilment section with tooltips
  let b2cMetrics: ExtendedMetric[] = [
    { name: "B2C Amazon Fulfilment", isHeader: true, values: new Array(daysCount).fill(0), metricField: null },
    { 
      name: "1.1 Shipments Packed", 
      values: new Array(daysCount).fill(0), 
      metricField: "shipments", // CHANGED from "shipments_packed" to match database column name
      isReadOnly: false,
      tooltip: "Daily count of shipments packed and shipped."
    },
    { 
      name: "1.2 Scheduled Hours", 
      values: new Array(daysCount).fill(0), 
      metricField: "scheduled_hours", 
      isReadOnly: true,
      tooltip: "Total scheduled work hours based on employee availability from the schedule page. This is automatically calculated and can only be modified by updating employee schedules and leave."
    },
    { 
      name: "1.3 Actual Hours Worked", 
      values: new Array(daysCount).fill(0), 
      metricField: "hours_worked", // CHANGED from "actual_hours_worked" to match database column name
      isReadOnly: false,
      tooltip: "Actual labor hours used for packing operations."
    },
    { 
      name: "1.4 Labor Efficiency (shipments/hour)", 
      values: new Array(daysCount).fill(0), 
      metricField: null,
      tooltip: "Calculated as Shipments Packed ÷ Actual Hours Worked. Measures the number of shipments processed per labor hour."
    },
    { 
      name: "1.5 Labor Utilization (%)", 
      values: new Array(daysCount).fill(0), 
      metricField: null,
      tooltip: "Calculated as (Actual Hours Worked ÷ Scheduled Hours) × 100. Measures how efficiently scheduled labor hours are being used."
    },
    { 
      name: "1.6 Packing Errors", 
      values: new Array(daysCount).fill(0), 
      metricField: "defects", // CHANGED from "packing_errors" to match database column name
      isReadOnly: false,
      tooltip: "Count of errors in packed orders (wrong items, damaged items, etc.)."
    },
    { 
      name: "1.7 Packing Errors DPMO", 
      values: new Array(daysCount).fill(0), 
      metricField: "dpmo", // Added database column name
      isReadOnly: true,
      tooltip: "Defects Per Million Opportunities. Calculated as (Packing Errors ÷ Shipments Packed) × 1,000,000. Standardized measure of defect rate."
    },
    { 
      name: "1.8 Order Accuracy (%)", 
      values: new Array(daysCount).fill(0), 
      metricField: "order_accuracy", // Added database column name
      isReadOnly: true,
      tooltip: "Calculated as ((Shipments Packed - Packing Errors) ÷ Shipments Packed) × 100. Measures the percentage of error-free shipments."
    }
  ];

  // Spacer row.
  let spacer: ExtendedMetric = { name: "", isSpacer: true, values: new Array(daysCount).fill(0), metricField: null };

  // B2B Warehouse and On‑road section with tooltips
  let b2bMetrics: ExtendedMetric[] = [
    { name: "B2C Amazon Financials", isHeader: true, values: new Array(daysCount).fill(0), metricField: null },
    { 
      name: "2.1 Linnworks Total Orders", 
      values: new Array(daysCount).fill(0), 
      metricField: "linnworks_completed_orders",
      isReadOnly: true, // Mark as read-only since it's from an external API
      tooltip: "Total number of completed orders in Linnworks each day. Automatically synced from Linnworks API."
    },
    { 
      name: "2.1.1 Amazon Orders", 
      values: new Array(daysCount).fill(0), 
      metricField: "linnworks_amazon_orders",
      isReadOnly: true,
      isSubItem: true,
      tooltip: "Number of completed Amazon orders each day."
    },
    { 
      name: "2.1.2 eBay Orders", 
      values: new Array(daysCount).fill(0), 
      metricField: "linnworks_ebay_orders",
      isReadOnly: true,
      isSubItem: true,
      tooltip: "Number of completed eBay orders each day."
    },
    { 
      name: "2.1.3 Shopify Orders", 
      values: new Array(daysCount).fill(0), 
      metricField: "linnworks_shopify_orders",
      isReadOnly: true,
      isSubItem: true,
      tooltip: "Number of completed Shopify orders each day."
    },
    { 
      name: "2.1.4 Other Orders", 
      values: new Array(daysCount).fill(0), 
      metricField: "linnworks_other_orders",
      isReadOnly: true,
      isSubItem: true,
      tooltip: "Number of orders from other channels each day."
    },
    { 
      name: "2.2 Channel Percentage Distribution", 
      isHeader: true, 
      values: new Array(daysCount).fill(0), 
      metricField: null 
    },
    { 
      name: "2.2.1 Amazon Orders %", 
      values: new Array(daysCount).fill(0), 
      metricField: null,
      isReadOnly: true,
      tooltip: "Percentage of orders coming from Amazon channel."
    },
    { 
      name: "2.2.2 eBay Orders %", 
      values: new Array(daysCount).fill(0), 
      metricField: null,
      isReadOnly: true,
      tooltip: "Percentage of orders coming from eBay channel."
    },
    { 
      name: "2.2.3 Shopify Orders %", 
      values: new Array(daysCount).fill(0), 
      metricField: null,
      isReadOnly: true,
      tooltip: "Percentage of orders coming from Shopify channel."
    },
    { 
      name: "2.2.4 Other Orders %", 
      values: new Array(daysCount).fill(0), 
      metricField: null,
      isReadOnly: true,
      tooltip: "Percentage of orders coming from other channels."
    },
    { 
      name: "2.2 Placeholder", 
      values: new Array(daysCount).fill(0), 
      metricField: "order_picking_rate",
      tooltip: "Number of items picked per hour. Measures warehouse picking efficiency."
    },
    { 
      name: "2.3 Placeholder", 
      values: new Array(daysCount).fill(0), 
      metricField: "delivery_timeliness",
      tooltip: "Percentage of deliveries made within the promised time window. Higher is better."
    },
    { 
      name: "2.4 Placeholder", 
      values: new Array(daysCount).fill(0), 
      metricField: "fuel_efficiency",
      tooltip: "Miles traveled per gallon of fuel consumed by delivery vehicles. Higher is better."
    },
    { 
      name: "2.5 Placeholder", 
      values: new Array(daysCount).fill(0), 
      metricField: "driver_utilization",
      tooltip: "Percentage of driver time spent actively making deliveries vs. total scheduled time."
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

  $: isCurrentWeek = getMonday(new Date()).toISOString() === getMonday(new Date(displayedMonday)).toISOString();

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

  $: currentDayIndex = isCurrentWeek ? Math.max(weekDates.findIndex(date => isToday(date)) - 1, 0) : daysCount - 1;

  // Modify the computedMetrics calculation to include the percentage calculations
  $: computedMetrics = metrics.map((metric: ExtendedMetric, idx): number[] => {
    if (!metric.values) return [];
    
    if (metric.name === "1.4 Labor Efficiency (shipments/hour)") {
      const shipments = metrics.find(m => m.name === "1.1 Shipments Packed")?.values ?? new Array(daysCount).fill(0);
      const hours = metrics.find(m => m.name === "1.3 Actual Hours Worked")?.values ?? new Array(daysCount).fill(0);
      return weekDates.map((_, i) =>
        hours[i] > 0 ? Math.round((shipments[i] / hours[i]) * 100) / 100 : 0
      );
    } else if (metric.name === "1.5 Labor Utilization (%)") {
      const actualHours = metrics.find(m => m.name === "1.3 Actual Hours Worked")?.values ?? new Array(daysCount).fill(0);
      const scheduledHrs = metrics.find(m => m.name === "1.2 Scheduled Hours")?.values ?? new Array(daysCount).fill(0);
      return weekDates.map((_, i) =>
        scheduledHrs[i] > 0 ? Math.round((actualHours[i] / scheduledHrs[i]) * 10000) / 100 : 0
      );
    } else if (metric.name === "1.7 Packing Errors DPMO") { 
      const shipments = metrics.find(m => m.name === "1.1 Shipments Packed")?.values ?? new Array(daysCount).fill(0);
      const defects = metrics.find(m => m.name === "1.6 Packing Errors")?.values ?? new Array(daysCount).fill(0);
      return weekDates.map((_, i) =>
        shipments[i] > 0 ? Math.round((defects[i] / shipments[i]) * 1000000) : 0
      );
    } else if (metric.name === "1.8 Order Accuracy (%)") {
      const shipments = metrics.find(m => m.name === "1.1 Shipments Packed")?.values ?? new Array(daysCount).fill(0);
      const defects = metrics.find(m => m.name === "1.6 Packing Errors")?.values ?? new Array(daysCount).fill(0);
      return weekDates.map((_, i) =>
        shipments[i] > 0 ? Math.round(((shipments[i] - defects[i]) / shipments[i]) * 10000) / 100 : 0
      );
    } 
    // Add new percentage calculations for channel distribution
    else if (metric.name === "2.2.1 Amazon Orders %") {
      const totalOrders = metrics.find(m => m.name === "2.1 Linnworks Total Orders")?.values ?? new Array(daysCount).fill(0);
      const amazonOrders = metrics.find(m => m.name === "2.1.1 Amazon Orders")?.values ?? new Array(daysCount).fill(0);
      return weekDates.map((_, i) =>
        totalOrders[i] > 0 ? Math.round((amazonOrders[i] / totalOrders[i]) * 10000) / 100 : 0
      );
    } 
    else if (metric.name === "2.2.2 eBay Orders %") {
      const totalOrders = metrics.find(m => m.name === "2.1 Linnworks Total Orders")?.values ?? new Array(daysCount).fill(0);
      const ebayOrders = metrics.find(m => m.name === "2.1.2 eBay Orders")?.values ?? new Array(daysCount).fill(0);
      return weekDates.map((_, i) =>
        totalOrders[i] > 0 ? Math.round((ebayOrders[i] / totalOrders[i]) * 10000) / 100 : 0
      );
    }
    else if (metric.name === "2.2.3 Shopify Orders %") {
      const totalOrders = metrics.find(m => m.name === "2.1 Linnworks Total Orders")?.values ?? new Array(daysCount).fill(0);
      const shopifyOrders = metrics.find(m => m.name === "2.1.3 Shopify Orders")?.values ?? new Array(daysCount).fill(0);
      return weekDates.map((_, i) =>
        totalOrders[i] > 0 ? Math.round((shopifyOrders[i] / totalOrders[i]) * 10000) / 100 : 0
      );
    }
    else if (metric.name === "2.2.4 Other Orders %") {
      const totalOrders = metrics.find(m => m.name === "2.1 Linnworks Total Orders")?.values ?? new Array(daysCount).fill(0);
      const otherOrders = metrics.find(m => m.name === "2.1.4 Other Orders")?.values ?? new Array(daysCount).fill(0);
      return weekDates.map((_, i) =>
        totalOrders[i] > 0 ? Math.round((otherOrders[i] / totalOrders[i]) * 10000) / 100 : 0
      );
    }
    return metric.values;
  });

  // Update the week-over-week calculations to handle percentage metrics correctly
  $: weekOverWeekChanges = metrics.map((metric, idx) => {
    // Skip headers and spacers
    if (metric.isHeader || metric.isSpacer) return "N/A";
    
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
    if (prevTotal === 0) return "N/A";
    
    const change = ((currentTotal - prevTotal) / prevTotal) * 100;
    
    // Format the change value
    return `${change > 0 ? "+" : ""}${change.toFixed(2)}%`;
  });

  // Add a function to format metric values with appropriate units
  function formatMetricValue(value: number, metricName: string): string {
    if (isPercentageMetric(metricName)) {
      return formatPercentage(value);
    }
    return formatNumber(value);
  }

  // Compute current totals.
  $: currentTotals = metrics.map((metric: ExtendedMetric, idx) => {
  if (!metric.values) return 0;
  // Choose the source array: for computed metrics use computedMetrics; for others, use metric.values.
  let arr: number[] = metric.metricField === null ? computedMetrics[idx] : metric.values;
  const end = isCurrentWeek ? (currentDayIndex >= 0 ? currentDayIndex : daysCount - 1) : arr.length - 1;
  const currentSlice = arr.slice(0, end + 1);
  
  if (metric.metricField === null) {
    // For computed metrics, compute an average instead of summing.
    if (metric.name === "1.4 Labor Efficiency (shipments/hour)" || 
        metric.name === "1.5 Labor Utilization (%)") {
      // For both Labor Efficiency and Utilization, exclude zeros and Sundays
      return computeMetricAverage(currentSlice, weekDates.slice(0, end + 1), { 
        ignoreZeros: true, 
        excludeSundays: true 
      });
    } else if (metric.name === "1.7 Packing Errors DPMO" || 
               metric.name === "1.8 Order Accuracy (%)" ||
               metric.name === "2.2.1 Amazon Orders %" ||
               metric.name === "2.2.2 eBay Orders %" || 
               metric.name === "2.2.3 Shopify Orders %" ||
               metric.name === "2.2.4 Other Orders %") {
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
    const startDateStr = previousWeekDates[0].toISOString().split("T")[0];
    const endDateStr = previousWeekDates[previousWeekDates.length-1].toISOString().split("T")[0];
    
    // Get scheduled hours from hours service
    const scheduledHoursData = await getScheduledHoursForDateRange(
      new Date(startDateStr), 
      new Date(endDateStr)
    );
    
    // Get other metrics from daily_metrics
    const { data: prevWeekMetricsData } = await supabase
      .from("daily_metrics")
      .select("*")
      .gte("date", startDateStr)
      .lte("date", endDateStr)
      .order("date");
    
    // NEW: Fetch Linnworks completed orders data for previous week
    let linnworksOrdersData: LinnworksOrderData[] = [];
        try {
      console.log('Fetching previous week Linnworks data for date range:', startDateStr, 'to', endDateStr);
      const linnworksResponse = await fetch(`/api/linnworks/weeklyOrderCounts?startDate=${startDateStr}&endDate=${endDateStr}`);
      
      if (!linnworksResponse.ok) {
        throw new Error(`API Error ${linnworksResponse.status}: ${await linnworksResponse.text()}`);
      }
      
      const linnworksData = await linnworksResponse.json();
      linnworksOrdersData = linnworksData.dailyOrders || [];
      console.log('Fetched previous week Linnworks data:', linnworksOrdersData);
    } catch (err) {
      console.error('Failed to fetch previous week Linnworks data:', err);
      // Continue without Linnworks data
    }
    
    // Create a lookup map
    const dataByDay: Record<string, any> = {};
    prevWeekMetricsData?.forEach(record => {
      dataByDay[record.date] = record;
      
      // Replace scheduled_hours with data from hours service if available
      const hoursRecord = scheduledHoursData.find(h => h.date === record.date);
      if (hoursRecord) {
        dataByDay[record.date].scheduled_hours = hoursRecord.hours;
      }
    });
    
    // Add any dates that exist in hours service but not in metrics
    scheduledHoursData.forEach(hoursRecord => {
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
    
    // Process data for each day
    for (let i = 0; i < previousWeekDates.length; i++) {
      const dateStr = previousWeekDates[i].toISOString().split("T")[0];
      const data = dataByDay[dateStr];
      
      metrics.forEach((metric, idx) => {
        // For data rows (those with a non-null metricField), update the previous week values
        if (metric.metricField !== null && data) {
          let fieldName = metric.metricField;
          if (fieldName === "shipments_packed") fieldName = "shipments";
          
          const val = data[fieldName] ?? 0;
          previousWeekMetrics[idx][i] = val;
          totals[idx] += val;
        }
      });
    }
    
    previousTotals = totals;
  } catch (err) {
    console.error("Error loading previous week data:", err);
  }
}
$: previousTotalsComputed = metrics.map((metric, idx) => {
  if (!metric.values) return 0;
  if (metric.metricField === null) {
    // For computed metrics, average over all days of the previous week.
    // Add percentage metrics to the list of metrics that should be averaged
    return computeMetricAverage(previousWeekMetrics[idx], previousWeekDates, {
      ignoreZeros: metric.name === "1.4 Labor Efficiency (shipments/hour)" || 
                  metric.name === "1.5 Labor Utilization (%)",
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
    ? (currentDayIndex >= 0 ? currentDayIndex : daysCount - 1)
    : arr.length - 1;
  const slicedValues = arr.slice(0, end + 1);
  const slicedDates = previousWeekDates.slice(0, end + 1);
  
  // Check if this is a percentage metric that should be averaged
  if (metric.metricField === null) {
    return computeMetricAverage(slicedValues, slicedDates, {
      ignoreZeros: metric.name === "1.4 Labor Efficiency (shipments/hour)" ||
                  metric.name === "1.5 Labor Utilization (%)",
      excludeSundays: true
    });
  } else {
    return slicedValues.reduce((acc, v) => acc + v, 0);
  }
});

async function loadMetrics() {
  try {
    loading = true;
    
    // Format dates for API queries
    const mondayStr = displayedMonday.toISOString().split('T')[0];
    const sundayStr = new Date(displayedMonday.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
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
    
    // NEW: Fetch Linnworks completed orders data
    let linnworksOrdersData: LinnworksOrderData[] = [];
        try {
      console.log('Fetching Linnworks data for date range:', mondayStr, 'to', sundayStr);
      const linnworksResponse = await fetch(`/api/linnworks/weeklyOrderCounts?startDate=${mondayStr}&endDate=${sundayStr}`);
      
      if (!linnworksResponse.ok) {
        throw new Error(`API Error ${linnworksResponse.status}: ${await linnworksResponse.text()}`);
      }
      
      const linnworksData = await linnworksResponse.json();
      linnworksOrdersData = linnworksData.dailyOrders || [];
      console.log('Fetched Linnworks data:', linnworksOrdersData);
    } catch (err) {
      console.error('Failed to fetch Linnworks data:', err);
      // Continue without Linnworks data
    }
    
    // Create a lookup map for database records
    const dataByDay: Record<string, any> = {};
    currentWeekData?.forEach(record => {
      dataByDay[record.date] = {...record};
      
      // Replace scheduled_hours with data from hours service if available
      const hoursRecord = scheduledHoursData.find(h => h.date === record.date);
      if (hoursRecord) {
        dataByDay[record.date].scheduled_hours = hoursRecord.hours;
      }
    });
    
    // Add any dates that exist in hours service but not in metrics
    scheduledHoursData.forEach(hoursRecord => {
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
          if (metric.metricField === "shipments_packed") {
            dbField = "shipments"; // Correct field name from schema
          }
          
          if (dayData[dbField] !== undefined) {
            const newValues = [...metric.values];
            newValues[i] = dayData[dbField] || 0;
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
        .from("daily_metrics")
        .upsert(
          { 
            date: dateStr, 
            ...metricsData 
          }, 
          { 
            onConflict: "date"
          }
        )
        .select();  // Chain select() to get the returned data

      if (error) {
        console.error("Error saving metrics:", error);
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
    const dateStr = weekDates[dayIndex].toISOString().split("T")[0];
    
    // Create a data object with exact database column names
    const data: Record<string, any> = {
      date: dateStr  // Always include the date
    };
    
    // Map metrics to database columns correctly
    metrics.forEach((metric: ExtendedMetric) => {
      // Skip read-only fields and non-database fields
      if (metric.isReadOnly || !metric.metricField) return;
      
      // Only save if there's a valid value
      if (metric.values[dayIndex] === null || metric.values[dayIndex] === undefined) {
        return;
      }
      
      // Direct mapping - no more conversion needed since we've fixed the field names
      data[metric.metricField] = Number(metric.values[dayIndex]);
    });
    
    console.log('Saving day data:', dateStr, data);
    
    // Check if record exists first
    const { data: existingRecord } = await supabase
      .from('daily_metrics')
      .select('id')
      .eq('date', dateStr)
      .maybeSingle();
      
    if (existingRecord?.id) {
      // Update existing record
      const { error } = await supabase
        .from('daily_metrics')
        .update(data)
        .eq('id', existingRecord.id);
        
      if (error) {
        console.error('Error updating metrics:', error);
        showToast(`Failed to update data for ${dateStr}: ${error.message}`, 'error');
        throw error;
      }
    } else {
      // Insert new record
      const { error } = await supabase
        .from('daily_metrics')
        .insert(data);
        
      if (error) {
        console.error('Error inserting metrics:', error);
        showToast(`Failed to save data for ${dateStr}: ${error.message}`, 'error');
        throw error;
      }
    }
    
    showToast(`Metrics for ${new Date(dateStr).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} updated`, 'success', 3000);
  } catch (err) {
    console.error('Failed to save day:', dayIndex, err);
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
  
  if (metric.metricField === "linnworks_completed_orders") {
    showToast(`"${metric.name}" is retrieved from the Linnworks API and cannot be edited.`, 'info');
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
      showToast(`Updated ${metric.name} for ${weekDates[dayIndex].toLocaleDateString(undefined, { weekday: 'long' })}`, 'success', 2000);
    })
    .catch((err) => {
      console.error('Failed to save after input change:', err);
      showToast(`Failed to save ${metric.name}`, 'error');
    });
}

  async function changeWeek(offset: number) {
    weekOffset += offset;
    await tick();
    await new Promise(resolve => setTimeout(resolve, 100));
    await loadMetrics();
    await loadPreviousWeekTotals();  // Ensure previous week data is reloaded.
  }

  // Function to test the database connection and table
  async function runTest() {
    console.log("Running direct insert test...");
    const result = await testDirectInsert();
    console.log("Test direct insert result:", result);
  }

  // Fix incomplete function definitions.
  async function openNotePanel(metricIndex: number, dayIndex: number) {
    console.log("Opening note panel for metric index:", metricIndex, "day index:", dayIndex);
    // Add implementation or leave as a placeholder.
  }

  function closeMetricsPanel() {
    console.log("Closing metrics panel");
    // Add implementation or leave as a placeholder.
  }

  async function handleUpdateNote(event: CustomEvent<{ updatedNote: NoteData }>) {
    console.log("Handling note update:", event.detail.updatedNote);
    // Add implementation or leave as a placeholder.
  }

  function flagClicked(metricIndex: number, dayIndex: number) {
    console.log("Flag clicked for metric index:", metricIndex, "day index:", dayIndex);
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
                d.hasOwnProperty(metric.metricField as string));
              
              if (matchingRecord && metric.metricField) { // Add null check for metricField
                console.log(`Found data for ${metric.name} on ${dateStr}:`, matchingRecord[metric.metricField]);
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
        const shipmentsPacked = metrics.find(m => m.name === "1.1 Shipments Packed");
        const actualHours = metrics.find(m => m.name === "1.3 Actual Hours Worked");
        const packingErrors = metrics.find(m => m.name === "1.6 Packing Errors");
        
        console.log('1.1 Shipments Packed values:', shipmentsPacked?.values);
        console.log('1.3 Actual Hours Worked values:', actualHours?.values);
        console.log('1.6 Packing Errors values:', packingErrors?.values);
      }
    } catch (err: unknown) { // Type the error as unknown
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
      currentTotals={currentTotals}
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
    <table>
      <thead>
        <tr class="table-header">
          <th class="metric-name-header">Week {getWeekNumber(displayedMonday)}</th>
          {#each weekDates as date, i}
            <th class:current-day={isCurrentWeek && i === currentDayIndex} 
                class:highlight-column={isCurrentWeek && i === currentDayIndex}>
              {date.toLocaleDateString(undefined, { weekday: "long" })}
            </th>
          {/each}
          <th>Current Week Total</th>
          <th>By This Time Last Week</th>
          <th>WoW % Change</th>
          <th class="prev-week-col">Previous Week Total</th>
        </tr>
        <tr class="table-header sub-header">
          <th></th>
          {#each weekDates as date, i}
            <th class:highlight-column={isCurrentWeek && i === currentDayIndex}>
              {date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
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
            <svelte:component this={MetricRow} 
              name={metric.name}
              values={metric.metricField === null ? computedMetrics[metricIndex] : metric.values}
              {metricIndex}
              {weekDates}
              {currentDayIndex}
              {isCurrentWeek}
              metricField={metric.metricField}
              wowChange={
                computeWoWChange(
                  currentTotals[metricIndex],
                  isCurrentWeek ? partialPreviousTotalsComputed[metricIndex] : previousTotalsComputed[metricIndex],
                  metric.name === "1.3 Actual Hours Worked" ||
                  metric.name === "1.6 Packing Errors" || 
                  metric.name === "1.7 Packing Errors DPMO"
                )
              }
              handleInputChange={handleInputChange}
              currentTotal={currentTotals[metricIndex]}
              byThisTimeLastWeek={isCurrentWeek ? partialPreviousTotalsComputed[metricIndex] : previousTotalsComputed[metricIndex]}
              previousTotal={previousTotalsComputed[metricIndex]}
              notesMap={notesMap}
              openNotes={openNotePanel}
              isReadOnly={metric.isReadOnly}
              tooltip={metric.tooltip}
              isPercentage={isPercentageMetric(metric.name)}
            />
          {/if}
        {/each}
      </tbody>
    </table>
  </div>
</div>

<!-- Chart Footer: Save All Changes button aligned right -->
<div class="chart-footer">
  <button 
    on:click={saveAllMetrics} 
    disabled={loading}
  >
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
    border: 1px solid #E5E7EB;
    border-radius: 12px; /* Apple uses more rounded corners */
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.06); /* More subtle shadow */
    margin: 8px 24px; /* Further reduced top margin */
    overflow: hidden;
  }

  /* Table styling */
  table {
    table-layout: fixed;
    width: 100%;
    border-spacing: 0;
    font-size: 0.9em; /* Slightly smaller text */
  }

  table th,
  table td {
    width: 65px; /* Reduced from 80px */
    box-sizing: border-box;
    padding: 8px 10px; /* Reduced padding from 10px 12px */
  }

  /* Make the metric name column wider but not too wide */
  .metric-name-header, 
  table th:first-child, 
  table td:first-child {
    width: 160px; /* Reduced from 180px */
    min-width: 160px;
    text-align: left;
  }

  .table-header {
    background: #F9FAFB; /* Lighter, flatter header background */
    border-bottom: 1px solid #E5E7EB;
  }

  .table-header th {
    font-weight: 500; /* Medium weight for the main header */
    padding-top: 12px;
    padding-bottom: 8px;
    color: #1f2937; /* Darker text for better contrast */
  }

  .sub-header {
    background-color: #F9FAFB;
    font-size: 0.75em;
    color: #6B7280; /* Slightly darker for better readability */
    border-bottom: 2px solid #E5E7EB; /* Slightly thicker bottom border */
    font-weight: 400; /* Lighter weight for the subheader */
    padding-top: 4px; /* Less padding on top since it follows the main day name */
    padding-bottom: 8px;
  }

  .section-header td {
    font-weight: 500; /* Medium weight instead of bold */
    background-color: #f0f9f6; /* Even lighter green */
    text-align: left;
    padding: 10px 16px;
    border-top: 1px solid #E5E7EB;
    border-bottom: 1px solid #E5E7EB;
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
  td:nth-child(n+2):nth-child(-n+8).highlight-column, 
  th:nth-child(n+2):nth-child(-n+8).highlight-column {
    background-color: rgba(53, 176, 123, 0.08); /* Subtle green background */
    position: relative;
  }

  /* Add vertical lines only to the cells in the highlighted column */
  th.highlight-column::before,
  th.highlight-column::after,
  td.highlight-column::before,
  td.highlight-column::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background-color: #35b07b; /* Solid green line */
  }

  th.highlight-column::before,
  td.highlight-column::before {
    left: 0;
  }

  th.highlight-column::after,
  td.highlight-column::after {
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
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .error-message {
    background-color: #fee2e2;
    color: #b91c1c;
    padding: 12px 16px;
    border-radius: 6px;
    margin-bottom: 16px;
    font-size: 0.9em;
  }
  
@media (max-width: 768px) {
  .dashboard-container {
    overflow-x: auto;
  }
  
  table th, table td {
    width: 60px;
    padding: 6px 8px;
  }
  
  .metric-name-header, table th:first-child, table td:first-child {
    width: 140px;
    min-width: 140px;
  }
}
</style>