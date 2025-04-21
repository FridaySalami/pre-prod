import { json } from '@sveltejs/kit';

// Define interfaces for open orders data
interface OpenOrderDetail {
  id: string;
  numOrderId: number;
  reference: string;
  date: string;
  customer?: string;
  status: string;
  total: number;
}

interface OpenOrdersData {
  totalOrders: number;
  ordersByStatus: Record<string, number>;
  ordersDetails: OpenOrderDetail[];
}

export async function GET({ url }) {
  try {
    const pageNumber = parseInt(url.searchParams.get('pageNumber') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '100');
    const status = url.searchParams.get('status') || '';
    
    console.log(`Fetching open orders for page ${pageNumber}, size ${pageSize}, status filter: ${status || 'none'}`);
    
    // Generate more realistic mock data
    const mockData: OpenOrdersData = {
      totalOrders: 25,
      ordersByStatus: {
        "PAID": 12,
        "UNPAID": 8,
        "PENDING": 3,
        "RESEND": 2
      },
      ordersDetails: []
    };

    // Generate a larger set of mock orders
    const statuses = ["PAID", "UNPAID", "PENDING", "RESEND"];
    
    // Create mock orders
    for (let i = 1; i <= 25; i++) {
      // If status filter is applied, only include matching orders
      const orderStatus = statuses[i % statuses.length];
      if (status && status !== orderStatus) {
        continue;
      }
      
      const orderDate = new Date();
      // Stagger the dates a bit to make it more realistic
      orderDate.setDate(orderDate.getDate() - (i % 7));
      
      mockData.ordersDetails.push({
        id: `order-${i}`,
        numOrderId: 1000 + i,
        reference: `ORD-${2000 + i}`,
        date: orderDate.toISOString(),
        customer: `Customer ${i}`,
        status: orderStatus,
        total: 50 + (i * 2.5)
      });
    }
    
    // Apply pagination
    const startIdx = (pageNumber - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    mockData.ordersDetails = mockData.ordersDetails.slice(startIdx, endIdx);
    
    // Update total based on filtered results if status filter is applied
    if (status) {
      mockData.totalOrders = mockData.ordersDetails.length;
    }
    
    return json(mockData);
  } catch (error) {
    console.error('Error fetching open orders data:', error);
    return json({ 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}