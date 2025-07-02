# Analytics Dashboard Documentation

## Overview

The Analytics Dashboard is a comprehensive business intelligence system that provides real-time insights into sales performance, order metrics, and operational efficiency. It serves as the central hub for data-driven decision making across the organization.

## Key Features

### 1. Multi-Tab Interface
- **Daily Products**: Detailed order analysis with SKU-level filtering
- **Daily Sales**: Performance metrics across all sales channels
- **Monthly Dashboard**: Comprehensive monthly analytics and trends
- **Overview**: High-level business summary (future implementation)
- **Duplicated Daily Products**: Quality control for product data

### 2. Sales Performance Tracking
- **Multi-Channel Sales**: Amazon, eBay, Shopify, and other platforms
- **Real-time Metrics**: Total sales, order count, average order value
- **Profit Analysis**: Profit margins and efficiency calculations
- **Historical Comparisons**: Trend analysis and pattern recognition

### 3. Advanced Analytics
- **Interactive Charts**: Visual representation of sales trends
- **Historical Data**: Long-term performance analysis
- **Significance Analysis**: Statistical significance testing
- **Predictive Insights**: Trend forecasting and predictions

## Technical Architecture

### Main Analytics Page
**File**: `/src/routes/analytics/+page.svelte`

```svelte
<script lang="ts">
  // Core imports
  import { userSession } from '$lib/sessionStore';
  import OrdersList from '$lib/OrdersList.svelte';
  import DuplicatedDailyProducts from '$lib/DuplicatedDailyProducts.svelte';
  
  // State management
  let selectedTab = 'daily';
  let dailyOrders: ProcessedOrder[] = [];
  let dailySalesData: any[] = [];
  let salesSummary: any = {};
  
  // Loading and error states
  let isLoading = false;
  let isSalesLoading = false;
  let error: string | null = null;
  let salesError: string | null = null;
</script>
```

### Monthly Dashboard
**File**: `/src/routes/analytics/monthly/+page.svelte`

```svelte
<script lang="ts">
  // Advanced analytics imports
  import MonthlyChart from '$lib/shadcn/components/ui/MonthlyChart.svelte';
  import MetricsDashboardChart from '$lib/MetricsDashboardChart.svelte';
  import HistoricalLineChart from '$lib/components/HistoricalLineChart.svelte';
  import { HistoricalDataService } from '$lib/services/historicalDataService';
  
  // State management
  let selectedYear = $state(data.selectedYear);
  let selectedMonth = $state(data.selectedMonth);
  let monthlyData = $state(data.monthlyData);
  let dailyData: DailyData[] = $state(data.dailyData);
  
  // Historical analysis
  let displayMode: MetricDisplayMode = $state('historical-weekly');
  let historicalConfig: WeekdayHistoricalConfig = $state({
    selectedMetric: 'total_sales',
    selectedWeekday: 'monday',
    historicalCount: 12,
    showTrend: true,
    showAverage: true
  });
</script>
```

## Data Sources & APIs

### 1. Daily Orders API
**Endpoint**: `/api/linnworks/daily-orders`

```typescript
// Query parameters
interface DailyOrdersQuery {
  startDate: string;    // YYYY-MM-DD
  endDate: string;      // YYYY-MM-DD
  sku?: string;         // Optional SKU filter
}

// Response format
interface ProcessedOrder {
  nOrderId: number;
  Source: string;
  OrderId?: string;
  Items?: OrderItem[];
  fTotalCharge?: number;
  fPostageCost?: number;
  Status?: number;
  PostalServiceName?: string;
}
```

### 2. Financial Data API
**Endpoint**: `/api/linnworks/financialData`

```typescript
// Query parameters
interface FinancialDataQuery {
  startDate: string;
  endDate: string;
}

// Response format
interface FinancialResponse {
  dailyData: DailyFinancialData[];
  summary: FinancialSummary;
}

interface DailyFinancialData {
  date: string;
  salesData: {
    amazonSales: number;
    ebaySales: number;
    shopifySales: number;
    otherSales: number;
    totalSales: number;
    orderCount: number;
    averageOrderValue: number;
    totalProfit: number;
  };
}
```

