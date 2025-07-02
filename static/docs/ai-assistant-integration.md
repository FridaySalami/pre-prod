# AI Data Analysis Assistant Integration

This document outlines the ChatGPT-powered AI assistant integration for the analytics dashboard.

## Features

The AI assistant provides:
- **Data Analysis**: Automatically analyzes current analytics data including sales, orders, and efficiency metrics
- **Trend Identification**: Identifies patterns and trends in your business data
- **Actionable Insights**: Provides specific recommendations for business improvement  
- **Interactive Chat**: Natural language conversation interface for asking specific questions
- **Context Awareness**: Uses current dashboard data for relevant, timely responses

## Setup

### 1. Install Dependencies
```bash
npm install openai
```

### 2. OpenAI API Configuration
1. Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Add the key to your `.env` file:
```
OPENAI_API_KEY=your_api_key_here
```

### 3. Usage
- Click the "AI Assistant" button in the dashboard header
- Or use the floating action button in the bottom-right corner
- The assistant will have access to all current analytics data displayed on the page

## API Endpoint

### POST `/api/chat`
Processes chat messages and returns AI responses with analytics context.

**Request Body:**
```json
{
  "message": "What are the key trends in this data?",
  "analyticsData": {
    "monthlyMetrics": [...],
    "dailyData": [...],
    "selectedPeriod": {...},
    "summary": {...}
  }
}
```

**Response:**
```json
{
  "response": "Based on your data analysis...",
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 200,
    "total_tokens": 350
  }
}
```

## Data Context

The assistant receives the following data context:
- **Monthly Metrics**: Total sales, orders, labor efficiency, average order value
- **Daily Data**: Day-by-day breakdown with channel-specific sales data
- **Historical Data**: When using historical lens features
- **Period Info**: Selected month/year and formatted period names
- **Summary Statistics**: Calculated averages and totals

## Quick Questions

The assistant comes with predefined quick questions:
- "What are the key trends in this data?"
- "Which sales channel is performing best?"
- "Are there any concerning patterns I should know about?"
- "What recommendations do you have for improvement?"
- "How does labor efficiency correlate with sales?"
- "What should I focus on this month?"

## Cost Considerations

- Uses `gpt-4o-mini` model for cost efficiency
- Token usage is returned with each response for monitoring
- Limited to 800 max tokens per response to control costs
- Consider implementing rate limiting for production use

## Error Handling

The integration handles:
- Missing API key configuration
- API quota exceeded errors
- Network connectivity issues
- Invalid requests and responses

## Security Notes

- API keys should be stored securely in environment variables
- Consider implementing user authentication checks
- Monitor API usage to prevent abuse
- Data is sent to OpenAI's servers - ensure compliance with your data policies
