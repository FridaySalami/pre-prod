import { json } from '@sveltejs/kit';
import { getDailyOrderCounts, getCurrentWeekRange } from '$lib/server/processedOrdersService.server';

export async function GET({ url }) {
  try {
    // Get date parameters or use current week as default
    let startDate = url.searchParams.get('startDate');
    let endDate = url.searchParams.get('endDate');
    
    let start: Date;
    let end: Date;
    
    if (!startDate || !endDate) {
      // Use current week if no dates provided
      const weekRange = getCurrentWeekRange();
      start = new Date(weekRange.fromDate);
      end = new Date(weekRange.toDate);
    } else {
      // Parse provided dates
      start = new Date(startDate);
      end = new Date(endDate);
      
      // Validate dates
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return json({ 
          error: "Invalid date format. Please use ISO format (YYYY-MM-DD)." 
        }, { status: 400 });
      }
    }
    
    // Get the order counts for each day in the range
    const dailyOrders = await getDailyOrderCounts(start, end);
    
    return json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      dailyOrders
    });
  } catch (error) {
    console.error('Error fetching weekly order counts:', error);
    return json({ 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}