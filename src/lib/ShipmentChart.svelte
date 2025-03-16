<script lang="ts">
	import { onMount, tick } from "svelte";
	import { supabase } from "./supabaseClient";
	import { getMonday, formatNumber, getWeekNumber, isToday } from "./utils";
	import MetricRow from "./MetricRow.svelte";
	import MetricsSidePanel from "$lib/MetricsSidePanel.svelte";
  
	// Define the metric type.
	type Metric = {
	  name: string;
	  values: number[];
	};
  
	const MetricIndex = {
	  SHIPMENTS: 0,
	  HOURS_WORKED: 1,
	  SHIPMENTS_PER_HOUR: 2,
	  DEFECTS: 3,
	  DEFECTS_DPMO: 4,
	  ORDER_ACCURACY: 5,
	} as const;
  
	let metrics: Metric[] = [
	  { name: "1.1 Shipments Packed", values: Array(7).fill(0) },
	  { name: "1.2 Hours Worked", values: Array(7).fill(0) },
	  { name: "1.3 Shipments Per Hour", values: Array(7).fill(0) },
	  { name: "1.4 Defects", values: Array(7).fill(0) },
	  { name: "1.5 Defects DPMO", values: Array(7).fill(0) },
	  { name: "1.6 Order Accuracy (%)", values: Array(7).fill(0) }
	];  
	// Mapping of metrics to database columns.
	const metricFields: (string | null)[] = [
	  "shipments",
	  "hours_worked",
	  null, // computed: Shipments Per Hour
	  "defects",
	  null, // computed: Defects DPMO
	  null, // computed: Order Accuracy (%)
	];
  
	let weekOffset: number = 0;
	const msPerDay = 24 * 60 * 60 * 1000;
	let loading = false;
  
	// Variables for previous week totals.
	let previousTotals: number[] = metrics.map(() => 0);
	let previousWeekMetrics: number[][] = metrics.map(() => Array(7).fill(0));
  
	// ----- Metrics Side Panel Variables -----
	let showMetricsPanel = false;
	let selectedMetricIndex = -1;
	let selectedDayIndex = -1; // -1 indicates the total cell
	type NoteData = {
	  title: string;
	  rootCause: string;
	  details: string;
	  actionPlan: string;
	  comments: string[];
	};
	let panelNoteData: NoteData = { title: "", rootCause: "", details: "", actionPlan: "", comments: [] };
	
	// Notes stored by a key (e.g. "2-2025-03-06" or "2-total")
	let notesMap: Record<string, NoteData> = {};
  
	// Reactive date calculations.
	$: displayedMonday = (() => {
	  const currentMonday = getMonday(new Date());
	  return new Date(currentMonday.getTime() + weekOffset * 7 * msPerDay);
	})();
	$: isCurrentWeek =
	  getMonday(new Date()).toISOString() === getMonday(new Date(displayedMonday)).toISOString();
	$: weekDates = (() => {
	  const dates: Date[] = [];
	  for (let i = 0; i < 7; i++) {
		dates.push(new Date(displayedMonday.getTime() + i * msPerDay));
	  }
	  return dates;
	})();
	$: previousWeekDates = (() => {
	  const prevMonday = new Date(displayedMonday.getTime() - 7 * msPerDay);
	  const dates: Date[] = [];
	  for (let i = 0; i < 7; i++) {
		dates.push(new Date(prevMonday.getTime() + i * msPerDay));
	  }
	  return dates;
	})();
	$: currentDayIndex = isCurrentWeek ? Math.max(weekDates.findIndex(date => isToday(date)) - 1, 0) : 6;
  
	// Derived Value Functions for current week.
	function computeShipmentsPerHour(dayIndex: number): number {
	  const shipments = metrics[MetricIndex.SHIPMENTS].values[dayIndex];
	  const hours = metrics[MetricIndex.HOURS_WORKED].values[dayIndex];
	  return hours > 0 ? Math.round((shipments / hours) * 100) / 100 : 0;
	}
	function computeDefectsDPMO(dayIndex: number): number {
	  const shipments = metrics[MetricIndex.SHIPMENTS].values[dayIndex];
	  const defects = metrics[MetricIndex.DEFECTS].values[dayIndex];
	  return shipments > 0 ? Math.round((defects / shipments) * 1000000) : 0;
	}
	function computeOrderAccuracy(dayIndex: number): number {
	  const shipments = metrics[MetricIndex.SHIPMENTS].values[dayIndex];
	  const defects = metrics[MetricIndex.DEFECTS].values[dayIndex];
	  return shipments > 0 ? Math.round(((shipments - defects) / shipments) * 10000) / 100 : 0;
	}
	// Derived Functions for previous week totals.
	function computePrevShipmentsPerHour(): number {
	  const end = currentDayIndex >= 0 ? currentDayIndex : 6;
	  const shipments = previousWeekMetrics[0].slice(0, end + 1).reduce((acc, v) => acc + v, 0);
	  const hours = previousWeekMetrics[1].slice(0, end + 1).reduce((acc, v) => acc + v, 0);
	  return hours > 0 ? shipments / hours : 0;
	}
	function computePrevDefectsDPMO(): number {
	  const end = currentDayIndex >= 0 ? currentDayIndex : 6;
	  const defects = previousWeekMetrics[3].slice(0, end + 1).reduce((acc, v) => acc + v, 0);
	  const shipments = previousWeekMetrics[0].slice(0, end + 1).reduce((acc, v) => acc + v, 0);
	  return shipments > 0 ? (defects / shipments) * 1000000 : 0;
	}
	function computePrevOrderAccuracy(): number {
	  const end = currentDayIndex >= 0 ? currentDayIndex : 6;
	  const shipments = previousWeekMetrics[0].slice(0, end + 1).reduce((acc, v) => acc + v, 0);
	  const defects = previousWeekMetrics[3].slice(0, end + 1).reduce((acc, v) => acc + v, 0);
	  return shipments > 0 ? ((shipments - defects) / shipments) * 100 : 0;
	}
  
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
  
	async function loadPreviousWeekTotals() {
	  let totals = metrics.map(() => 0);
	  previousWeekMetrics = metrics.map(() => Array(7).fill(0));
	  for (let i = 0; i < previousWeekDates.length; i++) {
		const dateStr = previousWeekDates[i].toISOString().split("T")[0];
		const data = await loadMetricsForDate(dateStr);
		if (data) {
		  metricFields.forEach((field, idx) => {
			if (field !== null) {
			  const val = data[field] ?? 0;
			  previousWeekMetrics[idx][i] = val;
			  totals[idx] += val;
			}
		  });
		}
	  }
	  previousTotals = totals;
	}
  
	$: computedMetrics = metrics.map((metric, idx) => {
	  if (metricFields[idx] === null) {
		if (idx === MetricIndex.SHIPMENTS_PER_HOUR) {
		  return weekDates.map((_, i) => computeShipmentsPerHour(i));
		} else if (idx === MetricIndex.DEFECTS_DPMO) {
		  return weekDates.map((_, i) => computeDefectsDPMO(i));
		} else if (idx === MetricIndex.ORDER_ACCURACY) {
		  return weekDates.map((_, i) => computeOrderAccuracy(i));
		} else {
		  return metric.values;
		}
	  } else {
		return metric.values;
	  }
	});
  
	$: currentTotals = metrics.map((_, idx) => {
	  const arr = metricFields[idx] === null ? computedMetrics[idx] : metrics[idx].values;
	  const end = isCurrentWeek ? (currentDayIndex >= 0 ? currentDayIndex : 6) : arr.length - 1;
	  return arr.slice(0, end + 1).reduce((acc, v) => acc + v, 0);
	});
  
	$: previousTotalsComputed = metrics.map((_, idx) => {
	  if (metricFields[idx] !== null) {
		return previousTotals[idx];
	  } else {
		if (idx === MetricIndex.SHIPMENTS_PER_HOUR) return computePrevShipmentsPerHour();
		if (idx === MetricIndex.DEFECTS_DPMO) return computePrevDefectsDPMO();
		if (idx === MetricIndex.ORDER_ACCURACY) return computePrevOrderAccuracy();
		return 0;
	  }
	});
  
	$: partialPreviousTotalsComputed = metrics.map((_, idx) => {
	  if (metricFields[idx] !== null) {
		const arr = previousWeekMetrics[idx];
		const end = isCurrentWeek ? (currentDayIndex >= 0 ? currentDayIndex : 6) : arr.length - 1;
		return arr.slice(0, end + 1).reduce((acc, v) => acc + v, 0);
	  } else {
		if (idx === MetricIndex.SHIPMENTS_PER_HOUR) return computePrevShipmentsPerHour();
		if (idx === MetricIndex.DEFECTS_DPMO) return computePrevDefectsDPMO();
		if (idx === MetricIndex.ORDER_ACCURACY) return computePrevOrderAccuracy();
		return 0;
	  }
	});
  
	$: wowChange = metrics.map((_, idx) => {
	  if (isCurrentWeek && metricFields[idx] === null) {
		let currVal = 0, prevVal = 0;
		if (idx === MetricIndex.SHIPMENTS_PER_HOUR) {
		  const values = weekDates.map((_, i) => computeShipmentsPerHour(i)).filter(v => v > 0);
		  currVal = values.length ? values.reduce((acc, v) => acc + v, 0) / values.length : 0;
		  prevVal = computePrevShipmentsPerHour();
		} else if (idx === MetricIndex.DEFECTS_DPMO) {
		  const values = weekDates.map((_, i) => computeDefectsDPMO(i)).filter(v => v > 0);
		  currVal = values.length ? values.reduce((acc, v) => acc + v, 0) / values.length : 0;
		  prevVal = computePrevDefectsDPMO();
		} else if (idx === MetricIndex.ORDER_ACCURACY) {
		  const values = weekDates.map((_, i) => computeOrderAccuracy(i)).filter(v => v > 0);
		  currVal = values.length ? values.reduce((acc, v) => acc + v, 0) / values.length : 0;
		  prevVal = computePrevOrderAccuracy();
		}
		if (prevVal === 0) return "N/A";
		const change = ((currVal - prevVal) / prevVal) * 100;
		return change % 1 === 0 ? change.toFixed(0) + "%" : change.toFixed(2) + "%";
	  } else {
		const curr = currentTotals[idx];
		const prev = isCurrentWeek ? partialPreviousTotalsComputed[idx] : previousTotalsComputed[idx];
		if (prev === 0) return "N/A";
		const change = ((curr - prev) / prev) * 100;
		return change % 1 === 0 ? change.toFixed(0) + "%" : change.toFixed(2) + "%";
	  }
	});
  
	function computeWeeklyTotal(metric: Metric, metricIndex: number): string {
	  const arr = metricFields[metricIndex] === null ? computedMetrics[metricIndex] : metric.values;
	  if (metricIndex === MetricIndex.ORDER_ACCURACY) {
		const totalShipments = computedMetrics[MetricIndex.SHIPMENTS].reduce((acc, v) => acc + v, 0);
		const totalDefects = computedMetrics[MetricIndex.DEFECTS].reduce((acc, v) => acc + v, 0);
		const accuracy = totalShipments > 0 ? ((totalShipments - totalDefects) / totalShipments) * 100 : 0;
		return accuracy % 1 === 0 ? accuracy.toFixed(0) + "%" : accuracy.toFixed(2) + "%";
	  } else if (metricFields[metricIndex] === null) {
		const validValues = arr.filter(v => v > 0);
		const sum = validValues.reduce((acc, v) => acc + v, 0);
		const avg = validValues.length > 0 ? sum / validValues.length : 0;
		return avg % 1 === 0 ? avg.toFixed(0) : avg.toFixed(2);
	  } else {
		const total = arr.reduce((acc, v) => acc + (Number(v) || 0), 0);
		return total % 1 === 0 ? total.toFixed(0) : total.toFixed(2);
	  }
	}
  
	async function loadMetrics() {
	  if (typeof window === "undefined") return;
	  loading = true;
	  let updatedMetrics = metrics.map(metric => ({
		...metric,
		values: [...metric.values],
	  }));
	  for (let i = 0; i < weekDates.length; i++) {
		const dateStr = weekDates[i].toISOString().split("T")[0];
		const data = await loadMetricsForDate(dateStr);
		if (data) {
		  updatedMetrics = updatedMetrics.map((metric, idx) => {
			if (metricFields[idx] !== null) {
			  return {
				...metric,
				values: metric.values.map((val, j) =>
				  j === i ? data[metricFields[idx] as string] ?? 0 : val
				),
			  };
			} else {
			  return metric;
			}
		  });
		} else {
		  updatedMetrics = updatedMetrics.map(metric => ({
			...metric,
			values: metric.values.map((val, j) => (j === i ? 0 : val)),
		  }));
		}
	  }
	  metrics = updatedMetrics;
	  loading = false;
	}
  
	async function saveMetricsForDate(dateStr: string, metricsData: any) {
	  const { error } = await supabase
		.from("daily_metrics")
		.upsert({ date: dateStr, ...metricsData }, { onConflict: "date" });
	  if (error) {
		console.error("Error saving metrics for date " + dateStr, error);
	  }
	}
  
	async function saveMetricsForDay(dayIndex: number) {
	  const dateStr = weekDates[dayIndex].toISOString().split("T")[0];
	  const data: Record<string, number> = {};
	  metrics.forEach((metric, idx) => {
		if (metricFields[idx] !== null) {
		  data[metricFields[idx] as string] = metric.values[dayIndex];
		}
	  });
	  await saveMetricsForDate(dateStr, data);
	}
  
	async function saveAllMetrics() {
	  for (let i = 0; i < weekDates.length; i++) {
		await saveMetricsForDay(i);
	  }
	  loadPreviousWeekTotals();
	}
  
	// ----- Metrics Side Panel functions -----
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
	// ----- End Metrics Side Panel functions -----
  
	function handleInputChange(metricIndex: number, dayIndex: number) {
	  saveMetricsForDay(dayIndex);
	}
  
	// New function to change weeks with a delay
	async function changeWeek(offset: number) {
	  weekOffset += offset;
	  await tick();
	  // Optional small delay (100ms) to let reactive updates settle
	  await new Promise(resolve => setTimeout(resolve, 100));
	  await loadMetrics();
	  await loadPreviousWeekTotals();
	}
  
	onMount(() => {
	  loadMetrics();
	  loadPreviousWeekTotals();
	});
