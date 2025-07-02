# Monthly Analytics User Guide

## 1. Overview

The Monthly Analytics page is a powerful tool for strategic business analysis, providing a high-level overview of key performance indicators (KPIs) on a month-over-month and year-over-year basis. It allows you to identify long-term trends, assess the impact of business decisions, and understand seasonal patterns in sales and profitability.

## 2. Key Features

- **Monthly KPI Dashboard**: Displays critical metrics including Total Sales, Total Orders, Average Order Value (AOV), Total Profit, and Profit Margin for a selected month.
- **Comparative Analysis**: Automatically compares the selected month's performance against the previous month and the same month in the previous year.
- **Percentage Change Indicators**: Clearly visualizes performance changes (increases or decreases) with color-coded percentage values.
- **Date Navigation**: An intuitive date selector allows you to easily navigate to any month and year for which historical data is available.

## 3. How to Use the Monthly Analytics Page

### 3.1 Selecting a Date

1.  **Navigate to the Page**: Access the page via the main Analytics dashboard by clicking on the "Monthly Dashboard" tab or a direct link.
2.  **Choose Month and Year**: Use the dropdown selectors at the top of the page to choose the specific month and year you wish to analyze.
3.  **Data Refresh**: The dashboard will automatically update with the data for the selected period.

### 3.2 Understanding the Metrics

The dashboard is centered around five key metrics:

-   **Total Sales**: The total revenue generated from all sales channels during the selected month.
-   **Total Orders**: The total number of orders processed.
-   **Average Order Value (AOV)**: Calculated as `Total Sales / Total Orders`. This metric helps understand customer purchasing behavior.
-   **Total Profit**: The total profit earned after accounting for costs.
-   **Profit Margin**: Calculated as `(Total Profit / Total Sales) * 100`. This shows the profitability of the revenue generated.

### 3.3 Interpreting the Comparisons

For each key metric, two comparisons are provided:

-   **vs. Previous Month**: This shows the percentage increase or decrease compared to the immediately preceding month. It is useful for tracking short-term momentum.
-   **vs. Same Month, Last Year**: This comparison helps identify seasonal trends and measure long-term growth by comparing the selected month to its equivalent in the previous year.

A positive percentage indicates growth, while a negative percentage indicates a decline.

## 4. Data Source

The data presented on this page is sourced from the `historical_sales_data` table in the database. This table is populated with aggregated daily sales data, ensuring that the monthly analytics are comprehensive and accurate. For the most current day-to-day details, please refer to the main "Daily Sales" tab.

## 5. Common Use Cases

-   **Quarterly Business Reviews**: Use the monthly data to compile reports and analyze performance over a quarter.
-   **Marketing Campaign Analysis**: Assess the impact of a marketing campaign by comparing the performance of the campaign month with previous months and the same month last year.
-   **Seasonal Planning**: Identify busy and slow months to better prepare for inventory, staffing, and marketing efforts in the upcoming year.
