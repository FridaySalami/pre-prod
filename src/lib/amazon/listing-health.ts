/**
 * Listing Health Score Calculator
 * 
 * Calculates a comprehensive health score (0-10) for Amazon product listings
 * based on four key factors:
 * 
 * 1. Content Completeness (30% weight) - Title, bullets, description, brand
 * 2. Image Quality (25% weight) - Count, size, variety
 * 3. Competitive Position (25% weight) - Rank, pricing, competition level
 * 4. Buy Box Performance (20% weight) - Win rate, current status, fulfillment
 * 
 * @module listing-health
 */

import type { CatalogProduct } from './catalog-service';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Amazon Listing Optimization Standards
 * Based on Amazon best practices and SEO guidelines
 */
const AMAZON_STANDARDS = {
  title: {
    min: 60,          // Minimum acceptable
    ideal: 80,        // Ideal range start (recommended)
    idealMax: 100,    // Ideal range end (recommended)
    max: 200          // Hard limit
  },
  bulletPoint: {
    min: 100,         // Minimum useful length
    ideal: 150,       // Ideal range start
    idealMax: 200,    // Ideal range end  
    max: 500          // Hard limit per bullet
  },
  description: {
    min: 500,         // Minimum for decent SEO
    ideal: 1000,      // Ideal range start
    idealMax: 2000,   // Ideal range end (also max)
    max: 2000         // Hard limit
  },
  backendTerms: {
    max: 249          // Strict byte cap (not checked in catalog data)
  },
  bulletCount: {
    min: 3,           // Minimum acceptable
    ideal: 5          // Recommended count
  },
  images: {
    min: 1,           // Required (main image)
    recommended: 6,   // Target for good listings
    ideal: 6          // Optimal count
  }
};

export interface ListingHealthScore {
  overall: number; // 0-10
  breakdown: {
    content: ComponentScore;
    images: ComponentScore;
    competitive: ComponentScore;
    buybox: ComponentScore;
  };
  recommendations: Recommendation[];
  grade: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  calculatedAt: Date;
}

export interface ComponentScore {
  score: number; // Actual points earned
  maxScore: number; // Maximum possible points
  percentage: number; // Score as percentage (0-100)
  grade: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  details: ScoreDetail[];
}

export interface ScoreDetail {
  criterion: string;
  points: number;
  maxPoints: number;
  passed: boolean;
  message: string;
}

export interface Recommendation {
  category: 'content' | 'images' | 'competitive' | 'buybox';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string; // Expected score improvement
}

export interface CompetitorData {
  yourRank?: number; // Your position among all sellers (1 = best)
  totalOffers: number;
  lowestPrice: number;
  yourPrice: number;
  averagePrice?: number;
}

export interface BuyBoxData {
  currentlyHasBuyBox: boolean;
  winRate: number; // 0-100 percentage
  totalChecks: number;
  isFBA: boolean;
  isPrime: boolean;
}

// ============================================================================
// Main Calculator
// ============================================================================

/**
 * Calculate comprehensive listing health score
 */
export function calculateListingHealth(
  catalogData: CatalogProduct,
  competitorData?: CompetitorData,
  buyBoxData?: BuyBoxData
): ListingHealthScore {
  const contentScore = calculateContentScore(catalogData);
  const imagesScore = calculateImagesScore(catalogData);
  const competitiveScore = calculateCompetitiveScore(competitorData);
  const buyboxScore = calculateBuyBoxScore(buyBoxData);

  // Weighted average (Content 30%, Images 25%, Competitive 25%, BuyBox 20%)
  const overall = (
    (contentScore.score / contentScore.maxScore) * 3.0 +
    (imagesScore.score / imagesScore.maxScore) * 2.5 +
    (competitiveScore.score / competitiveScore.maxScore) * 2.5 +
    (buyboxScore.score / buyboxScore.maxScore) * 2.0
  );

  const recommendations = generateRecommendations({
    content: contentScore,
    images: imagesScore,
    competitive: competitiveScore,
    buybox: buyboxScore
  }, catalogData, competitorData, buyBoxData);

  return {
    overall: Math.round(overall * 10) / 10, // Round to 1 decimal
    breakdown: {
      content: contentScore,
      images: imagesScore,
      competitive: competitiveScore,
      buybox: buyboxScore
    },
    recommendations,
    grade: getGrade(overall),
    calculatedAt: new Date()
  };
}

