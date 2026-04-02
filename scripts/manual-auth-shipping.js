const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function run() {
    const authDir = path.join(__dirname, '.auth');
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir);
    const authFile = path.join(authDir, 'amazon-shipping.json');

    console.log('--- Amazon Shipping Manual Login Tool ---');
    console.log('1. A non-headless browser will open.');
    console.log('2. Log in to Amazon Shipping (ship.amazon.co.uk).');
    console.log('3. Complete any 2FA/OTPs requested.');
    console.log('4. Once you are on the dashboard/tracking page, CLOSE THE BROWSER.');
    console.log('5. Your session will be saved to .auth/amazon-shipping.json for the orchestrator.');

    const browser = await chromium.launch({ 
        headless: false,
        channel: 'chrome' // Use system chrome
    });

    // Check if we have an existing session to resume
    let options = {
        viewport: { width: 1280, height: 800 }
    };
    if (fs.existsSync(authFile)) {
        console.log('Loading existing session to refresh...');
        options.storageState = authFile;
    }

    const context = await browser.newContext(options);
    const page = await context.newPage();

    console.log('Navigating to Amazon Shipping...');
    await page.goto('https://ship.amazon.co.uk/tracking');

    // Wait for the browser to be closed by the user
    browser.on('disconnected', async () => {
        console.log('Browser closed. Saving state...');
        try {
            await context.storageState({ path: authFile });
            console.log(`SUCCESS: Session saved to ${authFile}`);
            process.exit(0);
        } catch (err) {
            console.error('Failed to save state:', err.message);
            process.exit(1);
        }
    });
}

run().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
