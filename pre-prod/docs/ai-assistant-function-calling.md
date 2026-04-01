# AI Assistant Function Calling Enhancement

## Overview

We've enhanced the AI assistant to support OpenAI's function calling capabilities, giving the AI access to powerful tools for analyzing dashboard data. Users can now toggle between "Basic AI" and "AI Pro" modes.

## Features

### Basic AI Mode
- Simple conversational AI that analyzes static data snapshots
- Good for general questions and insights
- Uses the existing `/api/chat` endpoint
- Lower cost per request

### AI Pro Mode (Function Calling)
- Advanced AI with access to analytical tools
- Can perform calculations, queries, and generate specific insights
- Uses the new `/api/assistant` endpoint
- More powerful but slightly higher cost

## Available Functions

### 1. Query Analytics Data
**Function**: `query_analytics_data`
- Filter data by date ranges
- Select specific sales channels (Amazon, eBay, Shopify)
- Calculate summary statistics
- **Example**: "Show me data for the first week only"

### 2. Calculate Growth Rate
**Function**: `calculate_growth_rate`
- Compare metrics between time periods
- Calculate percentage growth/decline
- Identify trends (increasing/decreasing/stable)
- **Example**: "Calculate the growth rate for total sales this month"

### 3. Generate Performance Insights
**Function**: `generate_performance_insight`
- Overall performance summary
- Channel breakdown analysis
- Efficiency analysis
- Trend analysis
- **Example**: "Generate an overall performance summary"

## User Experience

### Toggle Switch
- Located in the chat header
- Switch between "Basic" and "Pro" modes
- Changes available quick questions
- Updates AI behavior immediately

### Function Call Indicators
- AI Pro responses show which tools were used
- Visual indicators for successful/failed function calls
- Timestamp shows "AI Pro" label for enhanced responses

### Enhanced Quick Questions
**Basic Mode Questions:**
- "What are the key trends in this month's data?"
- "Which sales channel is performing best?"
- "Are there any concerning patterns I should know about?"
- "What recommendations do you have for improvement?"

**AI Pro Mode Questions:**
- "Calculate the growth rate for total sales this month"
- "Show me a breakdown of performance by channel"
- "Generate an overall performance summary"
- "Analyze the sales trend over the first and second half of the month"
- "Query the data for the first week only"
- "What insights do you have about labor efficiency?"

## Technical Implementation

### API Endpoints

#### `/api/chat` (Basic AI)
```typescript
POST /api/chat
{
  "message": "What are the key trends?",
  "analyticsData": { ... }
}
```

#### `/api/assistant` (AI Pro with Function Calling)
```typescript
POST /api/assistant
{
  "message": "Calculate growth rate for sales",
  "analyticsData": { ... }
}
```

### Response Format

#### Basic Response
```typescript
{
  "response": "Based on the data, I can see...",
  "usage": { ... }
}
```

#### Enhanced Response with Function Calls
```typescript
{
  "response": "I've analyzed your data using my tools...",
  "functionCalls": [
    {
      "name": "calculate_growth_rate",
      "result": {
        "growthRate": "15.2%",
        "trend": "increasing"
      }
    }
  ],
  "usage": { ... }
}
```

## Benefits for Users

### More Accurate Analysis
- AI can perform actual calculations instead of guessing
- Access to precise data filtering and aggregation
- Real-time metric calculations

### Contextual Insights
- Functions provide structured data the AI can reason about
- More specific and actionable recommendations
- Better understanding of business metrics

### Interactive Analysis
- Users can ask for specific calculations
- AI can drill down into particular aspects of the data
- Dynamic querying based on conversation flow

## Cost Considerations

- AI Pro mode uses slightly more tokens due to function calling overhead
- Function execution is efficient and cached where possible
- Cost increase is minimal compared to value provided
- Users can switch to Basic mode for simple questions

## Future Enhancements

### Planned Function Additions
1. **Export Data** - Generate CSV/Excel exports
2. **Update Dashboard Filters** - Actually modify dashboard state
3. **Historical Comparisons** - Compare with previous periods
4. **Anomaly Detection** - Identify unusual patterns
5. **Forecasting** - Predict future trends

### Integration Possibilities
1. **Database Queries** - Direct database access for historical data
2. **External APIs** - Weather, economic indicators, competitor data
3. **Machine Learning** - Advanced pattern recognition
4. **Automated Reporting** - Generate scheduled reports

## Usage Examples

### Example 1: Growth Analysis
**User**: "Calculate the growth rate for total sales this month"
**AI Pro**: 
1. Calls `calculate_growth_rate` function
2. Compares current month to previous month (simulated)
3. Returns: "Based on my calculation, your total sales have grown by 15.2% compared to last month, showing an increasing trend."

### Example 2: Channel Performance
**User**: "Show me a breakdown of performance by channel"
**AI Pro**:
1. Calls `generate_performance_insight` with `focusArea: "channels"`
2. Analyzes channel distribution
3. Returns: "Here's your channel breakdown: Amazon represents 45.2% of sales (£12,450), eBay 32.1% (£8,890), and Shopify 22.7% (£6,230)."

### Example 3: Data Filtering
**User**: "Query the data for the first week only"
**AI Pro**:
1. Calls `query_analytics_data` with appropriate date range
2. Filters and aggregates data
3. Returns: "For the first week, you had 7 days of data with total sales of £5,280, 180 orders, and an average labor efficiency of 12.3 shipments/hour."

This enhancement significantly improves the AI assistant's capabilities while maintaining ease of use and cost efficiency.
