// Quick feed status checker for immediate results
import dotenv from 'dotenv';

dotenv.config();

async function checkFeedStatus(feedId) {
  try {
    console.log(`🔍 Checking status of feed: ${feedId}\n`);

    // Get access token
    const tokenResponse = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: process.env.AMAZON_REFRESH_TOKEN,
        client_id: process.env.AMAZON_CLIENT_ID,
        client_secret: process.env.AMAZON_CLIENT_SECRET
      })
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token request failed: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const token = tokenData.access_token;

    // Get feed status
    const feedResponse = await fetch(
      `https://sellingpartnerapi-eu.amazon.com/feeds/2021-06-30/feeds/${feedId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-amz-access-token': token,
          'Accept': 'application/json'
        }
      }
    );

    if (!feedResponse.ok) {
      throw new Error(`Feed status request failed: ${feedResponse.status}`);
    }

    const feedStatus = await feedResponse.json();

    console.log('📊 Feed Status Details:');
    console.log(`   🆔 Feed ID: ${feedStatus.feedId}`);
    console.log(`   📋 Feed Type: ${feedStatus.feedType}`);
    console.log(`   🔄 Processing Status: ${feedStatus.processingStatus}`);
    console.log(`   ⏰ Created At: ${new Date(feedStatus.createdTime).toLocaleString()}`);
    console.log(`   🕐 Started Processing: ${feedStatus.processingStartTime ? new Date(feedStatus.processingStartTime).toLocaleString() : 'Not started'}`);
    console.log(`   ✅ Finished Processing: ${feedStatus.processingEndTime ? new Date(feedStatus.processingEndTime).toLocaleString() : 'Not finished'}`);

    if (feedStatus.resultFeedDocumentId) {
      console.log(`   📄 Result Document ID: ${feedStatus.resultFeedDocumentId}`);
    } else {
      console.log(`   📄 Result Document: Not available yet`);
    }

    // Status interpretation
    console.log('\n🔍 Status Interpretation:');
    switch (feedStatus.processingStatus) {
      case 'SUBMITTED':
        console.log('   ⏳ Feed has been submitted and is waiting to be processed');
        break;
      case 'IN_QUEUE':
        console.log('   📋 Feed is in the processing queue');
        break;
      case 'IN_PROGRESS':
        console.log('   🔄 Feed is currently being processed by Amazon');
        break;
      case 'DONE':
        console.log('   ✅ Feed processing completed successfully!');
        break;
      case 'CANCELLED':
        console.log('   ❌ Feed processing was cancelled');
        break;
      case 'FATAL':
        console.log('   💀 Feed processing failed with fatal error');
        break;
      default:
        console.log(`   ❓ Unknown status: ${feedStatus.processingStatus}`);
    }

    return feedStatus;

  } catch (error) {
    console.error('❌ Error checking feed status:', error);
  }
}

// Get feed ID from command line
const feedId = process.argv[2];
if (!feedId) {
  console.log('❌ Please provide a feed ID');
  console.log('Usage: node quick-feed-check.js <feedId>');
  process.exit(1);
}

checkFeedStatus(feedId);
