<script lang="ts">
	import { onMount, tick } from "svelte";
	import { supabase } from "./supabaseClient"; // Adjust path if needed
	import { getMonday, formatNumber, getWeekNumber, isToday } from "./utils";
	import MetricRow from "./MetricRow.svelte";
	import NotesModal from "./NotesModal.svelte"; // Ensure this file exists in src/lib
  
	// Define the metric type.
	type Metric = {
	  name: string;
	  values: number[];
	};
  
	// Instead of an enum, use a constant object.
	const MetricIndex = {
	  SHIPMENTS: 0,
	  HOURS_WORKED: 1,
	  SHIPMENTS_PER_HOUR: 2,
	  DEFECTS: 3,
	  DEFECTS_DPMO: 4,
	  ORDER_ACCURACY: 5,
	} as const;
  
	let metrics: Metric[] = [
	  { name: "Shipments Packed", values: Array(7).fill(0) },
	  { name: "Hours Worked", values: Array(7).fill(0) },
	  { name: "Shipments Per Hour", values: Array(7).fill(0) },  // computed
	  { name: "Defects", values: Array(7).fill(0) },
	  { name: "Defects DPMO", values: Array(7).fill(0) },          // computed
	  { name: "Order Accuracy (%)", values: Array(7).fill(0) },    // computed
	];
  
	// Mapping of metrics to database columns.
	// For computed metrics, use null.
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
  
	// Notes Modal variables.
	let showNotesModal = false;
	let selectedMetricIndex: number = -1;
	let selectedDayIndex: number = -1; // -1 indicates "Total" cell note.
	let noteTitle = "";
	let noteRootCause = "";
	let noteDetails = "";
	let noteActionPlan = "";
	let noteEditMode = false;
	let newComment = "";
	type NoteData = {
	  title: string;
	  rootCause: string;
	  details: string;
	  actionPlan: string;
	  comments: string[];
	};
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
  
	// --- Derived Value Functions for current week ---
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
	// --- End Derived Value Functions ---
  
	// --- Derived Value Functions for previous week totals ---
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
	// --- End Previous Week Derived Functions ---
  
	// Load current week metrics.
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
  
	// Load previous week metrics (base values only).
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
  
	// Compute computedMetrics array: for computed rows, use derived functions; else use base values.
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
  
	// Compute current week totals using computedMetrics for computed rows.
	$: currentTotals = metrics.map((_, idx) => {
	  const arr = metricFields[idx] === null ? computedMetrics[idx] : metrics[idx].values;
	  const end = isCurrentWeek ? (currentDayIndex >= 0 ? currentDayIndex : 6) : arr.length - 1;
	  return arr.slice(0, end + 1).reduce((acc, v) => acc + v, 0);
	});
  
	// For previous week totals, for computed rows, use the derived functions.
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
  
	// For "By This Time Last Week" totals (partial), use the partial slice of previousWeekMetrics for base rows,
	// and for computed rows use the derived functions.
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
  
	// Compute WoW change (remains similar).
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
  
	// Compute weekly total for display.
	function computeWeeklyTotal(metric: Metric, metricIndex: number): string {
	  // Use computedMetrics for computed rows.
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
  
	// Note modal functions.
	function openNotesModal(metricIndex: number, dayIndex: number) {
	  selectedMetricIndex = metricIndex;
	  selectedDayIndex = dayIndex;
	  const key =
		dayIndex === -1
		  ? `${metricIndex}-total`
		  : `${metricIndex}-${weekDates[dayIndex].toISOString().split("T")[0]}`;
	  if (notesMap[key]) {
		noteTitle = notesMap[key].title;
		noteRootCause = notesMap[key].rootCause;
		noteDetails = notesMap[key].details;
		noteActionPlan = notesMap[key].actionPlan;
	  } else {
		noteTitle = "";
		noteRootCause = "";
		noteDetails = "";
		noteActionPlan = "";
	  }
	  noteEditMode = notesMap[key] ? false : true;
	  showNotesModal = true;
	}
	function closeNotesModal() {
	  showNotesModal = false;
	}
	function getCalculationExplanation(metricIndex: number): string {
	  if (metricIndex === MetricIndex.SHIPMENTS_PER_HOUR)
		return "Calculated as:\nShipments Packed ÷ Hours Worked";
	  if (metricIndex === MetricIndex.DEFECTS_DPMO)
		return "Calculated as:\n(Defects ÷ Shipments Packed) × 1,000,000";
	  if (metricIndex === MetricIndex.ORDER_ACCURACY)
		return "Calculated as:\n((Shipments Packed - Defects) ÷ Shipments Packed) × 100";
	  return "";
	}
	function saveNote() {
	  const key =
		selectedDayIndex === -1
		  ? `${selectedMetricIndex}-total`
		  : `${selectedMetricIndex}-${weekDates[selectedDayIndex].toISOString().split("T")[0]}`;
	  notesMap[key] = {
		title: noteTitle,
		rootCause: noteRootCause,
		details: noteDetails,
		actionPlan: noteActionPlan,
		comments: notesMap[key]?.comments || [],
	  };
	  console.log("Note saved for", key, notesMap[key]);
	  closeNotesModal();
	}
	function addComment() {
	  const key = `${selectedMetricIndex}-total`;
	  if (!notesMap[key]) return;
	  if (newComment.trim()) {
		notesMap[key].comments.push(newComment.trim());
		newComment = "";
	  }
	}
	function toggleEditMode() {
	  noteEditMode = !noteEditMode;
	}
	function handleInputChange(metricIndex: number, dayIndex: number) {
	  saveMetricsForDay(dayIndex);
	}
	async function previousWeek() {
	  weekOffset -= 1;
	  await tick();
	  loadMetrics();
	  loadPreviousWeekTotals();
	}
	async function nextWeek() {
	  weekOffset += 1;
	  await tick();
	  loadMetrics();
	  loadPreviousWeekTotals();
	}
  
	onMount(() => {
	  loadMetrics();
	  loadPreviousWeekTotals();
	});
  </script>
  
  <!-- Week Navigation -->
  <div class="week-navigation">
	<button on:click={previousWeek}>Previous Week</button>
	<span class="week-range">
	  {#if weekDates.length === 7}
		{weekDates[0].toLocaleDateString()} - {weekDates[6].toLocaleDateString()}
	  {/if}
	</span>
	<button on:click={nextWeek}>Next Week</button>
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
		  {openNotesModal}
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
  
  <!-- Render the Notes Modal component -->
  <NotesModal
	showModal={showNotesModal}
	metricName={selectedMetricIndex >= 0 ? metrics[selectedMetricIndex].name : ""}
	noteData={
	  notesMap[selectedMetricIndex + "-total"] || {
		title: "",
		rootCause: "",
		details: "",
		actionPlan: "",
		comments: [],
	  }
	}
	isEditMode={noteEditMode}
	on:save={(e: CustomEvent) => {
	  noteTitle = e.detail.title;
	  noteRootCause = e.detail.rootCause;
	  noteDetails = e.detail.details;
	  noteActionPlan = e.detail.actionPlan;
	  saveNote();
	}}
	on:addComment={(e: CustomEvent) => addComment()}
	on:toggleEditMode={() => toggleEditMode()}
	on:close={() => closeNotesModal()}
  />
  
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
	.card {
	  background-color: #fff;
	  border-radius: 12px;
	  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
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
  </style>