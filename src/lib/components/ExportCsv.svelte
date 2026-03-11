<script lang="ts">
  import { onMount } from "svelte";
  
  // Props for the component
  export let metrics: Array<{
    name: string;
    values: number[];
    metricField: string | null;
    isHeader?: boolean;
    isSpacer?: boolean;
  }>;
  export let weekDates: Date[] = [];
  export let currentTotals: number[] = [];
  export let previousTotals: number[] = [];
  export let weekNumber: number;
  export let fileName: string = "metrics-export";
  export let buttonText: string = "Export CSV";
  export let includeHeaders: boolean = true;
  // Add a new prop for computed metrics
  export let computedMetrics: number[][] = [];
  
  // Create a nicely formatted date range string for the filename
  $: dateRangeStr = weekDates.length > 0 ? 
    `${formatDateForFileName(weekDates[0])}_to_${formatDateForFileName(weekDates[weekDates.length - 1])}` : 
    '';
  
  // Format the full filename with dates
  $: fullFileName = `${fileName}_week${weekNumber}_${dateRangeStr}.csv`;
  
  function formatDateForFileName(date: Date): string {
    return date.toISOString().split('T')[0];
  }
  
  // Function to convert a value to CSV-safe string
  function escapeCsvValue(value: any): string {
    if (value === null || value === undefined) return '';
    
    const stringValue = String(value);
    
    // If the value contains commas, quotes, or newlines, wrap it in quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      // Double up any quotes to escape them
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  }
  
  // Function to generate CSV content
  function generateCsv(): string {
    let csvContent = '';
    
    // Add the header row with dates
    if (includeHeaders) {
      const headers = [
        'Metric',
        ...weekDates.map(date => date.toLocaleDateString()),
        'Current Week Total',
        'Previous Week Total'
      ];
      csvContent += headers.map(escapeCsvValue).join(',') + '\n';
    }
    
    // Add data rows
    metrics.forEach((metric, index) => {
      if (metric.isHeader) {
        // Add a section header row
        csvContent += `\n${escapeCsvValue(metric.name)}\n`;
      } else if (metric.isSpacer) {
        // Add an empty row for spacing
        csvContent += '\n';
      } else {
        // For calculated metrics, use computedMetrics array; otherwise, use the basic values
        const values = metric.metricField === null && computedMetrics[index]
          ? computedMetrics[index]
          : metric.values;
          
        // Add a regular metric row
        const row = [
          metric.name,
          ...values.map(value => value.toString()),
          currentTotals[index]?.toString() || '',
          previousTotals[index]?.toString() || ''
        ];
        csvContent += row.map(escapeCsvValue).join(',') + '\n';
      }
    });
    
    return csvContent;
  }
  
  // Function to download the CSV
  function downloadCsv() {
    const csvContent = generateCsv();
    
    // Create a Blob with the CSV content
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create a download link
    const link = document.createElement('a');
    
    // Create a URL for the Blob
    const url = URL.createObjectURL(blob);
    
    // Set link properties
    link.setAttribute('href', url);
    link.setAttribute('download', fullFileName);
    link.style.visibility = 'hidden';
    
    // Add to document, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL object
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  }
</script>

<!-- Simple text link instead of a styled button -->
<span 
  class="export-link" 
  on:click={downloadCsv}
  role="button"
  tabindex="0"
  on:keydown={(e) => e.key === 'Enter' && downloadCsv()}
>
  {buttonText}
</span>

<style>
  .export-link {
    color: #4a6da7;
    font-weight: 500;
    cursor: pointer;
    text-decoration: underline;
    user-select: none;
  }
  
  .export-link:hover {
    color: #3a5d97;
  }
  
  .export-link:active {
    color: #2a4d87;
  }
</style>