// ============================================================================
// Component Score Calculators
// ============================================================================

/**
 * Content Completeness Score (0-3 points, 30% of total)
 */
function calculateContentScore(catalogData: CatalogProduct): ComponentScore {
  const details: ScoreDetail[] = [];
  let score = 0;
  const maxScore = 3.0;

  // Title length (0.6 pts) - Recommended: 80-100 chars
  const titleLength = catalogData.title?.length || 0;
  const titleInIdealRange = titleLength >= AMAZON_STANDARDS.title.ideal && titleLength <= AMAZON_STANDARDS.title.idealMax;
  const titleAboveMin = titleLength >= AMAZON_STANDARDS.title.min;
  const titleTooLong = titleLength > AMAZON_STANDARDS.title.max;
  
  const titlePoints = titleTooLong 
    ? 0.4  // Penalize for exceeding max
    : titleInIdealRange 
      ? 0.6  // Perfect
      : titleAboveMin 
        ? 0.5  // Good but not ideal
        : titleLength >= 40 
          ? 0.3  // Acceptable
          : 0;   // Too short
  
  score += titlePoints;
  details.push({
    criterion: 'Title Length',
    points: titlePoints,
    maxPoints: 0.6,
    passed: titleInIdealRange,
    message: titleTooLong
      ? `⚠️ ${titleLength} chars (over ${AMAZON_STANDARDS.title.max} limit, reduce by ${titleLength - AMAZON_STANDARDS.title.max})`
      : titleInIdealRange
        ? `✅ ${titleLength} chars (ideal: ${AMAZON_STANDARDS.title.ideal}-${AMAZON_STANDARDS.title.idealMax})`
        : titleAboveMin
          ? `⚠️ ${titleLength} chars (expand to ${AMAZON_STANDARDS.title.ideal}+ for ideal)`
          : titleLength >= 40
            ? `⚠️ ${titleLength} chars (expand to ${AMAZON_STANDARDS.title.min}+ minimum)`
            : `❌ ${titleLength} chars (too short, need ${AMAZON_STANDARDS.title.min}+)`
  });

  // 5 bullet points filled: 0.6 pts
  const bulletPointsArray = catalogData.bulletPoints || [];
  const bulletCount = bulletPointsArray.length;
  const hasFiveBullets = bulletCount >= AMAZON_STANDARDS.bulletCount.ideal;
  
  // Check bullet point lengths - Amazon standards: 150-200 chars each ideal
  let bulletsInIdealRange = 0;
  let bulletsAboveMin = 0;
  bulletPointsArray.forEach(bullet => {
    const len = bullet.length;
    if (len >= AMAZON_STANDARDS.bulletPoint.ideal && len <= AMAZON_STANDARDS.bulletPoint.idealMax) {
      bulletsInIdealRange++;
    } else if (len >= AMAZON_STANDARDS.bulletPoint.min) {
      bulletsAboveMin++;
    }
  });
  
  const bulletLengthQuality = bulletCount > 0 
    ? (bulletsInIdealRange + bulletsAboveMin * 0.7) / bulletCount 
    : 0;
  
  const bulletPoints = hasFiveBullets 
    ? 0.6 * bulletLengthQuality  // Scale by quality
    : bulletCount >= AMAZON_STANDARDS.bulletCount.min 
      ? 0.4 * bulletLengthQuality  // Partial credit for 3-4 bullets
      : 0;
  
  score += bulletPoints;
  details.push({
    criterion: 'Bullet Points',
    points: bulletPoints,
    maxPoints: 0.6,
    passed: hasFiveBullets && bulletLengthQuality >= 0.8,
    message: bulletCount === 0
      ? `❌ No bullet points (need ${AMAZON_STANDARDS.bulletCount.ideal})`
      : hasFiveBullets
        ? bulletsInIdealRange >= 4
          ? `✅ ${bulletCount} bullets, ${bulletsInIdealRange} ideal length (${AMAZON_STANDARDS.bulletPoint.ideal}-${AMAZON_STANDARDS.bulletPoint.idealMax} chars)`
          : bulletsInIdealRange > 0
            ? `⚠️ ${bulletCount} bullets, only ${bulletsInIdealRange} in ideal range (expand others to ${AMAZON_STANDARDS.bulletPoint.ideal}+ chars)`
            : `⚠️ ${bulletCount} bullets, all need expansion (${AMAZON_STANDARDS.bulletPoint.ideal}-${AMAZON_STANDARDS.bulletPoint.idealMax} chars ideal)`
        : bulletCount >= AMAZON_STANDARDS.bulletCount.min
          ? `⚠️ ${bulletCount} bullets (add ${AMAZON_STANDARDS.bulletCount.ideal - bulletCount} more, ${AMAZON_STANDARDS.bulletPoint.ideal}-${AMAZON_STANDARDS.bulletPoint.idealMax} chars each)`
          : `❌ ${bulletCount} bullets (need ${AMAZON_STANDARDS.bulletCount.ideal}, ${AMAZON_STANDARDS.bulletPoint.ideal}-${AMAZON_STANDARDS.bulletPoint.idealMax} chars each)`
  });

  // Description length: 0.6 pts - Amazon standards: 1000-2000 ideal
  // NOTE: Many grocery/food products don't have descriptions in Catalog API (only bullet points)
  // If no description but has 5 bullets, give partial credit (API limitation, not seller's fault)
  const descLength = catalogData.description?.length || 0;
  const descInIdealRange = descLength >= AMAZON_STANDARDS.description.ideal && descLength <= AMAZON_STANDARDS.description.idealMax;
  const descAboveMin = descLength >= AMAZON_STANDARDS.description.min;
  const descTooLong = descLength > AMAZON_STANDARDS.description.max;
  
  // Many products (esp. grocery) don't return descriptions via Catalog API
  // Give partial credit if they have 5 bullets (indicates complete listing)
  const hasFullBullets = hasFiveBullets;
  
  const descPoints = descTooLong
    ? 0.4  // Penalize for exceeding max
    : descInIdealRange
      ? 0.6  // Perfect
      : descAboveMin
        ? 0.5  // Good but not ideal
        : descLength >= 250
          ? 0.3  // Acceptable
          : descLength === 0 && hasFullBullets
            ? 0.3  // Give partial credit if has 5 bullets (API may not return description)
            : descLength === 0
              ? 0    // No description and incomplete bullets
              : 0.2; // Very short description
  
  score += descPoints;
  details.push({
    criterion: 'Description',
    points: descPoints,
    maxPoints: 0.6,
    passed: descInIdealRange,
    message: descTooLong
      ? `⚠️ ${descLength} chars (over ${AMAZON_STANDARDS.description.max} limit, reduce by ${descLength - AMAZON_STANDARDS.description.max})`
      : descInIdealRange
        ? `✅ ${descLength} chars (ideal: ${AMAZON_STANDARDS.description.ideal}-${AMAZON_STANDARDS.description.idealMax})`
        : descAboveMin
          ? `⚠️ ${descLength} chars (expand to ${AMAZON_STANDARDS.description.ideal}+ for ideal)`
          : descLength >= 250
            ? `⚠️ ${descLength} chars (expand to ${AMAZON_STANDARDS.description.min}+ minimum)`
            : descLength === 0 && hasFullBullets
              ? `⚠️ No description (optional for some products - may not be in API)`
              : descLength === 0
                ? `❌ No description (add ${AMAZON_STANDARDS.description.min}+ chars)`
                : `⚠️ ${descLength} chars (too short, expand to ${AMAZON_STANDARDS.description.min}+)`
  });

  // Brand name present: 0.6 pts
  const hasBrand = !!catalogData.brand && catalogData.brand.length > 0;
  const brandPoints = hasBrand ? 0.6 : 0;
  score += brandPoints;
  details.push({
    criterion: 'Brand',
    points: brandPoints,
    maxPoints: 0.6,
    passed: hasBrand,
    message: hasBrand ? `✅ Brand: ${catalogData.brand}` : '❌ No brand specified'
  });

  // Key attributes filled (category, dimensions): 0.6 pts
  const hasCategory = !!catalogData.category;
  const hasDimensions = !!catalogData.dimensions;
  const attributeScore = (hasCategory ? 0.3 : 0) + (hasDimensions ? 0.3 : 0);
  score += attributeScore;
  details.push({
    criterion: 'Attributes',
    points: attributeScore,
    maxPoints: 0.6,
    passed: hasCategory && hasDimensions,
    message: hasCategory && hasDimensions
      ? '✅ Category and dimensions provided'
      : hasCategory
        ? '⚠️ Missing dimensions'
        : hasDimensions
          ? '⚠️ Missing category'
          : '❌ Missing category and dimensions'
  });

  return {
    score: Math.round(score * 10) / 10,
    maxScore,
    percentage: Math.round((score / maxScore) * 100),
    grade: getComponentGrade(score / maxScore),
    details
  };
}

