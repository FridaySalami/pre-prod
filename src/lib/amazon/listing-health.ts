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

  // Title length >= 80 chars: 0.6 pts
  const titleLength = catalogData.title?.length || 0;
  const titlePassed = titleLength >= 80;
  const titlePoints = titlePassed ? 0.6 : (titleLength >= 50 ? 0.3 : 0);
  score += titlePoints;
  details.push({
    criterion: 'Title Length',
    points: titlePoints,
    maxPoints: 0.6,
    passed: titlePassed,
    message: titlePassed
      ? `✅ ${titleLength} characters (optimal)`
      : titleLength >= 50
      ? `⚠️ ${titleLength} characters (add ${80 - titleLength} more)`
      : `❌ ${titleLength} characters (too short)`
  });

  // 5 bullet points filled: 0.6 pts
  const bulletCount = catalogData.bulletPoints?.length || 0;
  const bulletsPassed = bulletCount >= 5;
  const bulletPoints = bulletCount >= 5 ? 0.6 : bulletCount >= 3 ? 0.4 : bulletCount * 0.2;
  score += bulletPoints;
  details.push({
    criterion: 'Bullet Points',
    points: bulletPoints,
    maxPoints: 0.6,
    passed: bulletsPassed,
    message: bulletsPassed
      ? `✅ ${bulletCount} bullet points (complete)`
      : `⚠️ ${bulletCount}/5 bullet points (add ${5 - bulletCount} more)`
  });

  // Description >= 500 chars: 0.6 pts
  const descLength = catalogData.description?.length || 0;
  const descPassed = descLength >= 500;
  const descPoints = descPassed ? 0.6 : descLength >= 250 ? 0.3 : 0;
  score += descPoints;
  details.push({
    criterion: 'Description',
    points: descPoints,
    maxPoints: 0.6,
    passed: descPassed,
    message: descPassed
      ? `✅ ${descLength} characters (detailed)`
      : descLength >= 250
      ? `⚠️ ${descLength} characters (expand by ${500 - descLength})`
      : `❌ ${descLength} characters (needs description)`
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
  if (imageCount >= 7) {
    countPoints = 1.0;
    countPassed = true;
  } else if (imageCount >= 5) {
    countPoints = 0.7;
  } else if (imageCount >= 3) {
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
      : imageCount >= 5
      ? `⚠️ ${imageCount} images (add ${7 - imageCount} more)`
      : `❌ ${imageCount} images (minimum 7 recommended)`
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
 * Buy Box Performance Score (0-2.0 points, 20% of total)
 */
function calculateBuyBoxScore(buyBoxData?: BuyBoxData): ComponentScore {
  const details: ScoreDetail[] = [];
  let score = 0;
  const maxScore = 2.0;

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
      ? `⚠️ ${winRate.toFixed(1)}% win rate (improve pricing/fulfillment)`
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

  // FBA/Prime enabled: 0.5 pts
  const hasFBA = buyBoxData.isFBA || buyBoxData.isPrime;
  const fbaPoints = hasFBA ? 0.5 : 0;
  score += fbaPoints;
  details.push({
    criterion: 'Fulfillment',
    points: fbaPoints,
    maxPoints: 0.5,
    passed: hasFBA,
    message: hasFBA
      ? buyBoxData.isPrime
        ? '✅ Prime eligible (FBA)'
        : '✅ FBA enabled'
      : '❌ Not using FBA (consider switching)'
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
    if (titleLength < 80) {
      recommendations.push({
        category: 'content',
        priority: 'high',
        title: 'Optimize Product Title',
        description: `Expand title to 80+ characters (currently ${titleLength}). Include key features and benefits.`,
        impact: '+0.3 to +0.6 points'
      });
    }

    const bulletCount = catalogData.bulletPoints?.length || 0;
    if (bulletCount < 5) {
      recommendations.push({
        category: 'content',
        priority: 'high',
        title: 'Add More Bullet Points',
        description: `Add ${5 - bulletCount} more bullet point${5 - bulletCount > 1 ? 's' : ''} to highlight key features.`,
        impact: '+0.2 to +0.6 points'
      });
    }

    if (!catalogData.description || catalogData.description.length < 500) {
      recommendations.push({
        category: 'content',
        priority: 'medium',
        title: 'Enhance Product Description',
        description: 'Write a detailed 500+ character description with product benefits and use cases.',
        impact: '+0.3 to +0.6 points'
      });
    }
  }

  // Image recommendations
  if (breakdown.images.percentage < 80) {
    const imageCount = catalogData.images?.length || 0;
    if (imageCount < 7) {
      recommendations.push({
        category: 'images',
        priority: 'high',
        title: 'Add More Product Images',
        description: `Upload ${7 - imageCount} more image${7 - imageCount > 1 ? 's' : ''} including lifestyle shots and detail views.`,
        impact: '+0.3 to +1.0 points'
      });
    }

    const hasPTImages = catalogData.images?.filter(img => img.variant.startsWith('PT')).length || 0;
    if (hasPTImages < 3) {
      recommendations.push({
        category: 'images',
        priority: 'medium',
        title: 'Create Infographic Images',
        description: 'Add 3+ infographic images showing key features, dimensions, and benefits.',
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
        description: `Currently at ${buyBoxData.winRate.toFixed(1)}%. Consider FBA, competitive pricing, and maintaining stock.`,
        impact: '+0.3 to +1.0 points'
      });
    }

    if (!buyBoxData.isFBA && !buyBoxData.isPrime) {
      recommendations.push({
        category: 'buybox',
        priority: 'medium',
        title: 'Enable FBA/Prime',
        description: 'Switch to FBA to qualify for Prime shipping and improve Buy Box chances.',
        impact: '+0.5 points'
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