</script>
  
<!-- Week Navigation -->
<div class="week-navigation">
	<button on:click={() => changeWeek(-1)}>Previous Week</button>
	<span class="week-range">
	  {#if weekDates.length === 7}
		{weekDates[0].toLocaleDateString()} - {weekDates[6].toLocaleDateString()}
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
			<MetricRow
			  name={metric.name}
			  values={computedMetrics[metricIndex]}
			  {metricIndex}
			  {weekDates}
			  {currentDayIndex}
			  {isCurrentWeek}
			  {notesMap}
			  metricField={metricFields[metricIndex]}
			  wowChange={wowChange[metricIndex]}
			  {handleInputChange}
			  openNotes={openMetricsPanel}
			  computeWeeklyTotal={computeWeeklyTotal}
			  currentTotal={formatNumber(currentTotals[metricIndex])}
			  byThisTimeLastWeek={
				isCurrentWeek
				  ? formatNumber(partialPreviousTotalsComputed[metricIndex])
				  : formatNumber(previousTotalsComputed[metricIndex])
			  }
			  previousTotal={formatNumber(previousTotalsComputed[metricIndex])}
			/>
		  {/each}
		</tbody>
	  </table>
	</div>
</div>
  
<div class="global-save-container">
	<button on:click={saveAllMetrics}>Save All Metrics</button>
</div>
  
<!-- Render the Metrics Side Panel with overlay -->
{#if showMetricsPanel}
	<div class="overlay" on:click={closeMetricsPanel}>
	  <div on:click|stopPropagation>
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
	  justify-content: space-between;
	  align-items: center;
	  padding: 16px 24px;
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
	/* Updated metrics deck (card) styles: combination of border and box shadow */
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
	table {
	  width: 100%;
	  border-collapse: collapse;
	  table-layout: fixed;
	}
	th,
	td {
	  padding: 12px 1px;
	  text-align: center;
	  border-bottom: 1px solid #E5E7EB;
	  border-right: 1px solid #E5E7EB;
	}
	th:last-child,
	td:last-child {
	  border-right: none;
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
	.global-save-container {
	  text-align: right;
	  margin: 16px 24px;
	}
	.global-save-container button {
	  background: #004225;
	  border: none;
	  color: #fff;
	  padding: 10px 20px;
	  font-size: 1em;
	  font-weight: bold;
	  cursor: pointer;
	  border-radius: 8px;
	  transition: background 0.2s ease;
	}
	.global-save-container button:hover {
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