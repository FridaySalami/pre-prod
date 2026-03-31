const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const secret = "c190c473e2996bafa89d02dfc18225cd858a4371f23eaefa588a499d0b5540f1"; 
const url = "https://operations.chefstorecookbook.com/api/amazon/orders/sync-items?stream=false";

const logFile = path.join(__dirname, 'sync.log');
const log = (msg) => {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${msg}\n`;
  console.log(entry.trim());
  fs.appendFileSync(logFile, entry);
};

async function runJob() {
  log('--- Starting Sync Cycle ---');
  
  try {
    const response = await axios({
      url: url,
      method: "GET",
      headers: {
        Authorization: `Bearer ${secret}`,
        Accept: "application/json"
      },
      timeout: 300000 
    });

    log(`Job completed successfully.`);
    log(`Next run in 1 hour...`);
  } catch (error) {
    log(`Job failed: ${error.message}`);
    if (error.response) {
      log(`Status: ${error.response.status}`);
    }
  }
}

// Initial run
runJob();

// Schedule recurring runs
setInterval(runJob, INTERVAL_MS);

console.log('CRON SERVICE ACTIVE');
console.log(`Frequency: Every ${INTERVAL_MS / 1000 / 60} minutes`);
console.log('Keep this window open to maintain the schedule.');
