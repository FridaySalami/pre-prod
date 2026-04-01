#!/usr/bin/env node

/**
 * Deep dive into Bisto product attributes
 * Check what's actually available from Catalog API
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

const BISTO_ASIN = 'B00DYQ6IVW';

async function inspectAttributes() {
  console.log('\n🔍 Deep Inspection of Bisto Product Attributes');
  console.log('='.repeat(60));

  try {
    const { data, error } = await supabase
      .from('amazon_catalog_cache')
      .select('*')
      .eq('asin', BISTO_ASIN)
      .single();

    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }

    console.log('\n📦 Product Info:');
    console.log(`   ASIN: ${data.asin}`);
    console.log(`   Title: ${data.title}`);
    console.log(`   Brand: ${data.brand}`);
    console.log(`   Category: ${data.category}`);
    console.log(`   Marketplace: ${data.marketplace_id}`);

    console.log('\n📊 Review Count Column:');
    console.log(`   customer_review_count: ${data.customer_review_count}`);

    if (data.attributes) {
      const attrs = typeof data.attributes === 'string'
        ? JSON.parse(data.attributes)
        : data.attributes;

      console.log('\n📋 ALL ATTRIBUTES (complete list):');
      console.log('='.repeat(60));

      const attrKeys = Object.keys(attrs).sort();
      console.log(`\n   Total attributes: ${attrKeys.length}\n`);

      attrKeys.forEach(key => {
        const value = attrs[key];
        const valueStr = JSON.stringify(value, null, 2);

        // Highlight potential review/rating fields
        const isReviewRelated = key.toLowerCase().includes('review') ||
          key.toLowerCase().includes('rating') ||
          key.toLowerCase().includes('customer') ||
          key.toLowerCase().includes('feedback');

        if (isReviewRelated) {
          console.log(`\n   🌟 ${key}:`);
          console.log(`      ${valueStr.split('\n').join('\n      ')}`);
        } else {
          // Show first 100 chars for other attributes
          const preview = valueStr.length > 100
            ? valueStr.substring(0, 100) + '...'
            : valueStr;
          console.log(`\n   ${key}:`);
          console.log(`      ${preview.split('\n').join('\n      ')}`);
        }
      });

      // Search for any numeric fields that might be review count
      console.log('\n\n🔢 NUMERIC ATTRIBUTES (potential review counts):');
      console.log('='.repeat(60));
      attrKeys.forEach(key => {
        const value = attrs[key];
        if (Array.isArray(value) && value[0]?.value) {
          const val = value[0].value;
          // Check if it's a number or numeric string
          if (!isNaN(val) && val !== '' && val !== null) {
            console.log(`\n   ${key}: ${val}`);
            if (parseInt(val) > 10 && parseInt(val) < 10000) {
              console.log(`      👆 Could this be review count? (${val})`);
            }
          }
        }
      });

      // Check specific fields we're looking for
      console.log('\n\n🎯 SPECIFIC REVIEW FIELDS (checking our extraction logic):');
      console.log('='.repeat(60));
      const reviewFields = [
        'number_of_reviews',
        'customer_review_count',
        'review_count',
        'reviews',
        'customer_reviews',
        'total_reviews',
        'rating_count',
        'review_number'
      ];

      reviewFields.forEach(field => {
        if (attrs[field]) {
          console.log(`\n   ✅ ${field}: ${JSON.stringify(attrs[field], null, 2)}`);
        } else {
          console.log(`   ❌ ${field}: NOT FOUND`);
        }
      });

    } else {
      console.log('\n⚠️ No attributes object found');
    }

    console.log('\n\n' + '='.repeat(60));
    console.log('📋 CONCLUSION:');
    console.log('='.repeat(60));
    console.log('\nIf none of the review-related fields exist, this means:');
    console.log('• The UK Catalog API doesn\'t provide review count for this product');
    console.log('• This is a known limitation of the Catalog Items API');
    console.log('• Review counts may only be available via Product Advertising API');
    console.log('\n💡 Alternative solutions:');
    console.log('1. Test with a US marketplace product (marketplace: ATVPDKIKX0DER)');
    console.log('2. Implement Product Advertising API (requires Associates account)');
    console.log('3. Accept that review counts may not be available for all products');

  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    console.error(err);
  }
}

inspectAttributes();
