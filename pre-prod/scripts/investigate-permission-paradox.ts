/**
 * Investigation: Why does Listings API work but Catalog API fails?
 * Both supposedly require "Product Listing" role
 */

import 'dotenv/config';

console.log('🔬 Permission Paradox Investigation\n');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('📊 Test Results Summary:\n');

console.log('✅ Listings Items API: SUCCESS');
console.log('   • Endpoint: /listings/2021-08-01/items/{sellerId}/{sku}');
console.log('   • Required Role: Product Listing');
console.log('   • Status: Working (404 is expected with test SKU)\n');

console.log('❌ Catalog Items API v2022-04-01: DENIED');
console.log('   • Endpoint: /catalog/2022-04-01/items/{asin}');
console.log('   • Required Role: Product Listing');
console.log('   • Status: 403 AccessDeniedException\n');

console.log('❌ Catalog Items API v0: DENIED');
console.log('   • Endpoint: /catalog/v0/items/{asin}');
console.log('   • Required Role: Product Listing');
console.log('   • Status: 403 AccessDeniedException\n');

console.log('═══════════════════════════════════════════════════════════\n');

console.log('🤔 WHY THE DIFFERENCE?\n');

console.log('Hypothesis 1: Different OAuth Scopes');
console.log('   • Listings API might use a different OAuth scope name');
console.log('   • Catalog API might require additional "read catalog" scope');
console.log('   • Amazon docs may be incomplete or outdated\n');

console.log('Hypothesis 2: Seller Type Restrictions');
console.log('   • Catalog API might require Brand Registry');
console.log('   • Catalog API might require Professional Seller account');
console.log('   • Catalog API might be restricted to certain seller types\n');

console.log('Hypothesis 3: Marketplace-Specific Permissions');
console.log('   • UK marketplace might have different rules');
console.log('   • Some APIs only available in certain regions');
console.log('   • Authorization might be marketplace-specific\n');

console.log('Hypothesis 4: API Versioning Issues');
console.log('   • v2022-04-01 might have stricter requirements than v0');
console.log('   • But both versions fail, so likely not version-specific\n');

console.log('═══════════════════════════════════════════════════════════\n');

console.log('🔍 EVIDENCE:\n');

console.log('Supporting Evidence for Hypothesis 1 (Different OAuth Scopes):');
console.log('   • Listings API works → Has some "Product Listing" permission');
console.log('   • Catalog API fails → Missing different permission');
console.log('   • Both supposedly need same role per docs');
console.log('   • Suggests OAuth scope names differ from role names\n');

console.log('═══════════════════════════════════════════════════════════\n');

console.log('🔑 POSSIBLE SOLUTIONS:\n');

console.log('1. Check Authorization Screen Carefully');
console.log('   Look for permissions like:');
console.log('   • "View and manage listings" (might be Listings API)');
console.log('   • "View catalog" or "Access catalog items" (might be Catalog API)');
console.log('   • "Product information" vs "Product listings"\n');

console.log('2. Contact Amazon SP-API Support');
console.log('   • Request ID: a3a8d8c7-be3d-4915-af16-3228330c3113');
console.log('   • Ask: "Why does Listings API work but Catalog API returns 403?"');
console.log('   • They can check exact scopes on your refresh token\n');

console.log('3. Check Seller Central Account Type');
console.log('   • Verify Professional (not Individual) seller account');
console.log('   • Check if Brand Registry or other features needed');
console.log('   • Some APIs require additional seller qualifications\n');

console.log('4. Try Different Authorization URL');
console.log('   • UK-specific: sellercentral.amazon.co.uk');
console.log('   • EU-wide: sellercentral.amazon.de or .fr');
console.log('   • Different endpoints might show different permissions\n');

console.log('═══════════════════════════════════════════════════════════\n');

console.log('📸 NEXT STEP:\n');
console.log('Take a screenshot of the authorization screen showing ALL');
console.log('available permission checkboxes. This will reveal if there\'s');
console.log('a separate "Catalog" permission different from "Listings".\n');

console.log('Authorization URL:');
console.log('https://sellercentral.amazon.co.uk/apps/authorize/consent');
console.log('?application_id=amzn1.application-oa2-client.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX\n');

console.log('═══════════════════════════════════════════════════════════\n');
