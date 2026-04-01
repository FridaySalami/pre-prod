import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callLinnworksApi } from '$lib/server/linnworksClient.server';

interface StockItemSupplier {
  IsDefault: boolean;
  Supplier: string;
  SupplierID: string;
  Code: string;
  SupplierBarcode: string;
  LeadTime: number;
  PurchasePrice: number;
  MinPrice: number;
  MaxPrice: number;
  AveragePrice: number;
  AverageLeadTime: number;
  SupplierMinOrderQty: number;
  SupplierPackSize: number;
  SupplierCurrency: string;
  StockItemId: string;
  StockItemIntId: number;
}

interface StockItemLevel {
  Location: {
    StockLocationId: string;
    StockLocationIntId: number;
    LocationName: string;
    LocationTag: string;
    IsFulfillmentCenter: boolean;
    IsWarehouseManaged: boolean;
    BinRack: string;
  };
  StockLevel: number;
  StockValue: number;
  MinimumLevel: number;
  InOrderBook: number;
  Due: number;
  JIT: boolean;
  InOrders: number;
  Available: number;
  UnitCost: number;
  SKU: string;
  AutoAdjust: boolean;
  LastUpdateDate: string;
  LastUpdateOperation: string;
  rowid: string;
  PendingUpdate: boolean;
  StockItemPurchasePrice: number;
  StockItemId: string;
  StockItemIntId: number;
}

interface StockItemImage {
  Source: string;
  FullSource: string;
  CheckSumValue: string;
  pkRowId: string;
  IsMain: boolean;
  SortOrder: number;
  ChecksumValue: string;
  RawChecksum: string;
  StockItemId: string;
  StockItemIntId: number;
}

interface StockItemFull {
  ItemNumber: string;
  ItemTitle: string;
  BarcodeNumber: string;
  MetaData: string;
  isBatchedStockType: boolean;
  PurchasePrice: number;
  RetailPrice: number;
  TaxRate: number;
  PostalServiceId: string;
  PostalServiceName: string;
  CategoryId: string;
  CategoryName: string;
  PackageGroupId: string;
  PackageGroupName: string;
  Height: number;
  Width: number;
  Depth: number;
  Weight: number;
  CreationDate: string;
  IsCompositeParent: boolean;
  InventoryTrackingType: number;
  BatchNumberScanRequired: boolean;
  SerialNumberScanRequired: boolean;
  StockItemId: string;
  StockItemIntId: number;
  StockLevels: StockItemLevel[];
  Images: StockItemImage[];
  Suppliers: StockItemSupplier[];
}

// Placeholder interface for the new endpoint's response - this is a guess
// and might need adjustment based on the actual API response.
interface ExtendedPropertiesResponse {
  StockItemId: string;
  SKU: string;
  ItemTitle?: string;
  ExtendedProperties: Array<{ PropertyName: string; PropertyValue: string; PropertyType: string }>;
  // Add other fields if known or inspect the raw response
}

export const GET: RequestHandler = async ({ url, locals }) => { // Added 'url' to access query parameters
  try {
    const sku = url.searchParams.get('sku');

    if (!sku) {
      return json({
        success: false,
        error: 'SKU query parameter is required'
      }, { status: 400 });
    }

    // Switched to Inventory/GetInventoryItemExtendedProperties
    // This endpoint fetches details for a SINGLE item by SKU or inventoryItemId.
    const itemProperties = await callLinnworksApi<ExtendedPropertiesResponse /* or any for initial testing */>(
      'Inventory/GetInventoryItemExtendedProperties',
      'POST',
      {
        "SKU": sku // Use the SKU from the query parameter
      }
    );

    if (!itemProperties) { // This check might need adjustment based on actual API response
      throw new Error('Invalid response from Linnworks API (GetInventoryItemExtendedProperties)');
    }

    // The original transformation (transformedItems) is no longer applicable
    // as this endpoint returns details for a single item, not a list.
    // We are returning the raw itemProperties for now.
    // The frontend consuming this will need to be adapted.
    return json({
      success: true,
      item: itemProperties, // Returning the fetched item properties directly
    });
  } catch (error) {
    console.error('Error fetching inventory item properties:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
};
