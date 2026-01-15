import { json } from '@sveltejs/kit';
import { callLinnworksApi } from '$lib/server/linnworksClient.server';
import { db } from '$lib/supabaseServer';

export async function POST({ request }) {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return json({ error: 'Order ID is required' }, { status: 400 });
    }

    console.log(`Syncing Linnworks data for order ${orderId}...`);

    // 1. Search for the order in Linnworks
    // Use a wide date range to ensure we find it
    const fromDate = new Date();
    fromDate.setFullYear(fromDate.getFullYear() - 1); // Look back 1 year

    const searchRequest = {
      SearchTerm: orderId,
      DateField: "processed",
      FromDate: fromDate.toISOString(),
      ToDate: new Date().toISOString(),
      PageNumber: 1,
      ResultsPerPage: 20, // Minimum is 20
      ExactMatch: true
    };

    const result = await callLinnworksApi<any>('ProcessedOrders/SearchProcessedOrders', 'POST', {
      request: searchRequest
    });

    if (!result?.ProcessedOrders?.Data?.length) {
      console.log(`Order ${orderId} not found in Linnworks.`);
      return json({ error: 'Order not found in Linnworks' }, { status: 404 });
    }

    // 2. Extract details
    const lwOrder = result.ProcessedOrders.Data[0];
    const pkOrderId = lwOrder.pkOrderID;
    const serviceName = lwOrder.PostalServiceName || '';
    let trackingNumber = lwOrder.PostalTrackingNumber || '';
    const vendor = lwOrder.Vendor || '';
    let totalWeight = lwOrder.TotalWeight || 0; // Ensure we get weight

    console.log(`Found Linnworks Order: Service=${serviceName}, Tracking=${trackingNumber}, Weight=${totalWeight}`);

    // 2.5 Get Package Split Data
    let labelCount = 1;
    let splitWeights: number[] = [];

    try {
      console.log(`Fetching package split for ${pkOrderId}...`);
      const splitData = await callLinnworksApi<any[]>(`ProcessedOrders/GetPackageSplit?pkOrderId=${pkOrderId}`, 'GET');

      if (splitData && Array.isArray(splitData) && splitData.length > 0) {
        // Count unique BinIndexes (assuming they map to packages)
        const uniqueBins = new Set(splitData.map(i => i.BinIndex));
        if (uniqueBins.size > 1) {
          labelCount = uniqueBins.size;
          console.log(`Detected ${labelCount} packages/labels.`);
        }

        // Sum weights from split data if main weight is 0
        splitWeights = splitData.map(i => i.Weight || 0);
        const splitSum = splitWeights.reduce((a, b) => a + b, 0);
        if (totalWeight === 0 && splitSum > 0) {
          totalWeight = splitSum;
          console.log(`Calculated Total Weight from split: ${totalWeight}`);
        }
      }
    } catch (e) {
      console.error('Failed to get package split:', e);
    }

    // Simple carrier deduction logic
    let carrier = vendor;
    if (!carrier) {
      if (serviceName.toLowerCase().includes('dpd')) carrier = 'DPD';
      else if (serviceName.toLowerCase().includes('royal mail')) carrier = 'Royal Mail';
      else if (serviceName.toLowerCase().includes('dhl')) carrier = 'DHL';
      else if (serviceName.toLowerCase().includes('parcel force') || serviceName.toLowerCase().includes('parcelforce')) carrier = 'Parcel Force';
      else carrier = serviceName; // Fallback
    }

    // Cost Calculation Logic
    let shippingCost = 0;

    // Apply User Defined Rules
    if (carrier.toUpperCase().includes('DHL')) {
      // DHL Rules:
      // small 1kg – 3.23
      // medium 2kg – 3.23
      // large 5kg – 3.23
      // 20kg - 30kg – 3.44
      // multiple labels per order 0kg - 30kg – 2.37 each

      if (labelCount > 1) {
        shippingCost = labelCount * 2.37;
      } else {
        // Uniform 3.23 for 1, 2, 5kg. Assuming < 20kg is 3.23
        if (totalWeight >= 20) {
          shippingCost = 3.44;
        } else {
          shippingCost = 3.23;
        }
      }
      console.log(`Calculated DHL Cost: ${shippingCost} (Count: ${labelCount}, Weight: ${totalWeight})`);
    } else if (carrier.toUpperCase().includes('DPD')) {
      // DPD Rules:
      // Single label (all weights): 5.37
      // Multiple labels: 4.84 each

      if (labelCount > 1) {
        shippingCost = labelCount * 4.84;
      } else {
        shippingCost = 5.37;
      }
      console.log(`Calculated DPD Cost: ${shippingCost} (Count: ${labelCount})`);
    } else if (carrier.toUpperCase().includes('ROYAL MAIL')) {
      const rmPrices: Record<string, number> = {
        'Royal Mail 2nd Class Small Parcel': 3.50,
        'Royal Mail 48 (Parcel) (CRL)': 4.27,
        'Royal Mail 1st Class Small Parcel': 4.40,
        'Royal Mail Signed For 2nd Class Small Parcel': 5.00,
        'Royal Mail 2nd Class Medium Parcel': 5.25,
        'Royal Mail 24 (Parcel) (CRL)': 5.83,
        'Royal Mail Signed For 1st Class Small Parcel': 5.90,
        'Royal Mail 1st Class Medium Parcel': 6.15,
        'Royal Mail Signed For 2nd Class Medium Parcel': 6.75,
        'Royal Mail Signed For 1st Class Medium Parcel': 7.65,
        'Royal Mail Special Delivery Guaranteed by 1pm (Drop Off)': 14.25
      };

      const match = Object.keys(rmPrices).find(k => k.toLowerCase() === serviceName.toLowerCase().trim());
      if (match) {
        shippingCost = rmPrices[match];
      }
      console.log(`Calculated Royal Mail Cost: ${shippingCost} (Service: ${serviceName})`);
    }

    // Format tracking ID to include count if > 1
    let finalTrackingDisplay = trackingNumber;
    if (labelCount > 1) {
      finalTrackingDisplay = `${trackingNumber} (${labelCount} Parcels)`;
    }

    // Determine if we should update status to Shipped
    let updateData: any = {
      automated_carrier: carrier,
      automated_ship_method: serviceName,
      tracking_id: finalTrackingDisplay,
      shipping_source: 'LINNWORKS', // Mark source
      shipping_cost: shippingCost > 0 ? shippingCost : undefined, // Only update if calculated
      shipping_imported_at: new Date().toISOString()
    };

    const shippedCarriers = ['DHL', 'DPD', 'ROYAL MAIL', 'PARCEL FORCE'];
    if (carrier && shippedCarriers.some(c => carrier.toUpperCase().includes(c))) {
      updateData.order_status = 'Shipped';
    }

    // 3. Update Supabase
    // We update: automated_carrier, automated_ship_method, tracking_id, shipping_source, shipping_cost
    const { error: dbError } = await db
      .from('amazon_orders')
      .update(updateData)
      .eq('amazon_order_id', orderId);

    if (dbError) {
      console.error('Database Update Error:', dbError);
      return json({ error: 'Database update failed' }, { status: 500 });
    }

    return json({
      success: true,
      data: {
        carrier,
        service: serviceName,
        tracking: finalTrackingDisplay,
        labelCount,
        shippingCost
      }
    });

  } catch (error: any) {
    console.error('Linnworks Sync Error:', error);
    return json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
