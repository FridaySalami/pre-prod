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
  import { getWowColor } from "./utils";

  // Explicit prop declarations:
  export let name: string;
  export let values: number[];
  export let metricIndex: number;
  export let weekDates: Date[];
  export let currentDayIndex: number;
  export let isCurrentWeek: boolean;
  export let notesMap: Record<string, NoteData>;
  export let metricField: string | null;
  export let wowChange: string;

  // New props for totals:
  export let currentTotal: string;
  export let byThisTimeLastWeek: string;
  export let previousTotal: string;

  // Callback functions:
  export let handleInputChange: (metricIndex: number, dayIndex: number, newValue?: number) => void;
  export let openNotes: (metricIndex: number, dayIndex: number) => void;

  function getCalculationExplanation(): string {
    if (metricIndex === 2) {
      return "Shipments Packed ÷ Hours Worked";
    } else if (metricIndex === 4) {
      return "(Defects ÷ Shipments Packed) × 1,000,000";
    } else if (metricIndex === 5) {
      return "((Shipments Packed - Defects) ÷ Shipments Packed) × 100";
    }
    return "";
  }
</script>

<tr class="metric-row">
  <td class="metric-name">
    {name}
    {#if metricField === null}
      <div class="calc-info-container">
        <span class="calc-info">?</span>
        <div class="calc-tooltip">
          {getCalculationExplanation()}
        </div>
      </div>
    {/if}
  </td>

  {#each values as value, dayIndex}
    <td class:current-day={isCurrentWeek && dayIndex === currentDayIndex}>
      {#if metricField !== null}
        <div class="input-container">
          <input
            type="number"
            bind:value={values[dayIndex]}
            on:blur={() => handleInputChange(metricIndex, dayIndex, +values[dayIndex])}
            on:keydown={(e) => e.key === "Enter" && handleInputChange(metricIndex, dayIndex, +values[dayIndex])}
            class="cell-value"
          />
          <!-- Add flag button -->
        </div>
      {:else}
        <div class="value-container">
          <span
            role="button"
            tabindex="0"
            class="cell-value computed-cell"
            on:click={() => openNotes(metricIndex, dayIndex)}
            on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNotes(metricIndex, dayIndex); } }}
          >
            {value}
            {#if notesMap[`${metricIndex}-${weekDates[dayIndex].toISOString().split("T")[0]}`]}
              <div class="note-indicator" role="presentation"></div>
            {/if}
          </span>
          <!-- Add flag button -->
        </div>
      {/if}
    </td>
  {/each}

  <!-- Current Week Total cell -->
  <td class="totals-cell">
    <span
      role="button"
      tabindex="0"
      on:click={() => openNotes(metricIndex, -1)}
      on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNotes(metricIndex, -1); } }}
    >
      <strong>{currentTotal}</strong>
      {#if notesMap[`${metricIndex}-total`]}
        <div class="note-indicator" role="presentation"></div>
      {/if}
    </span>
  </td>

  <!-- By This Time Last Week cell -->
  <td class="totals-cell">
    <em>{byThisTimeLastWeek}</em>
  </td>

  <!-- WoW % Change cell -->
  <td class="totals-cell" style="color: {getWowColor(wowChange)};">
    <em class="wow-change">{wowChange}</em>
  </td>

  <!-- Previous Week Total cell -->
  <td class="totals-cell prev-week-col">
    <em>{previousTotal}</em>
  </td>
</tr>

<style>
  .metric-name {
    width: 160px; /* Reduced from 200px */
    font-size: 0.8em;
    text-align: left;
    padding-left: 16px; /* Reduced from 24px */
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
    bottom: 125%;
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
  .cell-value {
    display: block;
    margin: 0 auto;
    width: 60px; /* Reduced from 80px */
    padding: 6px; /* Reduced from 8px */
    text-align: center;
    font-size: 0.95em;
    border: 1px solid #E5E7EB;
    border-radius: 6px;
    background-color: #fff;
    transition: border-color 0.2s ease;
  }
  input.cell-value {
    display: block;
    margin: 0 auto;
    width: 60px; /* Reduced from 80px */
    padding: 6px; /* Reduced from 8px */
    border: 1px solid #E5E7EB;
    border-radius: 6px;
    font-size: 0.95em;
    text-align: center;
  }
  input.cell-value:focus {
    outline: none;
    border-color: #004225;
    box-shadow: 0 0 0 2px rgba(0, 66, 37, 0.2);
  }
  .computed-cell {
    display: block;
    margin: 0 auto;
    width: 60px; /* Reduced from 80px */
    padding: 6px; /* Reduced from 8px */
    text-align: center;
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
  .current-day {
    background-color: #DDEAFB;
    border-left: 2px solid #0056B3;
    border-right: 2px solid #0056B3;
  }
  .prev-week-col {
    background-color: rgba(0, 66, 37, 0.05);
  }
  td {
    border: 0.5px solid #ddd; /* Light border for all cells */
    padding: 8px 10px; /* Reduced from 10px 12px */
  }

  /* Center the content of totals cells */
  .totals-cell {
    text-align: center;
  }

  .metric-row {
    border-bottom: 1px solid #E5E7EB;
  }
  
  .metric-row:hover {
    background-color: #F9FAFB;
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
  
  .input-container, .value-container {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  
  input {
    width: 45px; /* Reduced from 50px */
    text-align: center;
    border: 1px solid #E5E7EB;
    border-radius: 4px;
    padding: 4px;
  }
  
  .current-day {
    background-color: rgba(53, 176, 123, 0.1);
  }
  
</style>