<script lang="ts">
  import { onMount, tick, onDestroy } from "svelte";
  import { supabase } from "$lib/supabaseClient";
  import ExportCsv from "$lib/ExportCsv.svelte";
  import { getMonday, formatNumber, getWeekNumber, isToday } from "./utils";
  import MetricRow from "./MetricRow.svelte";
  import { testDirectInsert } from '$lib/notesService';
  import { showToast } from '$lib/toastStore';   
  import { getScheduledHoursForDateRange } from '$lib/hours-service';

  // Add this interface to your type definitions section at the top
  interface LinnworksOrderData {
    date: string;
    count: number;
    formattedDate: string;
  }

  // Updated ExtendedMetric with required properties.
  interface ExtendedMetric {
  name: string;
  values: number[];
  metricField: string | null;
  isHeader?: boolean;
  isSpacer?: boolean;
  isReadOnly?: boolean;
  tooltip?: string;  // Add this property
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

  // B2C Amazon Fulfilment section with tooltips
  let b2cMetrics: ExtendedMetric[] = [
    { name: "B2C Amazon Fulfilment", isHeader: true, values: new Array(daysCount).fill(0), metricField: null },
    { 
      name: "1.1 Shipments Packed", 
      values: new Array(daysCount).fill(0), 
      metricField: "shipments",
      tooltip: "The total number of shipments processed and packed each day."
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
      metricField: "hours_worked",
      tooltip: "The actual number of labor hours used each day."
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
      metricField: "defects",
      tooltip: "The number of errors or defects found in packed shipments."
    },
    { 
      name: "1.7 Packing Errors DPMO", 
      values: new Array(daysCount).fill(0), 
      metricField: null,
      tooltip: "Defects Per Million Opportunities. Calculated as (Packing Errors ÷ Shipments Packed) × 1,000,000. Standardized measure of defect rate."
    },
    { 
      name: "1.8 Order Accuracy (%)", 
      values: new Array(daysCount).fill(0), 
      metricField: null,
      tooltip: "Calculated as ((Shipments Packed - Packing Errors) ÷ Shipments Packed) × 100. Measures the percentage of error-free shipments."
    }
  ];

  // Spacer row.
  let spacer: ExtendedMetric = { name: "", isSpacer: true, values: new Array(daysCount).fill(0), metricField: null };

  // B2B Warehouse and On‑road section with tooltips
  let b2bMetrics: ExtendedMetric[] = [
    { name: "B2C Amazon Financials", isHeader: true, values: new Array(daysCount).fill(0), metricField: null },
    { 
      name: "2.1 Linnworks Completed Orders", 
      values: new Array(daysCount).fill(0), 
      metricField: "linnworks_completed_orders",
      isReadOnly: true, // Mark as read-only since it's from an external API
      tooltip: "Total number of completed orders in Linnworks each day. Automatically synced from Linnworks API."
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

  // Compute computed metrics by metric name.
  let computedMetrics: number[][] = [];
  $: computedMetrics = metrics.map((metric: ExtendedMetric): number[] => {
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
    } else if (metric.name === "1.7 Packing Errors DPMO") { // Updated name
      const shipments = metrics.find(m => m.name === "1.1 Shipments Packed")?.values ?? new Array(daysCount).fill(0);
      const defects = metrics.find(m => m.name === "1.6 Packing Errors")?.values ?? new Array(daysCount).fill(0); // Updated name
      return weekDates.map((_, i) =>
        shipments[i] > 0 ? Math.round((defects[i] / shipments[i]) * 1000000) : 0
      );
    } else if (metric.name === "1.8 Order Accuracy (%)") {
      const shipments = metrics.find(m => m.name === "1.1 Shipments Packed")?.values ?? new Array(daysCount).fill(0);
      const defects = metrics.find(m => m.name === "1.6 Packing Errors")?.values ?? new Array(daysCount).fill(0); // Updated name
      return weekDates.map((_, i) =>
        shipments[i] > 0 ? Math.round(((shipments[i] - defects[i]) / shipments[i]) * 10000) / 100 : 0
      );
    }
    return metric.values;
  });

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
    } else if (metric.name === "1.7 Packing Errors DPMO" || metric.name === "1.8 Order Accuracy (%)") {
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
    
    // List of valid fields in your daily_metrics table
    const validDbFields = [
      "shipments",           // Renamed from shipments_packed 
      "defects",
      "hours_worked",
      "scheduled_hours",
      "dpmo",
      "order_accuracy"
      // Note: B2B metrics not included as they don't exist in the table
    ];
    
    // Map metric fields to correct database column names
    metrics.forEach((metric: ExtendedMetric) => {
      // Skip read-only fields
      if (metric.isReadOnly) return;
      
      if (!metric.metricField || metric.values[dayIndex] === null || metric.values[dayIndex] === undefined) {
        return;
      }
      
      // Map metricField to actual database column names
      let dbField = metric.metricField;
      if (metric.metricField === "shipments_packed") {
        dbField = "shipments"; // Correct field name from schema
      }
      
      // Only include fields that exist in the database
      if (validDbFields.includes(dbField)) {
        // Ensure numeric values
        data[dbField] = Number(metric.values[dayIndex]);
      }
    });
    
    console.log('Saving day data (filtered for valid DB fields):', dateStr, data);
    
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

<!-- Card Container for Dashboard Table -->
<div class="card">
  <div class="dashboard-container">
    <table>
      <thead>
        <tr class="table-header">
          <th class="metric-name-header">Week {getWeekNumber(displayedMonday)}</th>
          {#each weekDates as date, i}
            <th class="small-header" class:current-day={isCurrentWeek && i === currentDayIndex}>
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
            <th class:current-day={isCurrentWeek && i === currentDayIndex}>
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
            <MetricRow
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
              currentTotal={formatNumber(currentTotals[metricIndex])}
              byThisTimeLastWeek={formatNumber(isCurrentWeek ? partialPreviousTotalsComputed[metricIndex] : previousTotalsComputed[metricIndex])}
              previousTotal={formatNumber(previousTotalsComputed[metricIndex])}
              notesMap={notesMap}
              openNotes={openNotePanel}
              isReadOnly={metric.isReadOnly}
              tooltip={metric.tooltip}
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
    border-radius: 10px; /* Apple uses more rounded corners */
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.08); /* More subtle, layered shadow */
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
  }

  .sub-header {
    background-color: #F9FAFB;
    font-size: 0.75em;
    color: #6B7280; /* Slightly darker for better readability */
    border-bottom: 1px solid #E5E7EB;
  }

  .sub-header th {
    font-weight: 400; /* Lighter weight for the subheader */
    padding-top: 4px; /* Less padding on top since it follows the main day name */
  }

  .section-header td {
    font-weight: 500; /* Medium weight instead of bold */
    background-color: #e6f7f0; /* Slightly lighter, more subdued green */
    text-align: left;
    padding: 10px 16px;
    border: 1px solid #E5E7EB;
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
    background-color: #f9fafb;
  }

  /* For the current day highlight */
  .current-day {
    background-color: rgba(53, 176, 123, 0.1);
    font-weight: 500;
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