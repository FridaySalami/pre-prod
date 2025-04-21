export function getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }
  
  export function formatNumber(value: number | string): string {
    if (value === null || value === undefined || isNaN(Number(value))) return '0';
    
    // Convert to number if it's a string
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    // Return the formatted number
    if (numValue % 1 !== 0) {
      // Handle decimal numbers - round to 2 decimal places
      return numValue.toFixed(2);
    } else {
      // Handle integers - don't show decimal places
      return numValue.toString();
    }
  }
  
  // Add a specific formatter for percentage values
  export function formatPercentage(value: number): string {
    if (value === null || value === undefined || isNaN(value)) return '0%';
    return `${value.toFixed(2)}%`;
  }
  
  export function getWeekNumber(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 1);
    const diff = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.ceil((diff + 1) / 7);
  }
  
  export function isToday(date: Date): boolean {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate();
  }
  
  export function getWowColor(changeStr: string): string {
    if (changeStr === "N/A") return "#6B7280";
    const num = parseFloat(changeStr);
    if (isNaN(num)) return "#6B7280";
    if (num > 0) return "#28a745";
    if (num < 0) return "#dc3545";
    return "#6B7280";
  }