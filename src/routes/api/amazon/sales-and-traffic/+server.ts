import { json } from '@sveltejs/kit';
import { DataKioskService } from '$lib/amazon/data-kiosk-service';

export async function POST({ request }) {
  try {
    const { startDate, endDate, marketplaceId, nextToken } = await request.json();

    if (!startDate || !endDate) {
      return json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    const service = new DataKioskService();

    // Construct the GraphQL query
    // Removed aggregateBy argument to see if defaults work
    const query = `
      query {
        analytics_salesAndTraffic_2024_04_24 {
          salesAndTrafficByAsin(
            startDate: "${startDate}",
            endDate: "${endDate}",
            marketplaceIds: ["${marketplaceId || 'A1F83G8C2ARO7P'}"]
          ) {
            childAsin
            parentAsin
            sku
            sales {
              orderedProductSales {
                amount
                currencyCode
              }
              unitsOrdered
              totalOrderItems
              averageSellingPrice {
                amount
                currencyCode
              }
            }
            traffic {
              browserPageViews
              mobileAppPageViews
              sessions
              browserSessions
              buyBoxPercentage
            }
          }
        }
      }
    `;
    console.log('Generated Data Kiosk Query:', query);

    const queryId = await service.createQuery(query, nextToken);

    return json({ queryId, status: 'IN_QUEUE' });
  } catch (error) {
    console.error('Error requesting Data Kiosk query:', error);
    return json({ error: 'Failed to request query' }, { status: 500 });
  }
}

export async function GET({ url }) {
  const queryId = url.searchParams.get('queryId');
  if (!queryId) {
    return json({ error: 'Query ID is required' }, { status: 400 });
  }

  try {
    const service = new DataKioskService();
    const status = await service.getQueryStatus(queryId);

    if (status.status === 'DONE') {
      if (!status.documentId) {
        return json({ error: 'Query is DONE but has no document ID' }, { status: 500 });
      }

      const docInfo = await service.getDocument(status.documentId);
      const data = await service.downloadDocument(docInfo.documentUrl);

      console.log('Downloaded Data Kiosk document:', JSON.stringify(data, null, 2));

      return json({ status: 'DONE', data });
    } else {
      return json({ status: status.status });
    }

  } catch (error) {
    console.error('Error checking query status:', error);
    return json({ error: 'Failed to check query status' }, { status: 500 });
  }
}