/**
 * Image Quality Score (0-2.5 points, 25% of total)
 */
function calculateImagesScore(catalogData: CatalogProduct): ComponentScore {
  const details: ScoreDetail[] = [];
  let score = 0;
  const maxScore = 2.5;

  const imageCount = catalogData.images?.length || 0;

  // Image count: up to 1.0 pt
  let countPoints = 0;
  let countPassed = false;
  if (imageCount >= 6) {
    countPoints = 1.0;
    countPassed = true;
  } else if (imageCount >= 4) {
    countPoints = 0.7;
  } else if (imageCount >= 2) {
    countPoints = 0.4;
  } else if (imageCount > 0) {
    countPoints = 0.2;
  }
  score += countPoints;
  details.push({
    criterion: 'Image Count',
    points: countPoints,
    maxPoints: 1.0,
    passed: countPassed,
    message: countPassed
      ? `✅ ${imageCount} images (excellent)`
      : imageCount >= 4
        ? `⚠️ ${imageCount} images (add ${6 - imageCount} more for target)`
        : `❌ ${imageCount} images (target: 6 images)`
  });

  // Has lifestyle images (not just MAIN): 0.5 pts
  const hasVariety = catalogData.images?.some(img => img.variant !== 'MAIN') || false;
  const varietyPoints = hasVariety ? 0.5 : 0;
  score += varietyPoints;
  details.push({
    criterion: 'Image Variety',
    points: varietyPoints,
    maxPoints: 0.5,
    passed: hasVariety,
    message: hasVariety
      ? '✅ Multiple image types (MAIN, PT01, etc.)'
      : '❌ Only main image (add lifestyle/detail shots)'
  });

  // Images > 1000px: 0.5 pts
  const hasHighRes = catalogData.images?.some(img => img.width >= 1000 || img.height >= 1000) || false;
  const resPoints = hasHighRes ? 0.5 : catalogData.images?.length > 0 ? 0.25 : 0;
  score += resPoints;
  details.push({
    criterion: 'Image Resolution',
    points: resPoints,
    maxPoints: 0.5,
    passed: hasHighRes,
    message: hasHighRes
      ? '✅ High resolution images (≥1000px)'
      : catalogData.images?.length > 0
        ? '⚠️ Images below 1000px (use higher resolution)'
        : '❌ No images to evaluate'
  });

  // Has infographic/A+ content indicator: 0.5 pts
  // Check if there are PT images (usually infographics)
  const hasPTImages = catalogData.images?.filter(img => img.variant.startsWith('PT')).length || 0;
  const infographicPoints = hasPTImages >= 3 ? 0.5 : hasPTImages > 0 ? 0.25 : 0;
  score += infographicPoints;
  details.push({
    criterion: 'Infographics',
    points: infographicPoints,
    maxPoints: 0.5,
    passed: hasPTImages >= 3,
    message: hasPTImages >= 3
      ? `✅ ${hasPTImages} infographic images`
      : hasPTImages > 0
        ? `⚠️ ${hasPTImages} infographic (add ${3 - hasPTImages} more)`
        : '❌ No infographic images (add product features)'
  });

  return {
    score: Math.round(score * 10) / 10,
    maxScore,
    percentage: Math.round((score / maxScore) * 100),
    grade: getComponentGrade(score / maxScore),
    details
  };
}

