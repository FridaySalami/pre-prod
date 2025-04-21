/**
 * Get test open orders data for development/testing
 */
export function getTestOpenOrdersData(pageNumber: number, pageSize: number): any {
  console.log('Generating MOCK open orders data - these are not real orders');
  
  // Generate mock data
  const mockOrders = [];
  const now = new Date();
  
  // Create mock orders based on page size
  const count = pageSize;
  
  for (let i = 0; i < count; i++) {
    const orderDate = new Date(now);
    orderDate.setDate(now.getDate() - Math.floor(Math.random() * 14)); // Random date in the last 2 weeks
    
    const statusCode = Math.floor(Math.random() * 5); // Random status between 0-4
    
    mockOrders.push({
      OrderId: `MOCK-order-${(pageNumber - 1) * pageSize + i + 1000}`,
      NumOrderId: (pageNumber - 1) * pageSize + i + 1000,
      GeneralInfo: {
        ReceivedDate: orderDate.toISOString(),
        Status: statusCode,
        Source: "MOCK-DATA",
        ReferenceNum: `MOCK-ORD-${(pageNumber - 1) * pageSize + i + 1000}`
      },
      CustomerInfo: {
        Address: {
          FullName: `Mock Customer ${(pageNumber - 1) * pageSize + i + 1}`
        }
      },
      TotalsInfo: {
        TotalCharge: parseFloat((Math.random() * 150 + 10).toFixed(2)) // Random positive amount
      }
    });
  }
  
  // Simulate API response structure
  return {
    PageNumber: pageNumber,
    EntriesPerPage: pageSize,
    TotalPages: 5, // Mock 5 pages of data
    TotalEntries: 5 * pageSize,
    Data: mockOrders
  };
}

/**
 * Get test refund data for development/testing
 */
export function getTestRefundsData(): any {
  // Generate mock data
  const mockOrders = [];
  const now = new Date();
  
  // Create 20 mock refunds
  for (let i = 0; i < 20; i++) {
    const orderDate = new Date(now);
    orderDate.setDate(now.getDate() - Math.floor(Math.random() * 30)); // Random date in the last 30 days
    
    mockOrders.push({
      pkOrderID: `order-${i + 1000}`,
      dProcessedOn: orderDate.toISOString(),
      dReceivedDate: orderDate.toISOString(),
      fTotalCharge: -(Math.random() * 100 + 5).toFixed(2), // Random negative amount
      nStatus: 3, // Refunded status
      Source: "MOCK-REFUND",
      ReferenceNum: `REF-${i + 1000}`,
      cFullName: `Customer ${i + 1}`
    });
  }
  
  return {
    ProcessedOrders: {
      Data: mockOrders
    }
  };
}