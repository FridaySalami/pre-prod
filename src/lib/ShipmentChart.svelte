<script lang="ts">
	import { onMount, tick } from "svelte";
	import { supabase } from "./supabaseClient";
	import { getMonday, formatNumber, getWeekNumber, isToday } from "./utils";
	import MetricRow from "./MetricRow.svelte";
	import MetricsSidePanel from "$lib/MetricsSidePanel.svelte";
  
	// Updated ExtendedMetric with required properties.
	interface ExtendedMetric {
	  name: string;
	  values: number[];
	  metricField: string | null;
	  isHeader?: boolean;
	  isSpacer?: boolean;
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

	// B2C Amazon Fulfilment section.
	let b2cMetrics: ExtendedMetric[] = [
	  { name: "B2C Amazon Fulfilment", isHeader: true, values: new Array(daysCount).fill(0), metricField: null },
	  { name: "1.1 Shipments Packed", values: new Array(daysCount).fill(0), metricField: "shipments" },
	  { name: "1.2 Hours Worked", values: new Array(daysCount).fill(0), metricField: "hours_worked" },
	  { name: "1.3 Shipments Per Hour", values: new Array(daysCount).fill(0), metricField: null },
	  { name: "1.4 Defects", values: new Array(daysCount).fill(0), metricField: "defects" },
	  { name: "1.5 Defects DPMO", values: new Array(daysCount).fill(0), metricField: null },
	  { name: "1.6 Order Accuracy (%)", values: new Array(daysCount).fill(0), metricField: null }
	];
  
	// Spacer row.
	let spacer: ExtendedMetric = { name: "", isSpacer: true, values: new Array(daysCount).fill(0), metricField: null };
  
	// B2B Warehouse and On‑road section with fictional metrics.
	let b2bMetrics: ExtendedMetric[] = [
	  { name: "B2B Warehouse and On‑road", isHeader: true, values: new Array(daysCount).fill(0), metricField: null },
	  { name: "2.1 Inventory Accuracy (%)", values: new Array(daysCount).fill(0), metricField: "inventory_accuracy" },
	  { name: "2.2 Order Picking Rate", values: new Array(daysCount).fill(0), metricField: "order_picking_rate" },
	  { name: "2.3 Delivery Timeliness (%)", values: new Array(daysCount).fill(0), metricField: "delivery_timeliness" },
	  { name: "2.4 Fuel Efficiency (MPG)", values: new Array(daysCount).fill(0), metricField: "fuel_efficiency" },
	  { name: "2.5 Driver Utilization (%)", values: new Array(daysCount).fill(0), metricField: "driver_utilization" }
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
	$: computedMetrics = metrics.map((metric): number[] => {
	  if (!metric.values) return [];
	  if (metric.name === "1.3 Shipments Per Hour") {
		const shipments = metrics.find(m => m.name === "1.1 Shipments Packed")?.values ?? new Array(daysCount).fill(0);
		const hours = metrics.find(m => m.name === "1.2 Hours Worked")?.values ?? new Array(daysCount).fill(0);
		return weekDates.map((_, i) =>
		  hours[i] > 0 ? Math.round((shipments[i] / hours[i]) * 100) / 100 : 0
		);
	  } else if (metric.name === "1.5 Defects DPMO") {
		const shipments = metrics.find(m => m.name === "1.1 Shipments Packed")?.values ?? new Array(daysCount).fill(0);
		const defects = metrics.find(m => m.name === "1.4 Defects")?.values ?? new Array(daysCount).fill(0);
		return weekDates.map((_, i) =>
		  shipments[i] > 0 ? Math.round((defects[i] / shipments[i]) * 1000000) : 0
		);
	  } else if (metric.name === "1.6 Order Accuracy (%)") {
		const shipments = metrics.find(m => m.name === "1.1 Shipments Packed")?.values ?? new Array(daysCount).fill(0);
		const defects = metrics.find(m => m.name === "1.4 Defects")?.values ?? new Array(daysCount).fill(0);
		return weekDates.map((_, i) =>
		  shipments[i] > 0 ? Math.round(((shipments[i] - defects[i]) / shipments[i]) * 10000) / 100 : 0
		);
	  }
	  return metric.values;
	});
  
	// Compute current totals.
	$: currentTotals = metrics.map((metric, idx) => {
  if (!metric.values) return 0;
  // Choose the source array: for computed metrics use computedMetrics; for others, use metric.values.
  let arr: number[] = metric.metricField === null ? computedMetrics[idx] : metric.values;
  const end = isCurrentWeek ? (currentDayIndex >= 0 ? currentDayIndex : daysCount - 1) : arr.length - 1;
  const currentSlice = arr.slice(0, end + 1);
  if (metric.metricField === null) {
    // For computed metrics, compute an average instead of summing.
    if (metric.name === "1.3 Shipments Per Hour") {
      return computeMetricAverage(currentSlice, weekDates.slice(0, end + 1), { ignoreZeros: true, excludeSundays: true });
    } else if (metric.name === "1.5 Defects DPMO" || metric.name === "1.6 Order Accuracy (%)") {
      return computeMetricAverage(currentSlice, weekDates.slice(0, end + 1), { ignoreZeros: false, excludeSundays: true });
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
	  let totals = metrics.map(() => 0);
	  previousWeekMetrics = metrics.map(() => new Array(daysCount).fill(0));
	  for (let i = 0; i < previousWeekDates.length; i++) {
		const dateStr = previousWeekDates[i].toISOString().split("T")[0];
		const data = await loadMetricsForDate(dateStr);
		metrics.forEach((metric, idx) => {
		  // For data rows (those with a non-null metricField), update the previous week values.
		  if (metric.metricField !== null) {
			const val = data ? (data[metric.metricField] ?? 0) : 0;
			previousWeekMetrics[idx][i] = val;
			totals[idx] += val;
		  }
		});
	  }
	  previousTotals = totals;
	}
  
$: previousTotalsComputed = metrics.map((metric, idx) => {
  if (!metric.values) return 0;
  if (metric.metricField === null) {
    // For computed metrics, average over all days of the previous week.
    // (We assume the previous week metrics array is fully populated.)
    return computeMetricAverage(previousWeekMetrics[idx], previousWeekDates, {
      ignoreZeros: metric.name === "1.3 Shipments Per Hour",
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
		  ignoreZeros: metric.name === "1.3 Shipments Per Hour",
		  excludeSundays: true
		});
	  } else {
		return slicedValues.reduce((acc, v) => acc + v, 0);
	  }
	});
  
	async function loadMetricsForDate(dateStr: string) {
	  const { data, error } = await supabase
		.from("daily_metrics")
		.select("*")
		.eq("date", dateStr)
		.maybeSingle();
	  if (error) {
		console.error("Error fetching metrics for date " + dateStr, error);
		return null;
	  }
	  return data;
	}
  
	async function loadMetrics() {
	  if (typeof window === "undefined") return;
	  loading = true;
  
	  // Reinitialize metrics for the new week to ensure no old data is carried over.
	  metrics = metrics.map(metric => ({
		...metric,
		values: new Array(daysCount).fill(0)
	  }));
  
	  let updatedMetrics = metrics.map(metric => ({
		...metric,
		values: [...metric.values]
	  }));
  
	  // Loop through the weekDates and fetch data for each date.
	  for (let i = 0; i < weekDates.length; i++) {
		const dateStr = weekDates[i].toISOString().split("T")[0];
		const data = await loadMetricsForDate(dateStr);
		updatedMetrics = updatedMetrics.map(metric => {
		  if (metric.metricField !== null) {
			const field: string = metric.metricField;
			return {
			  ...metric,
			  // Update only the current day's value.
			  values: metric.values.map((val, j) =>
				j === i ? ((data as any)[field] ?? 0) : val
			  )
			};
		  }
		  return metric;
		});
	  }
	  metrics = updatedMetrics;
	  loading = false;
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
    const data: Record<string, number> = {};
    
    // Filter out null/undefined values and match column names exactly
    metrics.forEach(metric => {
      if (metric.metricField && metric.values[dayIndex] !== null && metric.values[dayIndex] !== undefined) {
        // Only include fields that match your table columns
        if (['shipments', 'defects', 'hours_worked', 'dpmo', 'order_accuracy'].includes(metric.metricField)) {
          data[metric.metricField] = metric.values[dayIndex];
        }
      }
    });

    // Only save if we have data
    if (Object.keys(data).length > 0) {
      console.log('Saving day data:', dateStr, data);
      const { error } = await supabase
        .from('daily_metrics')
        .upsert({ 
          date: dateStr,  // Make sure to include the date
          ...data 
        }, {
          onConflict: 'date'  // Specify which column handles conflicts
        })
        .select();

      if (error) {
        console.error('Error saving metrics:', error);
        throw error;
      }
    } else {
      console.warn('No data to save for day:', dateStr);
    }
  } catch (err) {
    console.error('Failed to save day:', dayIndex, err);
    throw err;  // Rethrow to handle in the calling function
  }
}

async function saveAllMetrics() {
  try {
    console.log('Starting saveAllMetrics...');
    
    for (let i = 0; i < weekDates.length; i++) {
      await saveMetricsForDay(i);
    }
    
    await tick();
    await loadMetrics();
    await loadPreviousWeekTotals();
    
    console.log('saveAllMetrics completed successfully');
  } catch (err) {
    console.error('Failed to save all metrics:', err);
  }
}

function handleInputChange(metricIndex: number, dayIndex: number, newValue?: number) {
  if (newValue === undefined) return;
  
  console.log('Input changed:', { metricIndex, dayIndex, newValue });
  
  metrics = metrics.map((metric, idx) => {
    if (idx === metricIndex) {
      const newValues = [...metric.values];
      newValues[dayIndex] = newValue;
      return { ...metric, values: newValues };
    }
    return metric;
  });
  
  // Wrap in async function and add error handling
  (async () => {
    try {
      await saveMetricsForDay(dayIndex);
    } catch (err) {
      console.error('Failed to save after input change:', err);
    }
  })();
}
  
	async function changeWeek(offset: number) {
  weekOffset += offset;
  await tick();
  await new Promise(resolve => setTimeout(resolve, 100));
  await loadMetrics();
  await loadPreviousWeekTotals();  // Ensure previous week data is reloaded.
}

	// Side panel state.
	let showMetricsPanel = false;
	let selectedMetricIndex = -1;
	let selectedDayIndex = -1;
	let panelNoteData: any = {};
	let notesMap: Record<string, any> = {};
  
	function openMetricsPanel(metricIndex: number, dayIndex: number) {
	  selectedMetricIndex = metricIndex;
	  selectedDayIndex = dayIndex;
	  const key =
		dayIndex === -1
		  ? `${metricIndex}-total`
		  : `${metricIndex}-${weekDates[dayIndex].toISOString().split("T")[0]}`;
	  if (notesMap[key]) {
		panelNoteData = { ...notesMap[key] };
	  } else {
		panelNoteData = { title: "", rootCause: "", details: "", actionPlan: "", comments: [] };
	  }
	  showMetricsPanel = true;
	}
  
	function closeMetricsPanel() {
	  showMetricsPanel = false;
	}
  
	function computeWeeklyTotal(metric: ExtendedMetric, metricIndex: number): string {
	  let result: number;
	  // For computed metrics (metricField === null), compute an average.
	  if (metric.metricField === null) {
		if (metric.name === "1.3 Shipments Per Hour") {
		  // Average ignoring zeros and excluding Sundays.
		  result = computeMetricAverage(metric.values, weekDates, { ignoreZeros: true, excludeSundays: true });
		} else if (metric.name === "1.5 Defects DPMO" || metric.name === "1.6 Order Accuracy (%)") {
		  // Average including zeros but excluding Sundays.
		  result = computeMetricAverage(metric.values, weekDates, { ignoreZeros: false, excludeSundays: true });
		} else {
		  result = 0;
		}
	  } else {
		// For non-computed metrics, simply sum the values.
		result = metric.values.reduce((acc, v) => acc + v, 0);
	  }
	  return result % 1 === 0 ? result.toFixed(0) : result.toFixed(2);
	}
  
	onMount(() => {
	  loadMetrics();
	  loadPreviousWeekTotals();
	});
  </script>
  
  <!-- Week Navigation (aligned left) -->
  <div class="week-navigation">
	<button on:click={() => changeWeek(-1)}>Previous Week</button>
	<span class="week-range">
	  {#if weekDates.length === daysCount}
		{weekDates[0].toLocaleDateString()} - {weekDates[daysCount - 1].toLocaleDateString()}
	  {/if}
	</span>
	<button on:click={() => changeWeek(1)}>Next Week</button>
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
				{date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
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
				{date.toLocaleDateString(undefined, { weekday: "long" })}
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
			{notesMap}
			metricField={metric.metricField}
			wowChange={
			  computeWoWChange(
				currentTotals[metricIndex],
				isCurrentWeek ? partialPreviousTotalsComputed[metricIndex] : previousTotalsComputed[metricIndex],
				metric.name === "1.2 Hours Worked" ||
				metric.name === "1.4 Defects" ||
				metric.name === "1.5 Defects DPMO"
			  )
			}
			handleInputChange={handleInputChange}
			openNotes={openMetricsPanel}
			currentTotal={formatNumber(currentTotals[metricIndex])}
			byThisTimeLastWeek={formatNumber(isCurrentWeek ? partialPreviousTotalsComputed[metricIndex] : previousTotalsComputed[metricIndex])}
			previousTotal={formatNumber(previousTotalsComputed[metricIndex])}
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
  
  <!-- Metrics Side Panel Overlay -->
  {#if showMetricsPanel}
	<div class="overlay"
		 role="button"
		 tabindex="0"
		 on:click={closeMetricsPanel}
		 on:keydown={(e) => { 
		   if(e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { 
			 e.preventDefault(); 
			 closeMetricsPanel(); 
		   } 
		 }}>
	  <div role="button" tabindex="0"
		   on:click|stopPropagation
		   on:keydown={(e) => { 
			 if(e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { 
			   e.preventDefault(); 
			   openMetricsPanel(selectedMetricIndex, selectedDayIndex); 
			 } 
		   }}>
		<MetricsSidePanel
		  noteData={panelNoteData}
		  on:close={(e) => {
			e.stopPropagation();
			closeMetricsPanel();
		  }}
		  on:updateNote={(e: CustomEvent) => {
			const key = selectedDayIndex === -1 
			  ? `${selectedMetricIndex}-total`
			  : `${selectedMetricIndex}-${weekDates[selectedDayIndex].toISOString().split("T")[0]}`;
			notesMap[key] = e.detail.updatedNote;
			closeMetricsPanel();
		  }}
		/>
	  </div>
	</div>
  {/if}
  
  <style>
	.week-navigation {
	  display: flex;
	  justify-content: flex-start;
	  align-items: center;
	  padding: 16px 24px;
	  gap: 16px;
	}
	table {
  table-layout: fixed; /* Forces fixed layout */
  width: 100%;         /* Ensure table spans available width */
}

table th,
table td {
  width: 80px;         /* All cells get a fixed width (adjust as needed) */
  box-sizing: border-box;
}

/* If you want a wider first column (e.g. for metric names) */
.metric-name-header {
  width: 200px;
}
	.week-navigation button {
	  background: transparent;
	  border: none;
	  color: #004225;
	  font-weight: bold;
	  cursor: pointer;
	  font-size: 1em;
	  transition: color 0.2s ease;
	}
	.week-navigation button:hover {
	  color: #35b07b;
	}
	.week-range {
	  font-size: 1em;
	  font-weight: 500;
	}
	.card {
	  background-color: #fff;
	  border: 1px solid #E5E7EB;
	  border-radius: 6px;
	  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	  margin: 24px;
	  overflow: hidden;
	}
	.dashboard-container {
	  width: 100%;
	  overflow-x: auto;
	}
	.metric-name-header {
	  width: 200px;
	  font-size: 0.8em;
	  text-align: left;
	  padding-left: 24px;
	}
	.small-header {
	  width: 100px;
	}
	.table-header {
	  background: linear-gradient(180deg, #f5f7fa, #eaeef3);
	}
	.sub-header {
	  background-color: #f9fafb;
	  font-size: 0.71em;
	  color: #555;
	}
	.section-header td {
	  font-weight: bold;
	  background-color: #e0f7ea;
	  text-align: left;
	  padding: 8px 16px;
	  border: 1px solid #E5E7EB;
	}
	.spacer-row td {
	  padding: 4px;
	  background-color: #fff;
	}
	.chart-footer {
	  display: flex;
	  justify-content: flex-end;
	  padding: 8px 24px;
	}
	.chart-footer button {
	  background: #004225;
	  color: #fff;
	  border: none;
	  padding: 8px 12px;
	  font-size: 1em;
	  font-weight: bold;
	  cursor: pointer;
	  border-radius: 4px;
	  transition: background 0.2s ease;
	}
	.chart-footer button:hover {
	  background: #35b07b;
	}
	.overlay {
	  position: fixed;
	  top: 0;
	  left: 0;
	  width: 100%;
	  height: 100%;
	  background: rgba(0, 0, 0, 0.4);
	  z-index: 1090;
	}
  </style>