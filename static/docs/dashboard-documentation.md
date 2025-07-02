
# Dashboard Documentation

## Overview

The Dashboard is the central hub for daily operations, providing a real-time overview of key performance indicators. It is the primary interface for uploading and reviewing daily metric data, which is crucial for monitoring the business's health.

## Daily Metric Review Upload

A key function of this page is the `daily_metric_review` data upload. This data is compiled from various sources and is essential for generating the daily reports and analytics used across the site.

### Linnworks Order Processing Dependency

The data for the `daily_metric_review` is heavily dependent on the order processing cycle in Linnworks, our order management system. The final order data for a given day is not available until after 4:30 PM.

**IMPORTANT:** The `daily_metric_review` data for a given day should not be uploaded until after 4:30 PM. Uploading data before this time will result in incomplete and inaccurate reporting for the day.

## Impact on Other Features

The data uploaded via the dashboard directly feeds into the following features:

-   **Analytics Dashboard**: The daily metrics are the foundation of the charts and trends displayed on the analytics dashboard.
-   **Monthly Analytics**: The monthly roll-ups and comparisons are derived from the daily data.
-   **Email Reports**: Automated email reports are generated based on this data.

Any inaccuracies in the uploaded data will propagate to these other systems.
