export interface ProcessedOrder {
  nOrderId: number;
  Source: string;
  OrderId?: string;
  Items?: OrderItem[];
  fTotalCharge?: number;
  fPostageCost?: number;
  Status?: number;
  PostalServiceName?: string;
  ReferenceNum?: string;
  SecondaryReference?: string;
  ExternalReference?: string;
}

export interface OrderItem {
  ItemNumber?: string;
  ItemName?: string;
  SKU?: string;
  Quantity?: number;
  ItemValue?: number;
}
