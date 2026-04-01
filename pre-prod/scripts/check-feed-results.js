#!/usr/bin/env node

/**
 * Amazon Feed Status Checker
 * Checks the detailed results of feed submissions to verify price changes
 */

import { AmazonFeedsAPI } from '../src/lib/services/amazon-feeds-api.js';

class FeedStatusChecker {
  constructor() {
    this.amazonAPI = new AmazonFeedsAPI({
      environment: 'production'
    });
  }

  async checkFeedStatus(feedId, includeResults = true) {
    try {
      console.log(`🔍 Checking status for Feed ID: ${feedId}`);
      console.log('═'.repeat(60));

      // Get access token
      const token = await this.amazonAPI.getAccessToken();

      // Get feed status
      const feedStatus = await this.amazonAPI.getFeedStatus(token, feedId);

      console.log('📊 Feed Processing Summary:');
      console.log(`   📋 Feed ID: ${feedStatus.feedId}`);
      console.log(`   📅 Created: ${new Date(feedStatus.createdTime).toLocaleString()}`);
      console.log(`   🚀 Started: ${new Date(feedStatus.processingStartTime).toLocaleString()}`);
      console.log(`   ✅ Finished: ${new Date(feedStatus.processingEndTime).toLocaleString()}`);
      console.log(`   ⏱️ Duration: ${Math.round((new Date(feedStatus.processingEndTime) - new Date(feedStatus.processingStartTime)) / 1000)}s`);
      console.log(`   📊 Status: ${feedStatus.processingStatus}`);
      console.log(`   🌍 Marketplace: ${feedStatus.marketplaceIds.join(', ')}`);
      console.log(`   📄 Feed Type: ${feedStatus.feedType}`);

      if (feedStatus.processingStatus === 'DONE') {
        console.log('\n✅ Feed processed successfully!');

        if (feedStatus.resultFeedDocumentId && includeResults) {
          console.log('\n🔍 Checking for detailed results...');
          await this.getFeedResults(token, feedStatus.resultFeedDocumentId);
        }
      } else {
        console.log(`\n⚠️ Feed status: ${feedStatus.processingStatus}`);
        console.log('   Feed may still be processing or encountered issues.');
      }

      return feedStatus;

    } catch (error) {
      console.error('❌ Error checking feed status:', error.message);
      throw error;
    }
  }

  async getFeedResults(token, resultDocumentId) {
    try {
      // Get the result document URL
      const docResponse = await fetch(
        `https://sellingpartnerapi-eu.amazon.com/feeds/2021-06-30/documents/${resultDocumentId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-amz-access-token': token,
            'Accept': 'application/json'
          }
        }
      );

      if (!docResponse.ok) {
        throw new Error(`Failed to get result document: ${docResponse.status} ${docResponse.statusText}`);
      }

      const docData = await docResponse.json();

      // Download the actual results
      const resultsResponse = await fetch(docData.url);
      const resultsText = await resultsResponse.text();

      console.log('\n📄 Feed Processing Results:');
      console.log('─'.repeat(40));

      try {
        const results = JSON.parse(resultsText);
        if (results.messages && results.messages.length > 0) {
          results.messages.forEach((message, index) => {
            console.log(`\n📦 Item ${index + 1}:`);
            console.log(`   🔑 Message ID: ${message.messageId || 'N/A'}`);
            console.log(`   📊 Status: ${message.processingStatus || 'Unknown'}`);

            if (message.processingResult && message.processingResult.status) {
              console.log(`   ✅ Result: ${message.processingResult.status}`);
            }

            if (message.processingResult && message.processingResult.issues) {
              message.processingResult.issues.forEach(issue => {
                console.log(`   ⚠️ Issue: ${issue.message} (${issue.severity})`);
              });
            }
          });
        } else {
          console.log('   ✅ No issues reported - successful processing!');
        }
      } catch (parseError) {
        console.log('   📄 Raw results:');
        console.log(resultsText);
      }

    } catch (error) {
      console.log(`   ⚠️ Could not retrieve detailed results: ${error.message}`);
    }
  }

  async checkRecentFeeds(limit = 5) {
    try {
      console.log(`📋 Checking last ${limit} feeds...`);
      console.log('═'.repeat(60));

      const token = await this.amazonAPI.getAccessToken();

      const response = await fetch(
        `https://sellingpartnerapi-eu.amazon.com/feeds/2021-06-30/feeds?maxResults=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-amz-access-token': token,
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get feeds: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.feeds && data.feeds.length > 0) {
        console.log('\n📊 Recent Feed History:');
        data.feeds.forEach((feed, index) => {
          console.log(`\n${index + 1}. Feed ID: ${feed.feedId}`);
          console.log(`   📅 Created: ${new Date(feed.createdTime).toLocaleString()}`);
          console.log(`   📊 Status: ${feed.processingStatus}`);
          console.log(`   📄 Type: ${feed.feedType}`);
          if (feed.processingEndTime) {
            console.log(`   ✅ Completed: ${new Date(feed.processingEndTime).toLocaleString()}`);
          }
        });
      } else {
        console.log('   No recent feeds found.');
      }

    } catch (error) {
      console.error('❌ Error checking recent feeds:', error.message);
    }
  }
}

// Main execution
async function main() {
  const checker = new FeedStatusChecker();

  const args = process.argv.slice(2);
  const feedId = args[0];

  if (feedId) {
    // Check specific feed
    await checker.checkFeedStatus(feedId);
  } else {
    // Check recent feeds
    console.log('🔍 No Feed ID provided, checking recent feeds...\n');
    await checker.checkRecentFeeds();

    console.log('\n💡 Usage: node check-feed-results.js [FEED_ID]');
    console.log('   Example: node check-feed-results.js 288225020304');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { FeedStatusChecker };
