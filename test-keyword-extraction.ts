/**
 * Test Keyword Extraction from Amazon Catalog Data
 * 
 * Tests the keyword extractor with real product data
 */

import { SPAPIClient } from './src/lib/amazon/sp-api-client';
import { CatalogService } from './src/lib/amazon/catalog-service';
import { extractKeywords, formatKeywords, getKeywordStats } from './src/lib/utils/keyword-extractor';
import * as dotenv from 'dotenv';

dotenv.config();

async function testKeywordExtraction() {
  console.log('\n🔍 Testing Keyword Extraction\n');
  console.log('='.repeat(70));

  const client = new SPAPIClient({
    clientId: process.env.AMAZON_CLIENT_ID!,
    clientSecret: process.env.AMAZON_CLIENT_SECRET!,
    refreshToken: process.env.AMAZON_REFRESH_TOKEN!,
    awsAccessKeyId: process.env.AMAZON_AWS_ACCESS_KEY_ID!,
    awsSecretAccessKey: process.env.AMAZON_AWS_SECRET_ACCESS_KEY!,
    awsRegion: 'eu-west-1',
    marketplaceId: 'A1F83G8C2ARO7P',
    sellerId: process.env.AMAZON_SELLER_ID!,
    roleArn: process.env.AMAZON_ROLE_ARN!
  });

  const catalogService = new CatalogService(client);

  // Test with multiple products
  const testAsins = [
    'B08BPCC8WD', // Major Vegetable Stock
    'B0BGPMD867'  // LA ESPAÑOLA Olive Oil
  ];

  for (const asin of testAsins) {
    try {
      console.log(`\n📦 Testing ASIN: ${asin}`);
      console.log('-'.repeat(70));

      // Get product data
      const product = await catalogService.getProduct(asin);

      console.log(`\n✅ Product Title:`);
      console.log(`   ${product.title}`);

      if (product.brand) {
        console.log(`\n🏷️  Brand: ${product.brand}`);
      }

      if (product.category) {
        console.log(`📂 Category: ${product.category}`);
      }

      if (product.bulletPoints && product.bulletPoints.length > 0) {
        console.log(`\n📝 Bullet Points (${product.bulletPoints.length}):`);
        product.bulletPoints.forEach((bullet, i) => {
          console.log(`   ${i + 1}. ${bullet.substring(0, 80)}${bullet.length > 80 ? '...' : ''}`);
        });
      }

      // Display extracted keywords
      if (product.keywords) {
        console.log(`\n🔑 EXTRACTED KEYWORDS:`);
        console.log('-'.repeat(70));

        console.log(`\n⭐ Primary Keywords (Top 5):`);
        product.keywords.primary.forEach((keyword: string, i: number) => {
          const formatted = keyword.charAt(0).toUpperCase() + keyword.slice(1);
          console.log(`   ${i + 1}. ${formatted}`);
        });

        if (product.keywords.secondary.length > 0) {
          console.log(`\n📌 Secondary Keywords:`);
          product.keywords.secondary.forEach((keyword: string, i: number) => {
            const formatted = keyword.charAt(0).toUpperCase() + keyword.slice(1);
            console.log(`   ${i + 1}. ${formatted}`);
          });
        }

        // Show detailed scores for top 10
        console.log(`\n📊 Keyword Scores (Top 10):`);
        product.keywords.all.slice(0, 10).forEach((kw: any, i: number) => {
          const formatted = kw.keyword.charAt(0).toUpperCase() + kw.keyword.slice(1);
          const sources = kw.sources.join(', ');
          console.log(`   ${i + 1}. ${formatted.padEnd(20)} Score: ${kw.score.toFixed(2).padStart(6)}  Freq: ${kw.frequency}  From: ${sources}`);
        });

        // Show statistics
        const stats = getKeywordStats(product.keywords);
        console.log(`\n📈 Statistics:`);
        console.log(`   Total Unique Keywords: ${stats.totalUnique}`);
        console.log(`   From Title: ${stats.fromTitle}`);
        console.log(`   From Bullets: ${stats.fromBullets}`);
        console.log(`   From Category: ${stats.fromCategory}`);
        console.log(`   Average Score: ${stats.avgScore.toFixed(2)}`);
      }

      console.log('\n' + '='.repeat(70));

      // Small delay between ASINs
      if (testAsins.indexOf(asin) < testAsins.length - 1) {
        console.log('\nWaiting 2 seconds before next product...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error(`\n❌ Error testing ${asin}:`, error);
      if (error instanceof Error) {
        console.error('Message:', error.message);
      }
    }
  }

  // Test standalone keyword extraction
  console.log('\n\n🧪 Testing Standalone Keyword Extraction\n');
  console.log('='.repeat(70));

  const testCases = [
    {
      title: 'Anker PowerCore 20000mAh Portable Charger USB-C Power Bank',
      bullets: [
        'High-Speed Charging: PowerIQ technology delivers the fastest possible charge',
        'Massive Capacity: 20000mAh charges iPhone 8 almost 7 times',
        'Universal Compatibility: Works with smartphones, tablets, and more'
      ],
      category: 'Cell Phone Portable Power Banks',
      brand: 'Anker'
    },
    {
      title: 'KitchenAid Artisan Stand Mixer 5-Quart Stainless Steel Bowl',
      bullets: [
        'Professional-Grade Mixing: 10 speeds for every recipe',
        'Planetary Mixing Action: Ensures thorough ingredient incorporation',
        'Durable Construction: All-metal design built to last'
      ],
      category: 'Stand Mixers',
      brand: 'KitchenAid'
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`\nTest Case ${index + 1}: ${testCase.title}`);
    console.log('-'.repeat(70));

    const keywords = extractKeywords(
      testCase.title,
      testCase.bullets,
      testCase.category,
      testCase.brand
    );

    console.log(`\n⭐ Primary Keywords:`);
    keywords.primary.forEach((keyword, i) => {
      console.log(`   ${i + 1}. ${keyword.charAt(0).toUpperCase() + keyword.slice(1)}`);
    });

    console.log(`\n📊 Top 10 with Scores:`);
    keywords.all.slice(0, 10).forEach((kw, i) => {
      const formatted = kw.keyword.charAt(0).toUpperCase() + kw.keyword.slice(1);
      console.log(`   ${i + 1}. ${formatted.padEnd(25)} Score: ${kw.score.toFixed(2).padStart(6)}  Sources: ${kw.sources.join(', ')}`);
    });

    console.log('');
  });

  console.log('\n' + '='.repeat(70));
  console.log('✅ Keyword Extraction Tests Complete!\n');
}

testKeywordExtraction();
