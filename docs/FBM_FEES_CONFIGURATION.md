# FBM (Fulfilled by Merchant) Fees Configuration

## Changes Made

### 1. Server-Side Configuration (`+page.server.ts`)
Changed the fees API call to use **FBM mode** instead of FBA:

```typescript
// FBM (Fulfilled by Merchant) - no FBA fees
feesData = await feesService.getFeeEstimate(asin, currentPrice, false);
```

**Before:** `isAmazonFulfilled: true` (FBA mode)
**After:** `isAmazonFulfilled: false` (FBM mode)

### 2. UI Updates (`+page.svelte`)
- Added fulfillment method indicator: **(FBA)** or **(FBM)**
- Hide FBA Fee line when it's £0.00 (for FBM sellers)
- Show only applicable fees

```svelte
Fee Breakdown @ £51.80 (FBM)
  Referral Fee: £7.77
  Total Fees: £7.77
  You Receive: £44.03
```

## FBM vs FBA Fee Comparison

### Test Product: B08BPCC8WD @ £51.80

| Fee Type | FBA | FBM | Savings |
|----------|-----|-----|---------|
| FBA Fee | £4.73 | £0.00 | ✅ £4.73 |
| Referral Fee | £7.77 | £7.77 | - |
| **Total Fees** | **£12.50** | **£7.77** | **£4.73** |
| **You Receive** | **£39.30** | **£44.03** | **£4.73** |
| **Fee %** | 24.1% | 15.0% | 9.1% |

## How Fees Apply to FBM Sellers

### ✅ Fees You Pay (FBM)
1. **Referral Fee** - Category-based percentage (usually 15%)
   - Food & Beverage: 15%
   - Electronics: 8-15%
   - Varies by category
2. **Variable Closing Fee** - Only for media items (books, music, etc.)
   - Usually £0 for most categories

### ❌ Fees You Don't Pay (FBM)
- **FBA Fulfillment Fee** - Amazon's pick, pack, ship service
- **FBA Storage Fee** - Warehouse storage
- **Long-term Storage Fee** - Items stored >365 days
- **Removal/Disposal Fee** - When removing inventory

## Trade-offs: FBM vs FBA

### FBM Advantages ✅
- **Lower fees** - Save ~£4-5 per unit
- **More control** - Handle fulfillment yourself
- **No storage fees** - Keep inventory at your location
- **Faster changes** - Update listings/prices immediately

### FBM Disadvantages ❌
- **No Prime badge** - May lose Buy Box to FBA sellers
- **You handle shipping** - Time, labor, materials
- **Customer service** - You handle returns/refunds
- **Slower delivery** - Compete with Prime 1-day shipping

## API Implementation Details

### Fees API Request
```json
{
  "FeesEstimateRequest": {
    "MarketplaceId": "A1F83G8C2ARO7P",
    "IsAmazonFulfilled": false,  // ← FBM = false, FBA = true
    "PriceToEstimateFees": {
      "ListingPrice": {
        "Amount": 51.80,
        "CurrencyCode": "GBP"
      }
    }
  }
}
```

### Response Structure
```json
{
  "FeesEstimate": {
    "FeeDetailList": [
      {
        "FeeType": "ReferralFee",
        "FeeAmount": { "Amount": 7.77 }
      }
      // NO FBAFees for FBM!
    ],
    "TotalFeesEstimate": { "Amount": 7.77 }
  }
}
```

## Testing

Run the FBM fees test:
```bash
npx tsx test-fbm-fees.ts
```

Expected output:
```
✅ FBA Fee: £0.00 (Correct - no FBA fees)
✅ Referral Fee: £7.77 (15% of £51.8)
💰 Total Fees: £7.77
💵 You Receive: £44.03
📊 Fee %: 15.0%
```

## Files Modified

1. `/src/routes/buy-box-alerts/product/[asin]/+page.server.ts`
   - Changed `isAmazonFulfilled` from `true` to `false`
   - Added FBM comment

2. `/src/routes/buy-box-alerts/product/[asin]/+page.svelte`
   - Added fulfillment method indicator
   - Conditionally hide FBA Fee when £0.00
   - Show (FBM) or (FBA) label

3. `/test-fbm-fees.ts` (NEW)
   - Comprehensive FBM vs FBA comparison test
   - Validates no FBA fees for FBM

## Status

✅ **COMPLETE** - Product page now shows correct FBM fees without FBA charges.

## Next Steps (Optional)

1. **Make fulfillment method configurable** - Allow switching between FBM/FBA per product
2. **Store fulfillment method in database** - Track which products are FBA/FBM
3. **Profit calculator** - Add COGS to show true profit margins
4. **Break-even analysis** - Calculate minimum price needed for target margin
