#!/usr/bin/env node

/**
 * Buy Box Ownership Checker
 * 
 * This script checks if you own the Buy Box for your products by comparing
 * your seller ID with the Buy Box winner's seller ID.
 * 
 * Usage:
 *   node check-buy-box-ownership.js B0104R0FRG
 *   node check-buy-box-ownership.js --sku YOUR_SKU
 *   node check-buy-box-ownership.js --asin ASIN1 ASIN2 ASIN3
 */

const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

// Configuration
const config = {
    marketplace: process.env.AMAZON_MARKETPLACE_ID || 'A1F83G8C2ARO7P', // UK marketplace
    region: 'eu-west-1',
    endpoint: 'https://sellingpartnerapi-eu.amazon.com',
    
    // AWS credentials
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    
    // SP-API credentials
    refreshToken: process.env.AMAZON_REFRESH_TOKEN,
    clientId: process.env.AMAZON_CLIENT_ID,
    clientSecret: process.env.AMAZON_CLIENT_SECRET,
};

// AWS Signature V4 implementation
function createSignature(method, path, queryParams, headers, body, region, service, accessKeyId, secretAccessKey) {
    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStamp = now.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
    
    // Canonical request
    const canonicalUri = path;
    const canonicalQuerystring = queryParams ? Object.keys(queryParams)
        .sort()
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
        .join('&') : '';
    
    const canonicalHeaders = Object.keys(headers)
        .sort()
        .map(key => `${key.toLowerCase()}:${headers[key]}\n`)
        .join('');
    
    const signedHeaders = Object.keys(headers)
        .sort()
        .map(key => key.toLowerCase())
        .join(';');
    
    const payloadHash = crypto.createHash('sha256').update(body || '').digest('hex');
    
    const canonicalRequest = [
        method,
        canonicalUri,
        canonicalQuerystring,
        canonicalHeaders,
        signedHeaders,
        payloadHash
    ].join('\n');
    
    // String to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
        algorithm,
        timeStamp,
        credentialScope,
        crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');
    
    // Calculate signature
    const kDate = crypto.createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
    
    return {
        authorization: `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        'x-amz-date': timeStamp
    };
}

// Get access token
async function getAccessToken() {
    try {
        const response = await axios.post('https://api.amazon.com/auth/o2/token', {
            grant_type: 'refresh_token',
            refresh_token: config.refreshToken,
            client_id: config.clientId,
            client_secret: config.clientSecret
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        return response.data.access_token;
    } catch (error) {
        console.error('❌ Error getting access token:', error.response?.data || error.message);
        throw error;
    }
}

// Get your seller ID
async function getSellerInfo(accessToken) {
    try {
        const path = '/sellers/v1/marketplaceParticipations';
        
        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'x-amz-access-token': accessToken,
            'Content-Type': 'application/json',
            'Host': 'sellingpartnerapi-eu.amazon.com'
        };
        
        const signatureData = createSignature(
            'GET',
            path,
            null,
            headers,
            '',
            config.region,
            'execute-api',
            config.accessKeyId,
            config.secretAccessKey
        );
        
        headers['Authorization'] = signatureData.authorization;
        headers['x-amz-date'] = signatureData['x-amz-date'];
        
        const response = await axios.get(`${config.endpoint}${path}`, {
            headers,
            timeout: 10000
        });
        
        return response.data;
    } catch (error) {
        console.error('❌ Error getting seller info:', error.response?.status, error.response?.data || error.message);
        throw error;
    }
}

// Get competitive pricing data (includes seller IDs)
async function getCompetitivePricing(accessToken, asin) {
    try {
        const path = `/products/pricing/v0/items/${asin}/offers`;
        const queryParams = {
            MarketplaceId: config.marketplace,
            ItemCondition: 'New'
        };
        
        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'x-amz-access-token': accessToken,
            'Content-Type': 'application/json',
            'Host': 'sellingpartnerapi-eu.amazon.com'
        };
        
        const signatureData = createSignature(
            'GET',
            path,
            queryParams,
            headers,
            '',
            config.region,
            'execute-api',
            config.accessKeyId,
            config.secretAccessKey
        );
        
        headers['Authorization'] = signatureData.authorization;
        headers['x-amz-date'] = signatureData['x-amz-date'];
        
        const queryString = Object.keys(queryParams)
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
            .join('&');
        
        const response = await axios.get(`${config.endpoint}${path}?${queryString}`, {
            headers,
            timeout: 10000
        });
        
        return response.data;
    } catch (error) {
        console.error(`❌ Error getting competitive pricing for ${asin}:`, error.response?.status, error.response?.data || error.message);
        return null;
    }
}

// Get your own offers for comparison
async function getMyOffers(accessToken, asin) {
    try {
        const path = `/products/pricing/v0/items/${asin}/offers`;
        const queryParams = {
            MarketplaceId: config.marketplace,
            ItemCondition: 'New',
            CustomerType: 'Consumer'
        };
        
        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'x-amz-access-token': accessToken,
            'Content-Type': 'application/json',
            'Host': 'sellingpartnerapi-eu.amazon.com'
        };
        
        const signatureData = createSignature(
            'GET',
            path,
            queryParams,
            headers,
            '',
            config.region,
            'execute-api',
            config.accessKeyId,
            config.secretAccessKey
        );
        
        headers['Authorization'] = signatureData.authorization;
        headers['x-amz-date'] = signatureData['x-amz-date'];
        
        const queryString = Object.keys(queryParams)
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
            .join('&');
        
        const response = await axios.get(`${config.endpoint}${path}?${queryString}`, {
            headers,
            timeout: 10000
        });
        
        return response.data;
    } catch (error) {
        console.error(`❌ Error getting my offers for ${asin}:`, error.response?.status, error.response?.data || error.message);
        return null;
    }
}

// Check Buy Box ownership for an ASIN
async function checkBuyBoxOwnership(accessToken, asin, yourSellerId) {
    console.log(`\n🔍 Checking Buy Box ownership for ASIN: ${asin}`);
    console.log('═'.repeat(60));
    
    try {
        // Get competitive pricing data
        const pricingData = await getCompetitivePricing(accessToken, asin);
        
        if (!pricingData || !pricingData.payload) {
            console.log('❌ No pricing data available for this ASIN');
            return null;
        }
        
        const offers = pricingData.payload.Offers || [];
        
        if (offers.length === 0) {
            console.log('❌ No offers found for this ASIN');
            return null;
        }
        
        console.log(`📊 Found ${offers.length} offer(s)`);
        
        // Analyze offers
        let buyBoxWinner = null;
        let yourOffers = [];
        let otherOffers = [];
        
        offers.forEach((offer, index) => {
            const sellerId = offer.SellerId || 'Unknown';
            const listingPrice = offer.ListingPrice;
            const shipping = offer.Shipping;
            const totalPrice = listingPrice.Amount + (shipping ? shipping.Amount : 0);
            
            const offerInfo = {
                index: index + 1,
                sellerId: sellerId,
                price: listingPrice.Amount,
                currency: listingPrice.CurrencyCode,
                condition: offer.SubCondition,
                fulfillment: offer.IsFulfilledByAmazon ? 'FBA' : 'FBM',
                totalPrice: totalPrice,
                shippingPrice: shipping ? shipping.Amount : 0,
                isBuyBox: offer.IsBuyBoxWinner || false,
                primeEligible: offer.PrimeInformation?.IsOfferPrime || false,
                merchantShipping: offer.MerchantShippingGroup || 'Standard'
            };
            
            if (offer.IsBuyBoxWinner) {
                buyBoxWinner = offerInfo;
            }
            
            if (sellerId === yourSellerId) {
                yourOffers.push(offerInfo);
            } else {
                otherOffers.push(offerInfo);
            }
        });
        
        // Display results
        console.log('\n🏆 BUY BOX ANALYSIS');
        console.log('─'.repeat(40));
        
        if (buyBoxWinner) {
            const isYours = buyBoxWinner.sellerId === yourSellerId;
            console.log(`Buy Box Winner: ${isYours ? '✅ YOU!' : '❌ Competitor'}`);
            console.log(`💰 Price: ${buyBoxWinner.price} ${buyBoxWinner.currency}`);
            console.log(`🚚 Shipping: ${buyBoxWinner.shippingPrice} ${buyBoxWinner.currency}`);
            console.log(`📦 Fulfillment: ${buyBoxWinner.fulfillment}`);
            console.log(`⭐ Prime: ${buyBoxWinner.primeEligible ? 'Yes' : 'No'}`);
            
            if (!isYours) {
                console.log(`🆔 Winner Seller ID: ${buyBoxWinner.sellerId}`);
            }
        } else {
            console.log('❌ No Buy Box winner found');
        }
        
        // Display your offers
        console.log('\n🏪 YOUR OFFERS');
        console.log('─'.repeat(40));
        
        if (yourOffers.length === 0) {
            console.log('❌ You have no offers for this ASIN');
        } else {
            yourOffers.forEach(offer => {
                const buyBoxStatus = offer.isBuyBox ? ' 🏆 BUY BOX' : '';
                console.log(`${offer.index}. ${offer.price} ${offer.currency} (${offer.condition}) - ${offer.fulfillment}${buyBoxStatus}`);
                console.log(`   🚚 Shipping: ${offer.shippingPrice} ${offer.currency}`);
                console.log(`   ⭐ Prime: ${offer.primeEligible ? 'Yes' : 'No'}`);
            });
        }
        
        // Display competitor offers
        console.log('\n🏬 COMPETITOR OFFERS');
        console.log('─'.repeat(40));
        
        if (otherOffers.length === 0) {
            console.log('ℹ️  No competitor offers found');
        } else {
            // Sort by price
            otherOffers.sort((a, b) => a.totalPrice - b.totalPrice);
            
            otherOffers.forEach(offer => {
                const buyBoxStatus = offer.isBuyBox ? ' 🏆 BUY BOX' : '';
                console.log(`${offer.index}. ${offer.price} ${offer.currency} (${offer.condition}) - ${offer.fulfillment}${buyBoxStatus}`);
                console.log(`   🚚 Shipping: ${offer.shippingPrice} ${offer.currency}`);
                console.log(`   ⭐ Prime: ${offer.primeEligible ? 'Yes' : 'No'}`);
                console.log(`   🆔 Seller: ${offer.sellerId.substring(0, 8)}...`);
            });
        }
        
        // Summary and recommendations
        console.log('\n📋 SUMMARY & RECOMMENDATIONS');
        console.log('─'.repeat(40));
        
        const youHaveBuyBox = yourOffers.some(offer => offer.isBuyBox);
        
        if (youHaveBuyBox) {
            console.log('✅ Congratulations! You own the Buy Box');
            console.log('💡 Keep monitoring competitor prices to maintain your position');
        } else if (yourOffers.length === 0) {
            console.log('❌ You have no offers for this ASIN');
            console.log('💡 Consider adding this product to your inventory');
        } else {
            console.log('❌ You do not own the Buy Box');
            
            if (buyBoxWinner) {
                const priceDifference = yourOffers[0].totalPrice - buyBoxWinner.totalPrice;
                console.log(`💰 Price gap: ${priceDifference.toFixed(2)} ${buyBoxWinner.currency}`);
                
                if (priceDifference > 0) {
                    console.log('💡 Consider lowering your price to compete');
                } else {
                    console.log('💡 Price is competitive - check fulfillment method and seller metrics');
                }
                
                if (buyBoxWinner.fulfillment === 'FBA' && yourOffers[0].fulfillment === 'FBM') {
                    console.log('📦 Consider using FBA for better Buy Box chances');
                }
            }
        }
        
        return {
            asin: asin,
            youHaveBuyBox: youHaveBuyBox,
            yourOffers: yourOffers,
            buyBoxWinner: buyBoxWinner,
            totalOffers: offers.length,
            competitorOffers: otherOffers.length
        };
        
    } catch (error) {
        console.error('❌ Error checking Buy Box ownership:', error.message);
        return null;
    }
}

// Main execution
async function main() {
    console.log('🏆 Amazon Buy Box Ownership Checker');
    console.log('═'.repeat(60));
    
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('❌ Please provide at least one ASIN');
        console.log('\nUsage:');
        console.log('  node check-buy-box-ownership.js B0104R0FRG');
        console.log('  node check-buy-box-ownership.js ASIN1 ASIN2 ASIN3');
        process.exit(1);
    }
    
    // Validate configuration
    const requiredEnvVars = [
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
        'AMAZON_REFRESH_TOKEN',
        'AMAZON_CLIENT_ID',
        'AMAZON_CLIENT_SECRET'
    ];
    
    const missing = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:', missing.join(', '));
        process.exit(1);
    }
    
    const asins = args.filter(arg => !arg.startsWith('--'));
    
    console.log(`🌍 Marketplace: ${config.marketplace}`);
    console.log(`📦 Checking ${asins.length} ASIN(s): ${asins.join(', ')}`);
    
    try {
        const accessToken = await getAccessToken();
        
        // Get your seller ID
        console.log('\n🔍 Getting your seller information...');
        const sellerInfo = await getSellerInfo(accessToken);
        
        if (!sellerInfo || !sellerInfo.payload) {
            console.error('❌ Could not retrieve seller information');
            process.exit(1);
        }
        
        const yourSellerId = sellerInfo.payload[0]?.sellerId;
        
        if (!yourSellerId) {
            console.error('❌ Could not determine your seller ID');
            process.exit(1);
        }
        
        console.log(`✅ Your Seller ID: ${yourSellerId}`);
        
        const results = [];
        
        // Check each ASIN
        for (const asin of asins) {
            const result = await checkBuyBoxOwnership(accessToken, asin, yourSellerId);
            if (result) {
                results.push(result);
            }
            
            // Rate limiting between requests
            if (asins.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }
        
        // Final summary
        console.log('\n📊 FINAL SUMMARY');
        console.log('═'.repeat(60));
        
        if (results.length === 0) {
            console.log('❌ No results obtained');
        } else {
            const buyBoxCount = results.filter(r => r.youHaveBuyBox).length;
            const totalASINs = results.length;
            
            console.log(`🏆 Buy Box Ownership: ${buyBoxCount}/${totalASINs} ASINs`);
            console.log(`📊 Success Rate: ${((buyBoxCount / totalASINs) * 100).toFixed(1)}%`);
            
            console.log('\n📋 Detailed Results:');
            results.forEach(result => {
                const status = result.youHaveBuyBox ? '✅ YOU WIN' : '❌ COMPETITOR';
                console.log(`   ${result.asin}: ${status} (${result.totalOffers} offers)`);
            });
        }
        
        console.log('\n🎉 Buy Box check completed!');
        
    } catch (error) {
        console.error('❌ Error during execution:', error.message);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { checkBuyBoxOwnership, getSellerInfo };
