// Types for Buy Box Monitor

export interface OfferInfo {
  sellerId: string;
  sellerName?: string;
  price: number;
  currency: string;
  condition: string;
  fulfillment: string;
  totalPrice: number;
  shippingPrice: number;
  isBuyBox: boolean;
  primeEligible: boolean;
}

export interface BuyBoxResult {
  asin: string;
  youOwnBuyBox: boolean;
  yourOffers: OfferInfo[];
  buyBoxWinner: OfferInfo | null;
  competitorOffers: OfferInfo[];
  totalOffers: number;
  recommendations?: string[];
}

export interface OfferDetails {
  sellerId: string;
  sellerName: string;
  price: number;
  shipping: number;
  totalPrice: number;
  condition: string;
  fulfillmentType: string;
  hasBuyBox: boolean;
  isPrime: boolean;
}

export interface TransformedBuyBoxData {
  buyBoxOwner: string;
  buyBoxSellerName?: string;
  hasBuyBox: boolean;
  buyBoxPrice: number | null;
  buyBoxCurrency?: string;
  lastChecked: string;
  competitorInfo: Array<OfferDetails>;
  yourOffers: Array<OfferDetails>;
  recommendations?: string[];
}

export interface BuyBoxQuickStatus {
  hasBuyBox: boolean;
  buyBoxOwner: string;
  buyBoxPrice: number | null;
}

export interface SkuAsinMapping {
  id: string;
  seller_sku: string;
  item_name?: string;
  asin1?: string;
  asin2?: string;
  asin3?: string;
  price?: number;
  quantity?: number;
  status?: string;
  fulfillment_channel?: string;
  created_at: string;
  updated_at: string;
  buyBoxStatus?: BuyBoxQuickStatus;
}

export interface BuyBoxCompetitor {
  sellerId: string;
  sellerName: string;
  price: number;
  shipping: number;
  totalPrice: number;
  condition: string;
  fulfillmentType: string;
  hasBuyBox: boolean;
  isPrime: boolean;
}

// History record for Buy Box checks used in analytics
export interface BuyBoxCheck {
  asin: string;
  sku: string;
  itemName?: string;
  hasBuyBox: boolean;
  buyBoxOwner: string;
  buyBoxPrice: number | null;
  lastChecked: string;
  yourOffers: Array<OfferDetails>;
  competitorInfo: Array<OfferDetails>;
}

export interface BuyBoxResponse {
  success: boolean;
  asin: string;
  buyBoxOwner: string;
  hasBuyBox: boolean;
  buyBoxPrice: number | null;
  lastChecked: string;
  competitorInfo: Array<BuyBoxCompetitor>;
  productData: SkuAsinMapping | null;
  priceDifference: number | null;
  priceDifferencePercent: number | null;
  originalSku: string | null;
  recommendations?: string[];
}
