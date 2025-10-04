/**
 * TypeScript interfaces for Buy Box Alert data structures
 */

export interface PriceInfo {
  Amount: number;
  CurrencyCode: string;
}

export interface ShippingInfo {
  Amount: number;
  CurrencyCode: string;
}

export interface ShippingTime {
  maximumHours: number;
  minimumHours: number;
  availabilityType: string;
}

export interface PrimeInformation {
  IsPrime: boolean;
  IsNationalPrime: boolean;
}

export interface SellerFeedbackRating {
  FeedbackCount: number;
  SellerPositiveFeedbackRating: number;
}

export interface ShipsFrom {
  Country: string;
}

export interface Offer {
  SellerId: string;
  Shipping: ShippingInfo;
  ShipsFrom: ShipsFrom;
  ListingPrice: PriceInfo;
  ShippingTime: ShippingTime;
  SubCondition: string;
  IsBuyBoxWinner: boolean;
  PrimeInformation: PrimeInformation;
  IsFeaturedMerchant: boolean;
  IsFulfilledByAmazon: boolean;
  SellerFeedbackRating: SellerFeedbackRating;
}

export interface BuyBoxPrice {
  Shipping: ShippingInfo;
  condition: string;
  LandedPrice: PriceInfo;
  ListingPrice: PriceInfo;
}

export interface LowestPrice {
  Shipping: ShippingInfo;
  condition: string;
  LandedPrice: PriceInfo;
  ListingPrice: PriceInfo;
  fulfillmentChannel: string;
}

export interface SalesRanking {
  Rank: number;
  ProductCategoryId: string;
}

export interface OfferCount {
  condition: string;
  OfferCount: number;
  fulfillmentChannel: string;
}

export interface Summary {
  ListPrice?: PriceInfo;
  BuyBoxPrices: BuyBoxPrice[];
  LowestPrices: LowestPrice[];
  SalesRankings: SalesRanking[];
  NumberOfOffers: OfferCount[];
  TotalOfferCount: number;
  BuyBoxEligibleOffers: OfferCount[];
  CompetitivePriceThreshold: PriceInfo;
}

export interface Identifier {
  ASIN: string;
  ItemCondition: string;
  MarketplaceId: string;
}

export interface BuyBoxData {
  ASIN: string;
  Offers: Offer[];
  status: string;
  Summary: Summary;
  Identifier: Identifier;
  ItemCondition: string;
  marketplaceId: string;
}

export interface BuyBoxAlert {
  id: string;
  asin: string;
  productName?: string;
  sku?: string;
  timestamp: string;
  alertType: 'BUY_BOX_LOST' | 'BUY_BOX_WON' | 'PRICE_CHANGE' | 'NEW_COMPETITOR' | 'RANK_CHANGE';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  data: BuyBoxData;
  previousData?: BuyBoxData;
  recommendations?: string[];
}

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type AlertType = 'BUY_BOX_LOST' | 'BUY_BOX_WON' | 'PRICE_CHANGE' | 'NEW_COMPETITOR' | 'RANK_CHANGE';