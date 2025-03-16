<script lang="ts">
	import { onMount, tick } from "svelte";
	import { supabase } from "./supabaseClient";
	import { getMonday, formatNumber, getWeekNumber, isToday } from "./utils";
	import MetricRow from "./MetricRow.svelte";
	import MetricsSidePanel from "$lib/MetricsSidePanel.svelte";
  
	// Extended metric type allows header and spacer rows.
	interface ExtendedMetric {
	  name: string;
	  values?: number[];
	  metricField?: string | null;
	  isHeader?: boolean;
	  isSpacer?: boolean;
	}
  
	const daysCount = 7;
	
	// B2C Amazon Fulfilment section.
	let b2cMetrics: ExtendedMetric[] = [
	  { name: "B2C Amazon Fulfilment", isHeader: true },
	  { name: "1.1 Shipments Packed", values: new Array(daysCount).fill(0), metricField: "shipments" },
	  { name: "1.2 Hours Worked", values: new Array(daysCount).fill(0), metricField: "hours_worked" },
	  { name: "1.3 Shipments Per Hour", values: new Array(daysCount).fill(0), metricField: null },
	  { name: "1.4 Defects", values: new Array(daysCount).fill(0), metricField: "defects" },
	  { name: "1.5 Defects DPMO", values: new Array(daysCount).fill(0), metricField: null },
	  { name: "1.6 Order Accuracy (%)", values: new Array(daysCount).fill(0), metricField: null }
	];
  
	// Spacer row.
	let spacer: ExtendedMetric = { name: "", isSpacer: true };
  
	// B2B Warehouse and On‑road section with fictional metrics.
	let b2bMetrics: ExtendedMetric[] = [
	  { name: "B2B Warehouse and On‑road", isHeader: true },
	  { name: "2.1 Inventory Accuracy (%)", values: new Array(daysCount).fill(0), metricField: "inventory_accuracy" },
	  { name: "2.2 Order Picking Rate", values: new Array(daysCount).fill(0), metricField: "order_picking_rate" },
	  { name: "2.3 Delivery Timeliness (%)", values: new Array(daysCount).fill(0), metricField: "delivery_timeliness" },
	  { name: "2.4 Fuel Efficiency (MPG)", values: new Array(daysCount).fill(0), metricField: "fuel_efficiency" },
	  { name: "2.5 Driver Utilization (%)", values: new Array(daysCount).fill(0), metricField: "driver_utilization" }
	];
  
	// Combine both sections.
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
	$: currentDayIndex = isCurrentWeek ? Math.max(weekDates.findIndex(date => isToday(date)) - 1, 0) : daysCount - 1;
  
	// Declare computedMetrics variable.
	let computedMetrics: number[][] = [];
	$: computedMetrics = metrics.map((metric, idx): number[] => {
	  if (!metric.values) return [];
	  // Compute for B2C computed rows.
	  if (idx === 3 && metric.name.includes("Shipments Per Hour")) {
		const shipmentsArr = metrics[1].values || new Array(daysCount).fill(0);
		const hoursArr = metrics[2].values || new Array(daysCount).fill(0);
		return weekDates.map((_, i) => {
		  let shipments = shipmentsArr[i];
		  let hours = hoursArr[i];
		  return hours > 0 ? Math.round((shipments / hours) * 100) / 100 : 0;
		});
	  } else if (idx === 5 && metric.name.includes("Defects DPMO")) {
		const shipmentsArr = metrics[1].values || new Array(daysCount).fill(0);
		const defectsArr = metrics[4].values || new Array(daysCount).fill(0);
		return weekDates.map((_, i) => {
		  let shipments = shipmentsArr[i];
		  let defects = defectsArr[i];
		  return shipments > 0 ? Math.round((defects / shipments) * 1000000) : 0;
		});
	  } else if (idx === 6 && metric.name.includes("Order Accuracy")) {
		const shipmentsArr = metrics[1].values || new Array(daysCount).fill(0);
		const defectsArr = metrics[4].values || new Array(daysCount).fill(0);
		return weekDates.map((_, i) => {
		  let shipments = shipmentsArr[i];
		  let defects = defectsArr[i];
		  return shipments > 0 ? Math.round(((shipments - defects) / shipments) * 10000) / 100 : 0;
		});
	  }
	  return metric.values;
	});
  
	// Example current totals.
	$: currentTotals = metrics.map((metric, idx) => {
	  if (!metric.values) return 0;
	  let arr: number[] =
		metric.metricField === undefined
		  ? (computedMetrics[idx] || [])
		  : (metric.values as number[]);
	  const end = isCurrentWeek ? (currentDayIndex >= 0 ? currentDayIndex : daysCount - 1) : arr.length - 1;
	  return arr.slice(0, end + 1).reduce((acc, v) => acc + v, 0);
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
	  let updatedMetrics = metrics.map(metric => ({
		...metric,
		values: metric.values ? [...metric.values] : undefined
	  }));
	  for (let i = 0; i < weekDates.length; i++) {
		const dateStr = weekDates[i].toISOString().split("T")[0];
		const data = await loadMetricsForDate(dateStr);
		updatedMetrics = updatedMetrics.map(metric => {
		  if (metric.values && metric.metricField !== undefined && metric.metricField !== null) {
			return {
			  ...metric,
			  values: metric.values.map((val, j) =>
				j === i ? ((data as any)[metric.metricField!] ?? 0) : val
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
	  metrics.forEach(metric => {
		if (metric.values && metric.metricField !== undefined && metric.metricField !== null) {
		  data[metric.metricField] = metric.values[dayIndex];
		}
	  });
	  await saveMetricsForDate(dateStr, data);
	}
  
	async function saveAllMetrics() {
	  for (let i = 0; i < weekDates.length; i++) {
		await saveMetricsForDay(i);
	  }
	  await tick();
	  await loadMetrics();
	}
  
	function handleInputChange(metricIndex: number, dayIndex: number, newValue?: number) {
	  if (newValue === undefined) return;
	  metrics = metrics.map((metric, idx) => {
		if (idx === metricIndex && metric.values) {
		  const newValues = [...metric.values];
		  newValues[dayIndex] = newValue;
		  return { ...metric, values: newValues };
		}
		return metric;
	  });
	  saveMetricsForDay(dayIndex);
	}
  
	async function changeWeek(offset: number) {
	  weekOffset += offset;
	  await tick();
	  await new Promise(resolve => setTimeout(resolve, 100));
	  await loadMetrics();
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
  
	function computeWeeklyTotal(metric: { name: string; values: number[] }, metricIndex: number): string {
	  const total = metric.values.reduce((acc, v) => acc + v, 0);
	  return total % 1 === 0 ? total.toFixed(0) : total.toFixed(2);
	}
  
	onMount(() => {
	  loadMetrics();
	});
  </script>
  
  <!-- Week Navigation -->
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
				values={metric.values}
				{metricIndex}
				{weekDates}
				{currentDayIndex}
				{isCurrentWeek}
				{notesMap}
				metricField={metric.metricField ?? null}
				wowChange={computedMetrics[metricIndex] ? computeWeeklyTotal({ name: metric.name, values: computedMetrics[metricIndex]! }, metricIndex) : ""}
				handleInputChange={handleInputChange}
				openNotes={openMetricsPanel}
				computeWeeklyTotal={computeWeeklyTotal}
				currentTotal={formatNumber(currentTotals[metricIndex])}
				byThisTimeLastWeek={formatNumber(0)}
				previousTotal={formatNumber(0)}
			  />
			{/if}
		  {/each}
		</tbody>
	  </table>
	</div>
  </div>
  
  <div class="global-save-container">
	<button on:click={saveAllMetrics}>Save All Metrics</button>
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