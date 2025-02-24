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
		"shipments",       // Shipments Packed
		"hours_worked",    // Hours Worked
		null,              // Shipments Per Hour (computed)
		"defects",         // Defects
		null,              // Defects DPMO (computed)
		null               // Order Accuracy (%) (computed)
	];

	let weekOffset: number = 0;
	const msPerDay = 24 * 60 * 60 * 1000;
	let loading = false;

	// Variables for previous week totals and WoW change.
	let previousTotals: number[] = metrics.map(() => 0);
	let previousWeekDates: Date[] = [];

	// Variables for Notes Modal.
	let showNotesModal = false;
	let selectedMetricIndex: number = -1;
	// selectedDayIndex = -1 indicates the "Total" cell note.
	let selectedDayIndex: number = -1;
	let noteTitle = "";
	let noteRootCause = "";
	let noteDetails = "";
	let noteActionPlan = "";
	// New flag: if false, display in view mode; if true, show edit mode.
	let noteEditMode = false;
	// We'll also store comments for each note.
	let newComment = "";
	// notesMap keyed by "metricIndex-date" (for totals, key = `${metricIndex}-total`)
	type NoteData = {
		title: string;
		rootCause: string;
		details: string;
		actionPlan: string;
		comments: string[];
	};
	let notesMap: Record<string, NoteData> = {};

	// Helper: get the Monday for a given date.
	function getMonday(date: Date): Date {
		const d = new Date(date);
		const day = d.getDay();
		const diff = d.getDate() - day + (day === 0 ? -6 : 1);
		return new Date(d.setDate(diff));
	}

	// Helper: format a number to 2 decimal places only when needed.
	function formatNumber(num: number): string {
		return num % 1 === 0 ? num.toFixed(0) : num.toFixed(2);
	}

	// Helper: get the week number of the year (first week of January is week 1).
	function getWeekNumber(date: Date): number {
		const start = new Date(date.getFullYear(), 0, 1);
		// Calculate difference in days between date and January 1
		const diff = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
		return Math.ceil((diff + 1) / 7);
	}

	$: displayedMonday = (() => {
		const currentMonday = getMonday(new Date());
		return new Date(currentMonday.getTime() + weekOffset * 7 * msPerDay);
	})();

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

	async function saveMetricsForDate(dateStr: string, metricsData: any) {
		const { error } = await supabase
			.from("daily_metrics")
			.upsert({ date: dateStr, ...metricsData }, { onConflict: "date" });
		if (error) {
			console.error("Error saving metrics for date " + dateStr, error);
		}
	}

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

	async function loadPreviousWeekTotals() {
		let totals = metrics.map(() => 0);
		for (let i = 0; i < previousWeekDates.length; i++) {
			const dateStr = previousWeekDates[i].toISOString().split("T")[0];
			const data = await loadMetricsForDate(dateStr);
			if (data) {
				metricFields.forEach((field, idx) => {
					if (field !== null) {
						totals[idx] += data[field] ?? 0;
					}
				});
			}
		}
		previousTotals = totals;
	}

	$: currentTotals = metrics.map(metric =>
		metric.values.reduce((acc, v) => acc + v, 0)
	);

	$: wowChange = currentTotals.map((curr, idx) => {
		const prev = previousTotals[idx] ?? 0;
		if (prev === 0) return "N/A";
		const change = ((curr - prev) / prev) * 100;
		return change % 1 === 0 ? change.toFixed(0) + "%" : change.toFixed(2) + "%";
	});

	function getWowColor(changeStr: string): string {
		if (changeStr === "N/A") return "#6B7280";
		const num = parseFloat(changeStr);
		if (isNaN(num)) return "#6B7280";
		if (num > 0) return "#28a745"; // green
		if (num < 0) return "#dc3545"; // red
		return "#6B7280";
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
		if (metricIndex === 5) {
			const totalShipments = metrics[0].values.reduce((acc, v) => acc + v, 0);
			const totalDefects = metrics[3].values.reduce((acc, v) => acc + v, 0);
			const accuracy = totalShipments > 0 ? ((totalShipments - totalDefects) / totalShipments) * 100 : 0;
			return accuracy % 1 === 0 ? accuracy.toFixed(0) + "%" : accuracy.toFixed(2) + "%";
		} else {
			const total = metric.values.reduce((acc, num) => acc + (Number(num) || 0), 0);
			return total % 1 === 0 ? total.toFixed(0) : total.toFixed(2);
		}
	}

	// Only allow notes for total cells (dayIndex === -1).
	function openNotesModal(metricIndex: number, dayIndex: number) {
		selectedMetricIndex = metricIndex;
		selectedDayIndex = dayIndex; // -1 for total cell
		const key = dayIndex === -1 ? `${metricIndex}-total` : `${metricIndex}-${weekDates[dayIndex].toISOString().split("T")[0]}`;
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
		// If a note exists, start in view mode; else, edit mode.
		noteEditMode = notesMap[key] ? false : true;
		showNotesModal = true;
	}

	function closeNotesModal() {
		showNotesModal = false;
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

	// For adding a new comment.
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

<!-- Dashboard Table -->
<div class="dashboard-container">
	<table>
		<thead>
			<tr class="table-header">
				<th>Metrics</th>
				<th>Week {getWeekNumber(displayedMonday)}</th>
				{#each weekDates as date}
					<th class="small-header">
						{date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
					</th>
				{/each}
				<th>Total</th>
				<th>Prev Week</th>
				<th>WoW % Change</th>
			</tr>
			<tr class="table-header">
				<th></th>
				<th></th>
				{#each weekDates as date}
					<th>{date.toLocaleDateString(undefined, { weekday: "long" })}</th>
				{/each}
				<th></th>
				<th></th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each metrics as metric, metricIndex}
				<tr>
					<td>{metric.name}</td>
					<!-- Week column for week number is only in header -->
					{#each metric.values as value, dayIndex}
						<td>
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
									style="cursor: pointer;"
								>
									{formatNumber(value)}
									{#if notesMap[`${metricIndex}-${weekDates[dayIndex].toISOString().split("T")[0]}`]}
										<div class="note-indicator" role="presentation"></div>
									{/if}
								</span>
							{/if}
						</td>
					{/each}
					<!-- Total cell: clickable -->
					<td>
						<span
							role="button"
							tabindex="0"
							on:click={() => openNotesModal(metricIndex, -1)}
							on:keydown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNotesModal(metricIndex, -1); } }}
							style="cursor: pointer;"
						>
							<strong>{computeWeeklyTotal(metric, metricIndex)}</strong>
							{#if notesMap[`${metricIndex}-total`]}
								<div class="note-indicator" role="presentation"></div>
							{/if}
						</span>
					</td>
					<td>
						<em class="prev-total">
							{metricFields[metricIndex] !== null
								? previousTotals[metricIndex] % 1 === 0
									? previousTotals[metricIndex].toFixed(0)
									: previousTotals[metricIndex].toFixed(2)
								: '-'}
						</em>
					</td>
					<td style="color: {getWowColor(wowChange[metricIndex])};">
						<em class="wow-change">{wowChange[metricIndex]}</em>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<!-- Global Save Button -->
<div class="global-save-container">
	<button on:click={saveAllMetrics}>Save All Metrics</button>
</div>

<!-- Notes Modal -->
{#if showNotesModal}
	<div class="modal-overlay" on:click={closeNotesModal}>
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
				<!-- Comment Section -->
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
						<!-- Pen icon -->
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
		background-color: #f5f5f5;
		margin: 0;
		padding: 0;
	}

	/* Week Navigation styling */
	.week-navigation {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		margin-bottom: 16px;
		gap: 8px;
		padding: 0 24px;
	}

	.week-navigation button {
		background: #6c757d;
		border: none;
		color: white;
		padding: 6px 14px;
		font-size: 0.9em;
		font-weight: bold;
		cursor: pointer;
		border-radius: 4px;
		transition: background 0.2s ease;
	}

	.week-navigation button:hover {
		background: #5a6268;
	}

	.week-range {
		font-size: 0.9em;
		color: #555;
	}

	/* Table Header Styling */
	.table-header {
		background: #e2eaf2;
		color: #334a66;
	}

	.cell-value {
		display: inline-block;
		width: 80px;
		padding: 4px;
		text-align: center;
		font-family: inherit;
		font-size: 0.9em;
		border: 1px solid #ccc;
		border-radius: 4px;
	}

	input.cell-value:focus {
		outline: none;
		border-color: #007bff;
	}

	.computed-cell {
		border: none;
		background-color: #eaeaea;
		cursor: default;
		position: relative;
	}

	.note-indicator {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 0;
		height: 0;
		border-top: 8px solid red;
		border-right: 8px solid transparent;
	}

	.dashboard-container {
		width: 100%;
		overflow-x: auto;
		margin: 0;
		padding: 0;
	}

	table {
		width: 100%;
		min-width: 900px;
		border-collapse: collapse;
		margin: 0;
	}

	th,
	td {
		padding: 12px;
		text-align: center;
		border-bottom: 1px solid #ddd;
	}

	th {
		font-weight: bold;
	}

	tr:nth-child(even) {
		background: #f8f9fa;
	}

	.global-save-container {
		text-align: right;
		margin-top: 20px;
		padding: 0 24px;
	}

	.global-save-container button {
		background: #6c757d;
		border: none;
		color: white;
		padding: 6px 14px;
		font-size: 0.9em;
		font-weight: bold;
		cursor: pointer;
		border-radius: 4px;
		transition: background 0.2s ease;
	}

	.global-save-container button:hover {
		background: #5a6268;
	}

	input[type="number"] {
		width: 80px;
		padding: 4px;
		text-align: center;
		border: 1px solid #ccc;
		border-radius: 4px;
	}

	/* Styling for previous totals and WoW change columns */
	.prev-total, .wow-change {
		font-style: italic;
		color: #6B7280;
		font-size: 0.9em;
	}

	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0,0,0,0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal-content {
		background: #fff;
		padding: 24px;
		border-radius: 8px;
		width: 90%;
		max-width: 600px;
		max-height: 80vh;
		overflow-y: auto;
		box-shadow: 0 2px 10px rgba(0,0,0,0.1);
	}

	.modal-content h2 {
		margin-top: 0;
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
		padding: 8px;
		font-size: 0.9em;
		border: 1px solid #ccc;
		border-radius: 4px;
		margin-bottom: 8px;
	}

	.modal-content textarea {
		resize: vertical;
		min-height: 80px;
	}

	.modal-buttons {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	.modal-buttons button {
		background: #6c757d;
		border: none;
		color: white;
		padding: 6px 12px;
		font-size: 0.9em;
		cursor: pointer;
		border-radius: 4px;
		transition: background 0.2s ease;
	}

	.modal-buttons button:hover {
		background: #5a6268;
	}

	/* Additional styling for the comments section in view mode */
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
		border: 1px solid #ccc;
		border-radius: 4px;
	}

	.comments-list li {
		padding: 4px 8px;
		border-bottom: 1px solid #eee;
	}

	.comments-list li:last-child {
		border-bottom: none;
	}

	.add-comment {
		background: #6c757d;
		border: none;
		color: white;
		padding: 6px 12px;
		font-size: 0.9em;
		cursor: pointer;
		border-radius: 4px;
		transition: background 0.2s ease;
	}

	.add-comment:hover {
		background: #5a6268;
	}
</style>