### 3. Daily Metric Review API
**Endpoint**: `/api/daily-metric-review/update`

```typescript
// Request body
interface MetricUpdateRequest {
  dailySalesData: DailyFinancialData[];
}

// Response format
interface MetricUpdateResponse {
  success: boolean;
  message?: string;
  error?: string;
  results?: {
    errors?: any[];
  };
}
```

## User Interface Components

### 1. Tab Navigation
```svelte
<div class="tabs">
  <button
    class="tab-button"
    class:active={selectedTab === 'daily'}
    on:click={() => (selectedTab = 'daily')}
  >
    Daily Products
  </button>
  <!-- Additional tabs... -->
</div>
```

### 2. Date Range Controls
```svelte
<div class="date-range">
  <div class="date-input">
    <label for="start-date">From:</label>
    <input
      id="start-date"
      type="date"
      bind:value={startDate}
      on:change={handleDateChange}
      max={new Date().toISOString().split('T')[0]}
    />
  </div>
  <div class="date-input">
    <label for="end-date">To:</label>
    <input
      id="end-date"
      type="date"
      bind:value={endDate}
      min={startDate}
      on:change={handleDateChange}
      max={new Date().toISOString().split('T')[0]}
    />
  </div>
</div>
```

### 3. Search Functionality
```svelte
<form class="search-form" on:submit={handleSearch}>
  <div class="search-input">
    <label for="sku-search">Search SKU:</label>
    <input
      id="sku-search"
      type="text"
      bind:value={searchSku}
      placeholder="Enter SKU to search..."
    />
  </div>
  <div class="search-actions">
    <button type="submit" class="search-button" disabled={!searchSku || isLoading}>
      {isLoading ? 'Searching...' : 'Search'}
    </button>
    {#if searchSku}
      <button type="button" class="clear-button" on:click={clearSearch}>
        Clear
      </button>
    {/if}
  </div>
</form>
```

### 4. Summary Cards
```svelte
<div class="summary-cards">
  <div class="summary-card">
    <h3>Total Sales</h3>
    <p class="amount">{formatCurrency(salesSummary.totalSales || 0)}</p>
  </div>
  <div class="summary-card">
    <h3>Total Orders</h3>
    <p class="amount">{salesSummary.totalOrders || 0}</p>
  </div>
  <div class="summary-card">
    <h3>Avg Order Value</h3>
    <p class="amount">{formatCurrency(salesSummary.averageOrderValue || 0)}</p>
  </div>
  <div class="summary-card">
    <h3>Total Profit</h3>
    <p class="amount">{formatCurrency(salesSummary.totalProfit || 0)}</p>
  </div>
</div>
```

### 5. Data Tables
```svelte
<table class="sales-table">
  <thead>
    <tr>
      <th>Date</th>
      <th>Amazon</th>
      <th>eBay</th>
      <th>Shopify</th>
      <th>Other</th>
      <th>Total Sales</th>
      <th>Orders</th>
      <th>Avg Order</th>
      <th>Profit</th>
    </tr>
  </thead>
  <tbody>
    {#each dailySalesData as dayData}
      <tr>
        <td class="date-cell">{formatDate(dayData.date)}</td>
        <td class="amount-cell">{formatCurrency(dayData.salesData.amazonSales || 0)}</td>
        <td class="amount-cell">{formatCurrency(dayData.salesData.ebaySales || 0)}</td>
        <td class="amount-cell">{formatCurrency(dayData.salesData.shopifySales || 0)}</td>
        <td class="amount-cell">{formatCurrency(dayData.salesData.otherSales || 0)}</td>
        <td class="amount-cell total">{formatCurrency(dayData.salesData.totalSales || 0)}</td>
        <td class="number-cell">{dayData.salesData.orderCount || 0}</td>
        <td class="amount-cell">{formatCurrency(dayData.salesData.averageOrderValue || 0)}</td>
        <td class="amount-cell profit">{formatCurrency(dayData.salesData.totalProfit || 0)}</td>
      </tr>
    {/each}
  </tbody>
</table>
```

## Core Functions