/**
 * Competitive Position Score (0-2.5 points, 25% of total)
 */
function calculateCompetitiveScore(competitorData?: CompetitorData): ComponentScore {
  const details: ScoreDetail[] = [];
  let score = 0;
  const maxScore = 2.5;

  if (!competitorData) {
    // No competitor data available
    details.push({
      criterion: 'Competitive Analysis',
      points: 0,
      maxPoints: maxScore,
      passed: false,
      message: '⚠️ Competitor data not available'
    });
    return {
      score: 0,
      maxScore,
      percentage: 0,
      grade: 'Poor',
      details
    };
  }

  // Your rank among sellers: up to 1.0 pt
  const yourRank = competitorData.yourRank || 999;
  let rankPoints = 0;
  let rankPassed = false;
  if (yourRank <= 3) {
    rankPoints = 1.0;
    rankPassed = true;
  } else if (yourRank <= 10) {
    rankPoints = 0.6;
  } else {
    rankPoints = 0.2;
  }
  score += rankPoints;
  details.push({
    criterion: 'Price Rank',
    points: rankPoints,
    maxPoints: 1.0,
    passed: rankPassed,
    message: rankPassed
      ? `✅ Rank #${yourRank} (top 3)`
      : yourRank <= 10
        ? `⚠️ Rank #${yourRank} (improve to top 3)`
        : `❌ Rank #${yourRank} (not competitive)`
  });

  // Price within 10% of market low: 0.8 pts
  const priceDiff = ((competitorData.yourPrice - competitorData.lowestPrice) / competitorData.lowestPrice) * 100;
  const priceCompetitive = priceDiff <= 10;
  const pricePoints = priceCompetitive ? 0.8 : priceDiff <= 20 ? 0.4 : 0.1;
  score += pricePoints;
  details.push({
    criterion: 'Price Competitiveness',
    points: pricePoints,
    maxPoints: 0.8,
    passed: priceCompetitive,
    message: priceCompetitive
      ? `✅ ${priceDiff.toFixed(1)}% above lowest (competitive)`
      : priceDiff <= 20
        ? `⚠️ ${priceDiff.toFixed(1)}% above lowest (reduce slightly)`
        : `❌ ${priceDiff.toFixed(1)}% above lowest (too high)`
  });

  // Total offers (less competition is better): 0.7 pts
  const offerCount = competitorData.totalOffers;
  const lowCompetition = offerCount < 15;
  const offerPoints = offerCount < 10 ? 0.7 : offerCount < 15 ? 0.5 : offerCount < 25 ? 0.3 : 0.1;
  score += offerPoints;
  details.push({
    criterion: 'Competition Level',
    points: offerPoints,
    maxPoints: 0.7,
    passed: lowCompetition,
    message: offerCount < 10
      ? `✅ ${offerCount} offers (low competition)`
      : offerCount < 15
        ? `✅ ${offerCount} offers (moderate competition)`
        : offerCount < 25
          ? `⚠️ ${offerCount} offers (high competition)`
          : `❌ ${offerCount} offers (very high competition)`
  });

  return {
    score: Math.round(score * 10) / 10,
    maxScore,
    percentage: Math.round((score / maxScore) * 100),
    grade: getComponentGrade(score / maxScore),
    details
  };
}

