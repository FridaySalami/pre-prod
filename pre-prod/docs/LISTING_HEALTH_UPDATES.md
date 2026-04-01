# Listing Health Score Updates

## Changes Made (13 Oct 2025)

### 1. Title Length Recommendation Changed
**Before:** 150-180 characters (ideal)
**Now:** 80-100 characters (ideal)

- Updated `AMAZON_STANDARDS.title.ideal` from 150 to 80
- Updated `AMAZON_STANDARDS.title.idealMax` from 180 to 100
- Updated `AMAZON_STANDARDS.title.min` from 80 to 60
- Updated recommendation text to show "Recommended length: 80–100 characters"

**Scoring:**
- 80-100 chars: 0.6 pts (perfect) ✅
- 60-79 chars: 0.5 pts (good but not ideal) ⚠️
- 40-59 chars: 0.3 pts (acceptable) ⚠️
- <40 chars: 0 pts (too short) ❌

### 2. Removed FBA/Fulfillment Suggestions
**Removed:**
- ❌ FBA/Prime scoring component (was 0.5 points)
- ❌ "Enable FBA/Prime" recommendation
- ❌ "Not using FBA (consider switching)" messages
- ❌ "Consider FBA" from win rate recommendations

**Updated Buy Box maxScore:**
- Changed from 2.0 points to 1.5 points
- Now only scores: Win Rate (1.0 pts) + Current Status (0.5 pts)

### 3. Improved Buy Box Win Rate Messaging
**Before:** "Consider FBA, competitive pricing, and maintaining stock"
**Now:** "Focus on competitive pricing and maintaining consistent stock levels"

**Detail messages updated:**
- Win rate ≥50%: "⚠️ X% win rate (improve pricing & stock)" (removed "/fulfillment")

### 4. Updated Image Target to 6 Images
**Before:** Target 7-9 images
**Now:** Target 6 images

- Updated `AMAZON_STANDARDS.images.recommended` from 7 to 6
- Updated `AMAZON_STANDARDS.images.ideal` from 9 to 6

**Scoring:**
- ≥6 images: 1.0 pts (excellent) ✅
- 4-5 images: 0.7 pts (good) ⚠️
- 2-3 images: 0.4 pts (acceptable) ⚠️
- 1 image: 0.2 pts (minimum) ❌

**Messages:**
- ✅ "6 images (excellent)"
- ⚠️ "4 images (add 2 more for target)"
- ❌ "1 images (target: 6 images)"

## Impact on Scoring

### Before Changes:
- Content: 3.0 pts max (30%)
- Images: 2.5 pts max (25%)
- Competitive: 2.5 pts max (25%)
- Buy Box: 2.0 pts max (20%)
- **Total: 10.0 pts**

### After Changes:
- Content: 3.0 pts max (30%)
- Images: 2.5 pts max (25%)
- Competitive: 2.5 pts max (25%)
- Buy Box: 1.5 pts max (20%) ← Changed
- **Total: 9.5 pts**

⚠️ **Note:** The overall score is still calculated out of 10, but the buy box component now contributes less (1.5 instead of 2.0). This means buy box performance has slightly less weight in the overall calculation.

## Example Product Impact

**Essential Cuisine Veal Jus (B07N88YRJT):**

### Title (66 chars):
- **Before:** 0.3 pts (needed 150-180 chars)
- **After:** 0.5 pts (in 60-79 range, close to ideal)
- ✅ Improvement!

### Buy Box (0% win rate):
- **Before:** Would show "Consider FBA, competitive pricing, and maintaining stock"
- **After:** Shows "Focus on competitive pricing and maintaining consistent stock levels"
- ✅ More focused messaging!

### Images (3 images):
- **Before:** 0.4 pts (needed 7+ images)
- **After:** 0.4 pts (need 6 images)
- ✅ Lower barrier to achieve full points!

## Summary

These changes make the listing health score:
1. **More realistic** - 80-100 char titles are more practical than 150-180
2. **More focused** - Removes FBA pressure, focuses on pricing/stock
3. **More achievable** - 6 images target instead of 7-9
4. **More accurate** - Doesn't penalize sellers who can't use FBA

The scoring is now more aligned with practical Amazon selling best practices while maintaining high standards for listing quality.