### 1. Data Fetching
```typescript
async function fetchDailyOrders(start: string, end: string, sku?: string) {
  isLoading = true;
  error = null;
  try {
    const params = new URLSearchParams({
      startDate: start,
      endDate: end
    });
    if (sku) {
      params.append('sku', sku);
    }

    const response = await fetch(`/api/linnworks/daily-orders?${params}`);
    if (!response.ok) {
      throw new Error(`API Error ${response.status}: ${await response.text()}`);
    }
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch orders');
    }
    dailyOrders = data.orders || [];
  } catch (err) {
    console.error('Error fetching daily orders:', err);
    error = err instanceof Error ? err.message : String(err);
  } finally {
    isLoading = false;
  }
}

async function fetchDailySalesData(month: string) {
  isSalesLoading = true;
  salesError = null;
  try {
    const startOfMonth = new Date(month + '-01');
    const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);

    const params = new URLSearchParams({
      startDate: startOfMonth.toISOString().split('T')[0],
      endDate: endOfMonth.toISOString().split('T')[0]
    });

    const response = await fetch(`/api/linnworks/financialData?${params}`);
    if (!response.ok) {
      throw new Error(`API Error ${response.status}: ${await response.text()}`);
    }
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }

    dailySalesData = data.dailyData || [];
    salesSummary = data.summary || {};
  } catch (err) {
    console.error('Error fetching daily sales data:', err);
    salesError = err instanceof Error ? err.message : String(err);
  } finally {
    isSalesLoading = false;
  }
}
```

### 2. Data Processing
```typescript
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

function handleDateChange() {
  if (new Date(endDate) < new Date(startDate)) {
    endDate = startDate;
  }
  fetchDailyOrders(startDate, endDate, searchSku);
}
```