/**
 * Buy Box Performance Score (0-1.5 points, 20% of total)
 * Removed FBA requirement as per user request
 */
function calculateBuyBoxScore(buyBoxData?: BuyBoxData): ComponentScore {
  const details: ScoreDetail[] = [];
  let score = 0;
  const maxScore = 1.5;

  if (!buyBoxData) {
    // No buy box data available
    details.push({
      criterion: 'Buy Box Performance',
      points: 0,
      maxPoints: maxScore,
      passed: false,
      message: '⚠️ Buy Box data not available'
    });
    return {
      score: 0,
      maxScore,
      percentage: 0,
      grade: 'Poor',
      details
    };
  }

  // Buy Box win rate: up to 1.0 pt
  const winRate = buyBoxData.winRate;
  let winRatePoints = 0;
  let winRatePassed = false;
  if (winRate >= 80) {
    winRatePoints = 1.0;
    winRatePassed = true;
  } else if (winRate >= 50) {
    winRatePoints = 0.6;
  } else if (winRate >= 25) {
    winRatePoints = 0.3;
  } else {
    winRatePoints = 0.2;
  }
  score += winRatePoints;
  details.push({
    criterion: 'Win Rate',
    points: winRatePoints,
    maxPoints: 1.0,
    passed: winRatePassed,
    message: winRatePassed
      ? `✅ ${winRate.toFixed(1)}% win rate (excellent)`
      : winRate >= 50
        ? `⚠️ ${winRate.toFixed(1)}% win rate (improve pricing & stock)`
        : `❌ ${winRate.toFixed(1)}% win rate (needs attention)`
  });

  // Currently has buy box: 0.5 pts
  const hasBuyBox = buyBoxData.currentlyHasBuyBox;
  const currentPoints = hasBuyBox ? 0.5 : 0;
  score += currentPoints;
  details.push({
    criterion: 'Current Status',
    points: currentPoints,
    maxPoints: 0.5,
    passed: hasBuyBox,
    message: hasBuyBox
      ? '✅ Currently winning Buy Box'
      : '❌ Not currently winning Buy Box'
  });

  return {
    score: Math.round(score * 10) / 10,
    maxScore,
    percentage: Math.round((score / maxScore) * 100),
    grade: getComponentGrade(score / maxScore),
    details
  };
}

