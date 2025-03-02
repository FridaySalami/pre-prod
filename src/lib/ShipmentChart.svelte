<script lang="ts">
	import { onMount, tick } from "svelte";
	import { supabase } from "./supabaseClient";

	// Define the metric type.
	type Metric = {
		name: string;
		values: number[];
	};

	let metrics: Metric[] = [
		{ name: "Shipments Packed", values: Array(7).fill(0) },
		{ name: "Hours Worked", values: Array(7).fill(0) },
		{ name: "Shipments Per Hour", values: Array(7).fill(0) },
		{ name: "Defects", values: Array(7).fill(0) },
		{ name: "Defects DPMO", values: Array(7).fill(0) },
		{ name: "Order Accuracy (%)", values: Array(7).fill(0) }
	];

	// Mapping of metrics to database columns.
	// For computed rows (indices 2, 4, and 5) we use null.
	const metricFields: (string | null)[] = [
		"shipments",
		"hours_worked",
		null, // computed: Shipments Per Hour
		"defects",
		null, // computed: Defects DPMO
		null  // computed: Order Accuracy (%)
	];

	let weekOffset: number = 0;
	const msPerDay = 24 * 60 * 60 * 1000;
	let loading = false;

	// Variables for previous week totals.
	let previousTotals: number[] = metrics.map(() => 0);
	// Store previous week daily values per metric (an array of 7 numbers for each metric)
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

	// Helpers.
	function getMonday(date: Date): Date {
		const d = new Date(date);
		const day = d.getDay();
		const diff = d.getDate() - day + (day === 0 ? -6 : 1);
		return new Date(d.setDate(diff));
	}
	function formatNumber(num: number): string {
		return num % 1 === 0 ? num.toFixed(0) : num.toFixed(2);
	}
	function getWeekNumber(date: Date): number {
		const start = new Date(date.getFullYear(), 0, 1);
		const diff = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
		return Math.ceil((diff + 1) / 7);
	}
	function isToday(date: Date): boolean {
		const today = new Date();
		return date.getFullYear() === today.getFullYear() &&
		       date.getMonth() === today.getMonth() &&
		       date.getDate() === today.getDate();
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
	function getWowColor(changeStr: string): string {
		if (changeStr === "N/A") return "#6B7280";
		const num = parseFloat(changeStr);
		if (isNaN(num)) return "#6B7280";
		if (num > 0) return "#28a745";
		if (num < 0) return "#dc3545";
		return "#6B7280";
	}

	// NEW HELPER FUNCTIONS FOR PREVIOUS WEEK COMPUTED VALUES

	// For Shipments Per Hour: use previous week's shipments (index 0) and hours worked (index 1).
	function computePrevShipmentsPerHour(): number {
		const end = currentDayIndex >= 0 ? currentDayIndex : 6;
		const shipments = previousWeekMetrics[0].slice(0, end + 1).reduce((acc, v) => acc + v, 0);
		const hours = previousWeekMetrics[1].slice(0, end + 1).reduce((acc, v) => acc + v, 0);
		return hours > 0 ? shipments / hours : 0;
	}
	// For Defects DPMO: use previous week's defects (index 3) and shipments (index 0).
	function computePrevDefectsDPMO(): number {
		const end = currentDayIndex >= 0 ? currentDayIndex : 6;
		const defects = previousWeekMetrics[3].slice(0, end + 1).reduce((acc, v) => acc + v, 0);
		const shipments = previousWeekMetrics[0].slice(0, end + 1).reduce((acc, v) => acc + v, 0);
		return shipments > 0 ? (defects / shipments) * 1000000 : 0;
	}
	// For Order Accuracy (%): use previous week's shipments (index 0) and defects (index 3).
	function computePrevOrderAccuracy(): number {
		const end = currentDayIndex >= 0 ? currentDayIndex : 6;
		const shipments = previousWeekMetrics[0].slice(0, end + 1).reduce((acc, v) => acc + v, 0);
		const defects = previousWeekMetrics[3].slice(0, end + 1).reduce((acc, v) => acc + v, 0);
		return shipments > 0 ? ((shipments - defects) / shipments) * 100 : 0;
	}

	// Reactive calculations.
	$: displayedMonday = (() => {
		const currentMonday = getMonday(new Date());
		return new Date(currentMonday.getTime() + weekOffset * 7 * msPerDay);
	})();
	$: isCurrentWeek = getMonday(new Date()).toISOString() === getMonday(new Date(displayedMonday)).toISOString();
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
	// For morning review, we use the previous day's data.
	$: currentDayIndex = isCurrentWeek ? Math.max(weekDates.findIndex(date => isToday(date)) - 1, 0) : 6;

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

	// Compute current totals (partial if current week).
	$: currentTotals = metrics.map(metric => {
		if (isCurrentWeek) {
			const end = currentDayIndex >= 0 ? currentDayIndex : 6;
			return metric.values.slice(0, end + 1).reduce((acc, v) => acc + v, 0);
		} else {
			return metric.values.reduce((acc, v) => acc + v, 0);
		}
	});
	// Compute partial previous totals for non-computed metrics if current week.
	$: partialPreviousTotals = metrics.map((_, idx) => {
		if (isCurrentWeek) {
			const end = currentDayIndex >= 0 ? currentDayIndex : 6;
			return previousWeekMetrics[idx].slice(0, end + 1).reduce((acc, v) => acc + v, 0);
		} else {
			return previousTotals[idx];
		}
	});
	// Compute WoW change.
	$: wowChange = metrics.map((_, idx) => {
  if (isCurrentWeek && metricFields[idx] === null) {
    // For computed metrics, use the average from days 0..currentDayIndex.
    let currVal = 0, prevVal = 0;
    const validValues = metrics[idx].values.slice(0, currentDayIndex + 1).filter(v => Number(v) > 0);
    currVal = validValues.length ? validValues.reduce((acc, v) => acc + Number(v), 0) / validValues.length : 0;
    if (idx === 2) {
      prevVal = computePrevShipmentsPerHour();
    } else if (idx === 4) {
      prevVal = computePrevDefectsDPMO();
    } else if (idx === 5) {
      prevVal = computePrevOrderAccuracy();
    }
    if (prevVal === 0) return "N/A";
    const change = ((currVal - prevVal) / prevVal) * 100;
    return change % 1 === 0 ? change.toFixed(0) + "%" : change.toFixed(2) + "%";
  } else {
    // For non-computed metrics, use the sums.
    const curr = currentTotals[idx];
    const prev = isCurrentWeek ? partialPreviousTotals[idx] : previousTotals[idx];
    if (prev === 0) return "N/A";
    const change = ((curr - prev) / prev) * 100;
    return change % 1 === 0 ? change.toFixed(0) + "%" : change.toFixed(2) + "%";
  }
});
	async function loadMetrics() {
		if (typeof window === "undefined") return;
		loading = true;
		let updatedMetrics = metrics.map(metric => ({
			...metric,
			values: [...metric.values]
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
							)
						};
					} else {
						return metric;
					}
				});
			} else {
				updatedMetrics = updatedMetrics.map(metric => ({
					...metric,
					values: metric.values.map((val, j) => (j === i ? 0 : val))
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

	$: {
		for (let i = 0; i < weekDates.length; i++) {
			const shipments = metrics[0].values[i];
			const hoursWorked = metrics[1].values[i];
			const defects = metrics[3].values[i];
			metrics[2].values[i] = hoursWorked > 0 ? Math.round((shipments / hoursWorked) * 100) / 100 : 0;
			metrics[4].values[i] = shipments > 0 ? Math.round((defects / shipments) * 1000000) : 0;
			metrics[5].values[i] = shipments > 0 ? Math.round(((shipments - defects) / shipments) * 10000) / 100 : 0;
		}
	}

	function computeWeeklyTotal(metric: Metric, metricIndex: number): string {
		// For non-computed metrics and for Order Accuracy (index 5)
		if (metricIndex === 5) {
			const totalShipments = metrics[0].values.reduce((acc, v) => acc + v, 0);
			const totalDefects = metrics[3].values.reduce((acc, v) => acc + v, 0);
			const accuracy = totalShipments > 0 ? ((totalShipments - totalDefects) / totalShipments) * 100 : 0;
			return accuracy % 1 === 0 ? accuracy.toFixed(0) + "%" : accuracy.toFixed(2) + "%";
		} else if (metricIndex === 2) {
			// For Shipments Per Hour, average non-zero values.
			const validValues = metric.values.filter(val => Number(val) > 0);
			const sum = validValues.reduce((acc, num) => acc + Number(num), 0);
			const average = validValues.length > 0 ? sum / validValues.length : 0;
			return average % 1 === 0 ? average.toFixed(0) : average.toFixed(2);
		} else if (metricIndex === 4) {
			// For Defects DPMO, average non-zero values.
			const validValues = metric.values.filter(val => Number(val) > 0);
			const sum = validValues.reduce((acc, num) => acc + Number(num), 0);
			const average = validValues.length > 0 ? sum / validValues.length : 0;
			return average % 1 === 0 ? average.toFixed(0) : average.toFixed(2);
		} else {
			const total = metric.values.reduce((acc, num) => acc + (Number(num) || 0), 0);
			return total % 1 === 0 ? total.toFixed(0) : total.toFixed(2);
		}
	}

	function openNotesModal(metricIndex: number, dayIndex: number) {
		selectedMetricIndex = metricIndex;
		selectedDayIndex = dayIndex;
		const key = dayIndex === -1
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
  if (metricIndex === 2) return "Calculated as:\nShipments Packed ÷ Hours Worked";
  if (metricIndex === 4) return "Calculated as:\n(Defects ÷ Shipments Packed) × 1,000,000";
  if (metricIndex === 5) return "Calculated as:\n((Shipments Packed - Defects) ÷ Shipments Packed) × 100";
  return "";
}
	function saveNote() {
		const key = selectedDayIndex === -1
			? `${selectedMetricIndex}-total`
			: `${selectedMetricIndex}-${weekDates[selectedDayIndex].toISOString().split("T")[0]}`;
		notesMap[key] = {
			title: noteTitle,
			rootCause: noteRootCause,
			details: noteDetails,
			actionPlan: noteActionPlan,
			comments: notesMap[key]?.comments || []
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
					<tr>
						<td class="metric-name">
							{metric.name}
							{#if metricFields[metricIndex] === null}
							  <div class="calc-info-container">
								<span class="calc-info">?</span>
								<div class="calc-tooltip">{getCalculationExplanation(metricIndex)}</div>
							  </div>
							{/if}
						  </td>
						  						  						{#each metric.values as value, dayIndex}
							<td class:current-day={isCurrentWeek && dayIndex === currentDayIndex}>
								{#if metricFields[metricIndex] !== null}
									<input
										type="number"
										bind:value={metrics[metricIndex].values[dayIndex]}
										on:blur={() => handleInputChange(metricIndex, dayIndex)}
										on:keydown={(e) => e.key === "Enter" && handleInputChange(metricIndex, dayIndex)}
										class="cell-value"
									/>
								{:else}
									<span
										role="button"
										tabindex="0"
										class="cell-value computed-cell"
										on:click={() => openNotesModal(metricIndex, dayIndex)}
										on:keydown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNotesModal(metricIndex, dayIndex); } }}
									>
										{formatNumber(value)}
										{#if notesMap[`${metricIndex}-${weekDates[dayIndex].toISOString().split("T")[0]}`]}
											<div class="note-indicator" role="presentation"></div>
										{/if}
									</span>
								{/if}
							</td>
						{/each}
						<!-- Current Week Total cell -->
						<td>
							<span
								role="button"
								tabindex="0"
								on:click={() => openNotesModal(metricIndex, -1)}
								on:keydown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNotesModal(metricIndex, -1); } }}
							>
								<strong>{computeWeeklyTotal(metric, metricIndex)}</strong>
								{#if notesMap[`${metricIndex}-total`]}
									<div class="note-indicator" role="presentation"></div>
								{/if}
							</span>
						</td>
						<!-- By This Time Last Week cell -->
						<td>
							<em class="by-this-time">
								{#if metricFields[metricIndex] !== null}
									{isCurrentWeek 
										? (partialPreviousTotals[metricIndex] % 1 === 0 
											? partialPreviousTotals[metricIndex].toFixed(0) 
											: partialPreviousTotals[metricIndex].toFixed(2))
										: (previousTotals[metricIndex] % 1 === 0 
											? previousTotals[metricIndex].toFixed(0) 
											: previousTotals[metricIndex].toFixed(2))
									}
								{:else}
									{#if metricIndex === 2}
										{(() => {
											const val = computePrevShipmentsPerHour();
											return val % 1 === 0 ? val.toFixed(0) : val.toFixed(2);
										})()}
									{:else if metricIndex === 4}
										{(() => {
											const val = computePrevDefectsDPMO();
											return val % 1 === 0 ? val.toFixed(0) : val.toFixed(2);
										})()}
									{:else if metricIndex === 5}
										{(() => {
											const val = computePrevOrderAccuracy();
											return val % 1 === 0 ? val.toFixed(0) + "%" : val.toFixed(2) + "%";
										})()}
									{/if}
								{/if}
							</em>
						</td>
						<!-- WoW % Change cell -->
						<td style="color: {getWowColor(wowChange[metricIndex])};">
							<em class="wow-change">{wowChange[metricIndex]}</em>
						</td>
						<!-- Previous Week Total cell -->
						<td class="prev-week-col">
							<em class="prev-total">
								{metricFields[metricIndex] !== null
									? previousTotals[metricIndex] % 1 === 0
										? previousTotals[metricIndex].toFixed(0)
										: previousTotals[metricIndex].toFixed(2)
									: '-'}
							</em>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<div class="global-save-container">
	<button on:click={saveAllMetrics}>Save All Metrics</button>
</div>

{#if showNotesModal}
	<div 
		class="modal-overlay" 
		on:click={closeNotesModal} 
		role="button" 
		tabindex="0" 
		on:keydown={(e) => { if(e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); closeNotesModal(); } }}
	>
		<div class="modal-content" on:click|stopPropagation>
			{#if noteEditMode}
				<h2>Edit Note for {metrics[selectedMetricIndex].name} Total</h2>
				<p>Total: <strong>{computeWeeklyTotal(metrics[selectedMetricIndex], selectedMetricIndex)}</strong></p>
				<label>
					Title:
					<input type="text" bind:value={noteTitle} />
				</label>
				<label>
					Root Cause:
					<input type="text" bind:value={noteRootCause} />
				</label>
				<label>
					Details:
					<textarea bind:value={noteDetails}></textarea>
				</label>
				<label>
					Action Plan:
					<textarea bind:value={noteActionPlan}></textarea>
				</label>
				<div class="modal-buttons">
					<button on:click={saveNote}>Save Note</button>
					<button on:click={closeNotesModal}>Cancel</button>
				</div>
			{:else}
				<h2>Note for {metrics[selectedMetricIndex].name} Total</h2>
				<p><strong>Title:</strong> {noteTitle}</p>
				<p><strong>Root Cause:</strong> {noteRootCause}</p>
				<p><strong>Details:</strong> {noteDetails}</p>
				<p><strong>Action Plan:</strong> {noteActionPlan}</p>
				<div class="comments-section">
					<h3>Comments</h3>
					{#if notesMap[`${selectedMetricIndex}-total`]?.comments?.length}
						<ul class="comments-list">
							{#each notesMap[`${selectedMetricIndex}-total`].comments as comment}
								<li>{comment}</li>
							{/each}
						</ul>
					{:else}
						<p>No comments yet.</p>
					{/if}
					<label>
						Add Comment:
						<input type="text" bind:value={newComment} placeholder="Type your comment..." />
					</label>
					<button class="add-comment" on:click={addComment}>Add Comment</button>
				</div>
				<div class="modal-buttons">
					<button on:click={toggleEditMode} title="Edit Note">
						<svg class="edit-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5h6m2 2a2 2 0 012 2v6a2 2 0 01-2 2h-6a2 2 0 01-2-2v-6a2 2 0 012-2h6z" />
						</svg>
						Edit Note
					</button>
					<button on:click={closeNotesModal}>Close</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	:global(body) {
		font-family: 'Roboto', sans-serif;
		background-color: #F9FAFB;
		margin: 0;
		padding: 0;
		color: #333;
	}
	/* Remove spinner arrows in WebKit browsers */
input[type=number]::-webkit-outer-spin-button,
input[type=number]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.calc-info-container {
  position: relative;
  display: inline-block;
  margin-left: 4px;
}

.calc-info {
  display: inline-block;
  width: 16px;
  height: 16px;
  line-height: 16px;
  text-align: center;
  font-size: 0.75em;
  color: #fff;
  background-color: #004225;
  border-radius: 50%;
  cursor: help;
}

.calc-tooltip {
  visibility: hidden;
  position: absolute;
  bottom: 125%; /* Position above the icon */
  left: 50%;
  transform: translateX(-50%);
  background-color: #fff;
  color: #333;
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  white-space: nowrap;
  font-size: 0.75em;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.calc-info-container:hover .calc-tooltip {
  visibility: visible;
}
/* Remove spinner arrows in Firefox */
input[type=number] {
  -moz-appearance: textfield;
}
	/* Week Navigation */
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
	/* Card Container */
	.card {
		background-color: #fff;
		border-radius: 12px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
		margin: 24px;
		overflow: hidden;
	}
	/* Dashboard Container */
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
	th {
		font-weight: 600;
		font-size: 0.9em;
		letter-spacing: 0.03em;
	}
	/* Increase metric name column width and decrease font size */
	.metric-name,
	.metric-name-header {
		width: 200px;
		font-size: 0.8em;
		text-align: left;
		padding-left: 24px;
	}
	.small-header {
		width: 100px;
	}
	/* Header Rows with Subtle Gradient */
	.table-header {
		background: linear-gradient(180deg, #f5f7fa, #eaeef3);
	}
	.sub-header {
		background-color: #f9fafb;
		font-size: 0.71em;
		color: #555;
	}
	.cell-value {
		display: inline-block;
		width: 80px;
		padding: 8px;
		text-align: center;
		font-size: 0.95em;
		border: 1px solid #E5E7EB;
		border-radius: 6px;
		transition: border-color 0.2s ease;
		background-color: #fff;
	}
	input.cell-value {
		width: 80px;
		padding: 8px;
		border: 1px solid #E5E7EB;
		border-radius: 6px;
		font-size: 0.95em;
	}
	input.cell-value:focus {
		outline: none;
		border-color: #004225;
		box-shadow: 0 0 0 2px rgba(0, 66, 37, 0.2);
	}
	.prev-week-col em {
		font-weight: bold;
	}
	.computed-cell {
		background-color: #F5F7FA;
		cursor: pointer;
		position: relative;
	}
	.note-indicator {
		position: absolute;
		top: 4px;
		left: 4px;
		width: 0;
		height: 0;
		border-top: 8px solid #ff4d4f;
		border-right: 8px solid transparent;
	}
	.prev-total,
	.wow-change {
		font-style: italic;
		color: #6B7280;
		font-size: 0.9em;
	}
	/* Current Day Highlighting: Soft Blue Accent with vertical borders */
	.current-day {
		background-color: #DDEAFB;
		border-left: 2px solid #0056B3;
		border-right: 2px solid #0056B3;
	}
	/* Previous Week Total Highlight */
	.prev-week-col {
		background-color: rgba(0, 66, 37, 0.05);
		border-left: 1px solid #004225;
		border-right: 1px solid #004225;
	}
	/* Global Save Button */
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
	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}
	.modal-content {
		background: #fff;
		padding: 24px;
		border-radius: 12px;
		width: 90%;
		max-width: 600px;
		max-height: 80vh;
		overflow-y: auto;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}
	.modal-content h2 {
		margin-top: 0;
		font-size: 1.5em;
	}
	.modal-content label {
		display: block;
		margin: 12px 0 4px;
		font-size: 0.9em;
		color: #555;
	}
	.modal-content input[type="text"],
	.modal-content textarea {
		width: 100%;
		padding: 10px;
		font-size: 0.95em;
		border: 1px solid #E5E7EB;
		border-radius: 6px;
		margin-bottom: 12px;
	}
	.modal-content textarea {
		resize: vertical;
		min-height: 80px;
	}
	.modal-buttons {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
	}
	.modal-buttons button {
		background: #004225;
		border: none;
		color: #fff;
		padding: 8px 16px;
		font-size: 0.95em;
		cursor: pointer;
		border-radius: 6px;
		transition: background 0.2s ease;
	}
	.modal-buttons button:hover {
		background: #35b07b;
	}
	/* Comments Section */
	.comments-section {
		margin-top: 16px;
		font-size: 0.9em;
		color: #555;
	}
	.comments-section h3 {
		margin: 0 0 8px;
		font-size: 1em;
	}
	.comments-list {
		list-style: none;
		padding: 0;
		margin: 0 0 8px;
		max-height: 150px;
		overflow-y: auto;
		border: 1px solid #E5E7EB;
		border-radius: 6px;
	}
	.comments-list li {
		padding: 6px 12px;
		border-bottom: 1px solid #f0f0f0;
	}
	.comments-list li:last-child {
		border-bottom: none;
	}
	.add-comment {
		background: #004225;
		border: none;
		color: #fff;
		padding: 8px 16px;
		font-size: 0.9em;
		cursor: pointer;
		border-radius: 6px;
		transition: background 0.2s ease;
	}
	.add-comment:hover {
		background: #35b07b;
	}
</style>