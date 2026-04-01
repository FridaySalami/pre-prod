import AmazonFeedsAPI from '../src/lib/services/amazon-feeds-api.js';
import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

const feedsAPI = new AmazonFeedsAPI();

async function checkFeedResult(feedId) {
  try {
    console.log(`🔍 Checking Feed Result for ID: ${feedId}`);

    // Get access token
    const token = await feedsAPI.getAccessToken();

    // Get feed status
    const feedStatus = await feedsAPI.getFeedStatus(token, feedId);
    console.log('📊 Feed Status:', JSON.stringify(feedStatus, null, 2));

    if (feedStatus.processingStatus !== 'DONE') {
      console.log(`⏳ Feed is still processing. Status: ${feedStatus.processingStatus}`);
      return;
    }

    if (!feedStatus.resultFeedDocumentId) {
      console.log('❌ No result document found');
      return;
    }

    // Get result document
    const resultDocResponse = await fetch(`${feedsAPI.config.endpoint}/feeds/2021-06-30/documents/${feedStatus.resultFeedDocumentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-amz-access-token': token,
        'Accept': 'application/json'
      }
    });

    if (!resultDocResponse.ok) {
      throw new Error(`Failed to get result document: ${resultDocResponse.status}`);
    }

    const resultDoc = await resultDocResponse.json();
    console.log('📄 Result Document Info:', JSON.stringify(resultDoc, null, 2));

    // Download and decompress result
    const contentResponse = await fetch(resultDoc.url);
    if (!contentResponse.ok) {
      throw new Error(`Failed to download result content: ${contentResponse.status}`);
    }

    const buffer = await contentResponse.arrayBuffer();

    if (resultDoc.compressionAlgorithm === 'GZIP') {
      console.log('📥 Decompressing GZIP content...');
      const decompressed = await gunzip(Buffer.from(buffer));
      const content = decompressed.toString('utf-8');
      console.log('📋 DECOMPRESSED RESULT:');
      console.log('---START RESULT---');
      console.log(content);
      console.log('---END RESULT---');
    } else {
      const content = Buffer.from(buffer).toString('utf-8');
      console.log('📋 RESULT CONTENT:');
      console.log('---START RESULT---');
      console.log(content);
      console.log('---END RESULT---');
    }

  } catch (error) {
    console.error('❌ Error checking feed result:', error);
  }
}

// Get feed ID from command line or use default
const feedId = process.argv[2] || '288278020305';
checkFeedResult(feedId);