// ============================================================================
// Recommendation Generator
// ============================================================================

function generateRecommendations(
  breakdown: ListingHealthScore['breakdown'],
  catalogData: CatalogProduct,
  competitorData?: CompetitorData,
  buyBoxData?: BuyBoxData
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Content recommendations
  if (breakdown.content.percentage < 80) {
    const titleLength = catalogData.title?.length || 0;
    if (titleLength < AMAZON_STANDARDS.title.ideal) {
      const targetLength = titleLength < AMAZON_STANDARDS.title.min 
        ? AMAZON_STANDARDS.title.min 
        : AMAZON_STANDARDS.title.ideal;
      recommendations.push({
        category: 'content',
        priority: titleLength < AMAZON_STANDARDS.title.min ? 'high' : 'medium',
        title: 'Optimize Product Title',
        description: `Recommended length: ${AMAZON_STANDARDS.title.ideal}–${AMAZON_STANDARDS.title.idealMax} characters (currently ${titleLength}). Include key features, benefits, and search terms.`,
        impact: titleLength < AMAZON_STANDARDS.title.min ? '+0.6 points' : '+0.1 to +0.3 points'
      });
    } else if (titleLength > AMAZON_STANDARDS.title.max) {
      recommendations.push({
        category: 'content',
        priority: 'medium',
        title: 'Shorten Product Title',
        description: `Reduce title to ${AMAZON_STANDARDS.title.max} characters or less (currently ${titleLength}). Amazon may truncate overly long titles.`,
        impact: '+0.2 points'
      });
    }

    const bulletPoints = catalogData.bulletPoints || [];
    const bulletCount = bulletPoints.length;
    if (bulletCount < AMAZON_STANDARDS.bulletCount.ideal) {
      recommendations.push({
        category: 'content',
        priority: 'high',
        title: 'Add More Bullet Points',
        description: `Add ${AMAZON_STANDARDS.bulletCount.ideal - bulletCount} more bullet point${AMAZON_STANDARDS.bulletCount.ideal - bulletCount > 1 ? 's' : ''} (${AMAZON_STANDARDS.bulletPoint.ideal}-${AMAZON_STANDARDS.bulletPoint.idealMax} characters each) to highlight key features.`,
        impact: '+0.2 to +0.6 points'
      });
    }
    
    // Check bullet lengths
    const shortBullets = bulletPoints.filter(b => b.length < AMAZON_STANDARDS.bulletPoint.min).length;
    if (shortBullets > 0 && bulletCount >= AMAZON_STANDARDS.bulletCount.min) {
      recommendations.push({
        category: 'content',
        priority: 'medium',
        title: 'Expand Bullet Points',
        description: `Expand ${shortBullets} bullet point${shortBullets > 1 ? 's' : ''} to ${AMAZON_STANDARDS.bulletPoint.ideal}-${AMAZON_STANDARDS.bulletPoint.idealMax} characters. Early bullets are weighted more heavily for SEO.`,
        impact: '+0.1 to +0.3 points'
      });
    }

    const descLength = catalogData.description?.length || 0;
    const hasFullBullets = bulletCount >= AMAZON_STANDARDS.bulletCount.ideal;
    
    // Only recommend description if it's missing AND bullets aren't complete
    // (Many products don't provide descriptions via Catalog API even if they exist on site)
    if (descLength < AMAZON_STANDARDS.description.ideal && !(descLength === 0 && hasFullBullets)) {
      const targetLength = descLength < AMAZON_STANDARDS.description.min 
        ? AMAZON_STANDARDS.description.min 
        : AMAZON_STANDARDS.description.ideal;
      
      const priority = descLength === 0 && !hasFullBullets 
        ? 'high' 
        : descLength < AMAZON_STANDARDS.description.min 
          ? 'medium' 
          : 'low';
      
      recommendations.push({
        category: 'content',
        priority,
        title: descLength === 0 ? 'Add Product Description' : 'Enhance Product Description',
        description: descLength === 0
          ? `Add a detailed product description (${AMAZON_STANDARDS.description.ideal}-${AMAZON_STANDARDS.description.idealMax} characters). This helps with SEO and conversions.`
          : `Expand description to ${AMAZON_STANDARDS.description.ideal}-${AMAZON_STANDARDS.description.idealMax} characters (currently ${descLength}). Balance SEO keywords with persuasive copy.`,
        impact: descLength === 0 && !hasFullBullets 
          ? '+0.3 to +0.6 points' 
          : descLength < AMAZON_STANDARDS.description.min 
            ? '+0.3 to +0.5 points' 
            : '+0.1 to +0.3 points'
      });
    } else if (descLength > AMAZON_STANDARDS.description.max) {
      recommendations.push({
        category: 'content',
        priority: 'low',
        title: 'Optimize Description Length',
        description: `Consider condensing description to ${AMAZON_STANDARDS.description.max} characters or less (currently ${descLength}). Focus on most impactful content.`,
        impact: '+0.2 points'
      });
    }
  }

  // Image recommendations
  if (breakdown.images.percentage < 80) {
    const imageCount = catalogData.images?.length || 0;
    if (imageCount < AMAZON_STANDARDS.images.recommended) {
      recommendations.push({
        category: 'images',
        priority: 'high',
        title: 'Add More Product Images',
        description: `Upload ${AMAZON_STANDARDS.images.recommended - imageCount} more image${AMAZON_STANDARDS.images.recommended - imageCount > 1 ? 's' : ''} (target: ${AMAZON_STANDARDS.images.recommended} total). Include lifestyle shots, detail views, and size comparisons.`,
        impact: '+0.3 to +1.0 points'
      });
    }

    const hasPTImages = catalogData.images?.filter(img => img.variant.startsWith('PT')).length || 0;
    if (hasPTImages < 3) {
      recommendations.push({
        category: 'images',
        priority: 'medium',
        title: 'Create Infographic Images',
        description: 'Add 3+ infographic images (PT variants) showing key features, dimensions, and benefits. These drive higher conversion.',
        impact: '+0.25 to +0.5 points'
      });
    }
  }

  // Competitive recommendations
  if (competitorData && breakdown.competitive.percentage < 70) {
    const priceDiff = ((competitorData.yourPrice - competitorData.lowestPrice) / competitorData.lowestPrice) * 100;
    if (priceDiff > 10) {
      const reduction = ((competitorData.yourPrice - competitorData.lowestPrice * 1.05) / competitorData.yourPrice * 100).toFixed(1);
      recommendations.push({
        category: 'competitive',
        priority: 'high',
        title: 'Adjust Pricing Strategy',
        description: `Reduce price by ~${reduction}% to be within 5% of lowest offer (£${(competitorData.lowestPrice * 1.05).toFixed(2)}).`,
        impact: '+0.4 to +0.8 points'
      });
    }

    if (competitorData.yourRank && competitorData.yourRank > 10) {
      recommendations.push({
        category: 'competitive',
        priority: 'high',
        title: 'Improve Competitive Position',
        description: `Currently ranked #${competitorData.yourRank}. Focus on price, shipping speed, and seller rating.`,
        impact: '+0.4 to +1.0 points'
      });
    }
  }

  // Buy Box recommendations
  if (buyBoxData && breakdown.buybox.percentage < 70) {
    if (buyBoxData.winRate < 50) {
      recommendations.push({
        category: 'buybox',
        priority: 'high',
        title: 'Improve Buy Box Win Rate',
        description: `Currently at ${buyBoxData.winRate.toFixed(1)}%. Focus on competitive pricing and maintaining consistent stock levels.`,
        impact: '+0.3 to +1.0 points'
      });
    }
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

// ============================================================================
// Helper Functions
// ============================================================================

function getGrade(score: number): 'Excellent' | 'Good' | 'Fair' | 'Poor' {
  if (score >= 8.0) return 'Excellent';
  if (score >= 6.0) return 'Good';
  if (score >= 4.0) return 'Fair';
  return 'Poor';
}

function getComponentGrade(ratio: number): 'Excellent' | 'Good' | 'Fair' | 'Poor' {
  if (ratio >= 0.8) return 'Excellent';
  if (ratio >= 0.6) return 'Good';
  if (ratio >= 0.4) return 'Fair';
  return 'Poor';
}

/**
 * Format score as visual indicator (●●●●●○○○○○)
 */
export function formatScoreVisual(score: number, maxScore: number = 10): string {
  const filled = Math.round((score / maxScore) * 10);
  const empty = 10 - filled;
  return '●'.repeat(filled) + '○'.repeat(empty);
}

/**
 * Get color class for score
 */
export function getScoreColor(score: number): string {
  if (score >= 8.0) return 'text-green-600';
  if (score >= 6.0) return 'text-blue-600';
  if (score >= 4.0) return 'text-yellow-600';
  return 'text-red-600';
}
