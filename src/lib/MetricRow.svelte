<script context="module" lang="ts">
	export type Metric = {
		name: string;
		values: number[];
	};

	export type NoteData = {
		title: string;
		rootCause: string;
		details: string;
		actionPlan: string;
		comments: string[];
	};
</script>

<script lang="ts">
	import { formatNumber, formatPercentage, getWowColor } from '$lib/utils';

	// Explicit prop declarations:
	export let name = '';
	export let values: number[] = [];
	export let previousTotal = 0;
	export let isHeader = false;
	export let isSpacer = false;
	export let isReadOnly = false;
	export let tooltip = '';
	export let currentDayIndex = -1;
	export let isCurrentWeek = true;
	export let isPercentage = false; // New prop to indicate if this is a percentage metric
	export let isCurrency = false; // New prop to indicate if this is a currency metric

	export let metricIndex: number;
	export let wowChange: string;

	// Change these types from string to number:
	export let currentTotal: number; // Changed from string
	export let byThisTimeLastWeek: number; // Changed from string

	// Function to format currency values
	function formatCurrency(value: number): string {
		return new Intl.NumberFormat('en-GB', {
			style: 'currency',
			currency: 'GBP',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(value);
	}

	// Callback functions:
	export let handleInputChange: (metricIndex: number, dayIndex: number, newValue?: number) => void;

	// Add this function to check if a metric is editable
	function isEditableMetric(name: string): boolean {
		return (
			name === '1.1 Shipments Packed' ||
			name === '1.3 Actual Hours Worked' ||
			name === '1.6 Packing Errors'
		);
	}
</script>

<tr class="metric-row">
	<td class="metric-name">
		{name}
		{#if tooltip}
			<span class="tooltip-container">
				<span class="info-icon">?</span>
				<span class="tooltip-text">{tooltip}</span>
			</span>
		{/if}
	</td>

	<!-- Daily values rendering -->
	{#each values as value, dayIndex}
		<td
			class:highlight={isCurrentWeek && dayIndex === currentDayIndex}
			class:highlight-column={isCurrentWeek && dayIndex === currentDayIndex}
			class:text-right={!isHeader && !isSpacer}
		>
			{#if isHeader}
				<strong>{value}</strong>
			{:else if isSpacer}
				<!-- Spacer formatting -->
			{:else if isEditableMetric(name) && !isReadOnly}
				<!-- Editable input for metrics 1.1, 1.3, and 1.6 -->
				<input
					type="number"
					class="metric-input"
					{value}
					on:change={(e) => {
						const target = e.target as HTMLInputElement;
						handleInputChange(metricIndex, dayIndex, parseFloat(target.value));
					}}
					min="0"
					step={name === '1.3 Actual Hours Worked' ? '0.25' : '1'}
				/>
				<!-- Add notes icon -->
			{:else if isPercentage}
				{formatPercentage(value)}
			{:else if isCurrency}
				{formatCurrency(value)}
			{:else}
				{formatNumber(value)}
			{/if}
		</td>
	{/each}

	<!-- Current Week Total cell -->
	<td class="text-right">
		{#if isHeader || isSpacer}
			<!-- Empty header or spacer -->
		{:else if isPercentage}
			{formatPercentage(currentTotal)}
		{:else if isCurrency}
			{formatCurrency(currentTotal)}
		{:else}
			{formatNumber(currentTotal)}
		{/if}
	</td>

	<!-- By This Time Last Week cell -->
	<td class="text-right">
		{#if isHeader || isSpacer}
			<!-- Empty header or spacer -->
		{:else if isPercentage}
			{formatPercentage(byThisTimeLastWeek)}
		{:else if isCurrency}
			{formatCurrency(byThisTimeLastWeek)}
		{:else}
			{formatNumber(byThisTimeLastWeek)}
		{/if}
	</td>

	<!-- WoW % Change cell -->
	<td class="totals-cell" style="color: {getWowColor(wowChange)};">
		<em class="wow-change">{wowChange}</em>
	</td>

	<!-- Previous Week Total cell -->
	<td class="text-right">
		{#if isHeader || isSpacer}
			<!-- Empty header or spacer -->
		{:else if isPercentage}
			{formatPercentage(previousTotal)}
		{:else if isCurrency}
			{formatCurrency(previousTotal)}
		{:else}
			{formatNumber(previousTotal)}
		{/if}
	</td>
</tr>

<style>
	.metric-name {
		width: 160px; /* Reduced from 200px */
		font-size: 0.8em;
		text-align: left;
		padding-left: 16px; /* Reduced from 24px */
	}
	td {
		border: 0.5px solid #ddd; /* Light border for all cells */
		padding: 8px 10px; /* Reduced from 10px 12px */
		position: relative; /* Added to ensure position relative works properly */
	}

	/* Center the content of totals cells */
	.totals-cell {
		text-align: center;
	}

	.metric-row {
		border-bottom: 1px solid #e5e7eb;
	}

	.metric-row:hover {
		background-color: #f9fafb;
	}

	td {
		padding: 8px 10px; /* Reduced from 10px 12px */
		text-align: center;
		font-size: 0.9em;
	}

	td:first-child {
		text-align: left;
		font-weight: 500;
	}

	.tooltip-container {
		position: relative;
		display: inline-block;
		margin-left: 5px;
	}

	.info-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background-color: #e0e0e0;
		color: #555;
		font-size: 0.7em;
		font-weight: bold;
		cursor: help;
	}

	.tooltip-text {
		visibility: hidden;
		width: 250px;
		background-color: #333;
		color: #fff;
		text-align: left;
		border-radius: 6px;
		padding: 8px 10px;
		position: absolute;
		z-index: 1;
		bottom: 125%;
		left: 50%;
		transform: translateX(-50%);
		opacity: 0;
		transition: opacity 0.3s;
		font-weight: normal;
		font-size: 0.85em;
		line-height: 1.4;
		pointer-events: none;
	}

	.tooltip-text::after {
		content: '';
		position: absolute;
		top: 100%;
		left: 50%;
		margin-left: -5px;
		border-width: 5px;
		border-style: solid;
		border-color: #333 transparent transparent transparent;
	}

	.tooltip-container:hover .tooltip-text {
		visibility: visible;
		opacity: 1;
	}

	.metric-input {
		width: 60px;
		text-align: right;
		border: 1px solid #ccc;
		border-radius: 3px;
		padding: 4px;
		font-size: 0.9em;
	}

	.metric-input:focus {
		outline: none;
		border-color: #4f46e5;
		box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2);
	}

	.metric-input:disabled {
		background-color: #f3f4f6;
		cursor: not-allowed;
	}

	.text-right {
		text-align: right;
	}

	.highlight {
		background-color: rgba(53, 176, 123, 0.08); /* Subtle green background */
		position: relative;
	}

	/* Add vertical borders with pseudo-elements */
	.highlight::before,
	.highlight::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		background-color: #35b07b; /* Solid green line */
		z-index: 1; /* Ensure lines appear above other content */
	}

	.highlight::before {
		left: 0;
	}

	.highlight::after {
		right: 0;
	}

	/* Make sure highlighting is visible above cell borders */
	.metric-row td.highlight {
		border-left-color: transparent;
		border-right-color: transparent;
	}

	/* Add this class for the highlight-column approach if you prefer that */
	.highlight-column {
		background-color: rgba(53, 176, 123, 0.08);
		position: relative;
	}

	.highlight-column::before,
	.highlight-column::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		background-color: #35b07b;
		z-index: 1;
	}

	.highlight-column::before {
		left: 0;
	}

	.highlight-column::after {
		right: 0;
	}
</style>