### 3. Metric Updates
```typescript
async function updateDailyMetricReview() {
  if (!dailySalesData || dailySalesData.length === 0) {
    updateMessage = 'No sales data available to update';
    setTimeout(() => (updateMessage = null), 3000);
    return;
  }

  console.log('🚀 Starting daily metric review update');
  isUpdatingMetrics = true;
  updateMessage = null;

  try {
    const requestBody = {
      dailySalesData
    };

    const response = await fetch('/api/daily-metric-review/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();

    if (result.success) {
      updateMessage = `✅ ${result.message}`;
    } else {
      let errorMessage = 'Unknown error';
      if (typeof result.error === 'string') {
        errorMessage = result.error;
      } else if (result.error && typeof result.error === 'object') {
        errorMessage = JSON.stringify(result.error);
      }
      updateMessage = `❌ Update failed: ${errorMessage}`;
    }
  } catch (error) {
    console.error('❌ Error updating daily metric review:', error);
    updateMessage = `❌ Error: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    isUpdatingMetrics = false;
    setTimeout(() => (updateMessage = null), 5000);
  }
}
```

## Advanced Features

### 1. Historical Data Analysis
The monthly dashboard includes sophisticated historical analysis capabilities:

```typescript
interface HistoricalDataResponse {
  currentPeriodData: any[];
  historicalData: any[];
  statistics: {
    average: number;
    trend: 'up' | 'down' | 'stable';
    significance: number;
  };
}
```

### 2. Chart Components
- **MonthlyChart**: Monthly performance visualization
- **MetricsDashboardChart**: Real-time metrics display
- **HistoricalLineChart**: Historical trend analysis
- **WeeklyLineChart**: Weekly performance patterns

### 3. Significance Testing
Statistical analysis to determine if trends are significant:

```typescript
interface SignificanceAnalysis {
  isSignificant: boolean;
  pValue: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
}
```

## State Management

### Reactive State Variables
- `selectedTab`: Current active tab
- `startDate`/`endDate`: Date range selection
- `searchSku`: SKU filter value
- `dailyOrders`: Order data for daily view
- `dailySalesData`: Sales data for analysis
- `salesSummary`: Aggregated sales metrics
- `isLoading`/`isSalesLoading`: Loading states
- `error`/`salesError`: Error messages

### Monthly Dashboard State
- `selectedYear`/`selectedMonth`: Time period selection
- `monthlyData`: Aggregated monthly metrics
- `dailyData`: Day-by-day breakdown
- `displayMode`: Analysis mode (historical/weekly)
- `historicalConfig`: Historical analysis settings
- `sortColumn`/`sortDirection`: Table sorting state

## Dependencies

### External Libraries
- **Svelte/SvelteKit**: Framework and routing
- **Supabase**: Database and authentication
- **Shadcn/UI**: UI component library
- **Chart.js**: Data visualization
- **D3.js**: Advanced charting (via components)

### Internal Dependencies
- **`$lib/sessionStore`**: Authentication management
- **`$lib/OrdersList.svelte`**: Order display component
- **`$lib/DuplicatedDailyProducts.svelte`**: Quality control component
- **`$lib/MetricsDashboardChart.svelte`**: Metrics visualization
- **`$lib/services/historicalDataService`**: Historical data processing
- **Various chart components**: Advanced visualizations

## Error Handling

### API Error Handling
```typescript
try {
  const response = await fetch('/api/endpoint');
  if (!response.ok) {
    throw new Error(`API Error ${response.status}: ${await response.text()}`);
  }
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Operation failed');
  }
} catch (err) {
  console.error('Operation failed:', err);
  error = err instanceof Error ? err.message : String(err);
}
```

### User Feedback
- Loading states with spinners
- Error messages with specific details
- Success confirmations with auto-dismiss
- Validation warnings for invalid inputs

## Performance Optimizations

### Data Loading
- Lazy loading of tab content
- Cached API responses where appropriate
- Debounced search inputs
- Efficient date range validation

### Rendering
- Conditional rendering based on tab selection
- Virtualized tables for large datasets
- Optimized chart rendering
- Skeleton loading states

## Security Considerations

### Authentication
- Session-based authentication required
- Automatic redirect to login if unauthenticated
- Role-based access control (future enhancement)

### Data Protection
- Parameterized API queries
- Input validation and sanitization
- Error message sanitization
- Rate limiting on API endpoints

## Styling & UX

### Visual Design
- Clean, professional interface
- Consistent color scheme
- Responsive design for all screen sizes
- Accessible color contrasts

### User Experience
- Intuitive tab navigation
- Clear loading indicators
- Informative error messages
- Keyboard navigation support

### Data Presentation
- Currency formatting for financial data
- Date formatting for readability
- Color-coded metrics (profit, loss, etc.)
- Sortable tables with visual indicators

## Maintenance Guide

### Adding New Metrics
1. Define the metric in the API response types
2. Add to the data fetching functions
3. Update the UI components to display the metric
4. Add to historical analysis if needed

### Adding New Charts
1. Create the chart component in `$lib/components/`
2. Import and use in the appropriate tab
3. Ensure responsive design
4. Add to the monthly dashboard if relevant

### Updating APIs
1. Update the API endpoint handlers
2. Modify the interface definitions
3. Update error handling
4. Test with existing UI components

### Performance Monitoring
1. Monitor API response times
2. Track chart rendering performance
3. Monitor memory usage with large datasets
4. Optimize queries if needed

## Troubleshooting Common Issues

### Data Not Loading
- Check network connectivity
- Verify API endpoint availability
- Check authentication status
- Review browser console for errors

### Charts Not Rendering
- Verify chart data format
- Check for JavaScript errors
- Ensure chart libraries are loaded
- Validate data types

### Performance Issues
- Check for memory leaks in chart components
- Monitor API response sizes
- Optimize database queries
- Consider data pagination

## Future Enhancements

### Planned Features
1. **Real-time Data**: Live updates via WebSockets
2. **Custom Dashboards**: User-configurable layouts
3. **Advanced Filtering**: Multi-dimensional data filtering
4. **Export Functionality**: PDF/Excel export of reports
5. **Predictive Analytics**: Machine learning insights
6. **Mobile App**: Native mobile analytics app

### Technical Improvements
1. **Caching Strategy**: Redis-based caching
2. **Data Streaming**: Incremental data loading
3. **Offline Support**: Service worker implementation
4. **Advanced Charting**: More visualization types
5. **Performance Monitoring**: Built-in analytics
6. **A/B Testing**: Feature flag system
