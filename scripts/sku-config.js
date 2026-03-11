/**
 * SKU Configuration for Live Pricing
 * Add your Amazon SKUs here for automated pricing updates
 */

// Your Amazon SKUs - Replace these with your actual SKUs
export const YOUR_SKUS = [
  // Example format:
  // 'YOUR-SKU-001',
  // 'YOUR-SKU-002', 
  // 'YOUR-SKU-003'

  // Add your actual SKUs here:

];

// Marketplace configurations
export const MARKETPLACES = {
  UK: 'A1F83G8C2ARO7P',
  US: 'ATVPDKIKX0DER',
  DE: 'A1PA6795UKMFR9',
  FR: 'A13V1IB3VIYZZH',
  IT: 'APJ6JRA9NG5V4',
  ES: 'A1RKKUPIHCS9HS'
};

// Default marketplace
export const DEFAULT_MARKETPLACE = MARKETPLACES.UK;

// Rate limiting (milliseconds between requests)
export const RATE_LIMIT_DELAY = 1100;

// Product categories for organization (optional)
export const SKU_CATEGORIES = {
  // Example:
  // 'electronics': ['SKU-ELEC-001', 'SKU-ELEC-002'],
  // 'books': ['SKU-BOOK-001', 'SKU-BOOK-002'],
  // 'clothing': ['SKU-CLOTH-001', 'SKU-CLOTH-002']
};

// High-priority SKUs for frequent monitoring
export const HIGH_PRIORITY_SKUS = [
  // Add your best-selling or most important SKUs here
];

// SKUs to monitor for competitive pricing
export const COMPETITIVE_SKUS = [
  // Add SKUs where you need to track competitor pricing closely
];
