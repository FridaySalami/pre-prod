import zlib from 'zlib';
import { promisify } from 'util';
import dotenv from 'dotenv';

dotenv.config();

const gunzip = promisify(zlib.gunzip);

async function getAccessToken() {
  const response = await fetch('https://api.amazon.com/auth/o2/token', {
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

  if (!response.ok) {
    throw new Error(`Token request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function checkFeedResult(feedId) {
  try {
    console.log(`🔍 Checking Feed Result for ID: ${feedId}`);

    const token = await getAccessToken();
    const endpoint = 'https://sellingpartnerapi-eu.amazon.com';

    // Get feed status
    const feedResponse = await fetch(`${endpoint}/feeds/2021-06-30/feeds/${feedId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-amz-access-token': token,
        'Accept': 'application/json'
      }
    });

    if (!feedResponse.ok) {
      throw new Error(`Failed to get feed status: ${feedResponse.status}`);
    }

    const feedStatus = await feedResponse.json();
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
    const resultDocResponse = await fetch(`${endpoint}/feeds/2021-06-30/documents/${feedStatus.resultFeedDocumentId}`, {
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

      // Try to parse as JSON
      try {
        const jsonResult = JSON.parse(content);
        console.log('📊 PARSED JSON RESULT:');
        console.log(JSON.stringify(jsonResult, null, 2));
      } catch (e) {
        console.log('📝 Content is not JSON, showing as text above');
      }
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
