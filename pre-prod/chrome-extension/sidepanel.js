/**
 * Side Panel Script for Buy Box Viewer Extension
 * Handles Amazon page display and product data management
 */

console.log('📱 Buy Box Viewer Side Panel loaded');

// DOM elements
let productInfo, productTitle, productAsin, productPrice;
let loadingEl, noDataEl, errorEl, amazonFrame;
let refreshBtn, openNewTabBtn;

// State
let currentProductData = null;
let frameLoaded = false;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎯 Side panel DOM ready');
  initializeElements();
  setupEventListeners();
  requestProductData();
});

function initializeElements() {
  // Get DOM references
  productInfo = document.getElementById('product-info');
  productTitle = document.getElementById('product-title');
  productAsin = document.getElementById('product-asin');
  productPrice = document.getElementById('product-price');

  loadingEl = document.getElementById('loading');
  noDataEl = document.getElementById('no-data');
  errorEl = document.getElementById('error');
  amazonFrame = document.getElementById('amazon-frame');

  refreshBtn = document.getElementById('refresh-btn');
  openNewTabBtn = document.getElementById('open-new-tab');

  console.log('✅ DOM elements initialized');
}

function setupEventListeners() {
  // Refresh button
  refreshBtn.addEventListener('click', () => {
    console.log('🔄 Refresh clicked');
    if (currentProductData) {
      loadAmazonPage(currentProductData);
    } else {
      requestProductData();
    }
  });

  // Amazon frame load events
  amazonFrame.addEventListener('load', () => {
    console.log('✅ Amazon frame loaded successfully');
    frameLoaded = true;
    showFrame();
  });

  amazonFrame.addEventListener('error', (e) => {
    console.error('❌ Amazon frame load error:', e);
    showError('Failed to load Amazon page. The page may be blocking iframe access.');
  });

  // Listen for background messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Side panel received message:', message);

    if (message.action === 'loadAmazonPage') {
      loadAmazonPage(message.data);
    } else if (message.action === 'loadProductInfo') {
      loadProductInfo(message.data, message.amazonUrl);
    }

    sendResponse({ success: true });
  });

  console.log('🎧 Event listeners setup complete');
}

function requestProductData() {
  console.log('📞 Requesting product data from background');

  chrome.runtime.sendMessage({ action: 'getSidePanelData' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('❌ Error getting product data:', chrome.runtime.lastError);
      showNoData();
      return;
    }

    console.log('📦 Received product data:', response);

    if (response && response.productData) {
      loadAmazonPage(response.productData);
    } else {
      showNoData();
    }
  });
}

function loadAmazonPage(productData) {
  console.log('🚀 Loading Amazon page for:', productData);

  currentProductData = productData;
  frameLoaded = false;

  // Update product info
  updateProductInfo(productData);

  // Show loading state
  showLoading();

  // Build Amazon URL
  const amazonUrl = buildAmazonUrl(productData.asin);
  console.log('🔗 Amazon URL:', amazonUrl);

  // Update open in new tab link
  openNewTabBtn.href = amazonUrl;
  openNewTabBtn.style.display = 'inline-flex';

  // Load in iframe with timeout
  setTimeout(() => {
    amazonFrame.src = amazonUrl;

    // Fallback timeout in case iframe doesn't load
    setTimeout(() => {
      if (!frameLoaded) {
        console.log('⏱️ Frame load timeout, showing fallback');
        showError('Amazon page is taking too long to load. Try opening in a new tab.');
      }
    }, 10000); // 10 second timeout
  }, 100);
}

function loadProductInfo(productData, amazonUrl) {
  console.log('📦 Loading product info (no iframe):', productData);

  currentProductData = productData;
  frameLoaded = false;

  // Update product info
  updateProductInfo(productData);

  // Update open in new tab link
  openNewTabBtn.href = amazonUrl;
  openNewTabBtn.style.display = 'inline-flex';

  // Show a message instead of iframe
  showProductInfoMessage(amazonUrl);
}

function showProductInfoMessage(amazonUrl) {
  hideAllStates();

  const messageContainer = document.createElement('div');
  messageContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 20px;
    text-align: center;
    color: #64748b;
    font-size: 14px;
    line-height: 1.5;
  `;

  messageContainer.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">🛒</div>
    <div style="font-weight: 600; margin-bottom: 8px; color: #1e293b;">Amazon Page Opened</div>
    <div style="margin-bottom: 16px;">The Amazon product page has been opened in a new tab.</div>
    <div style="font-size: 12px; opacity: 0.7;">Amazon blocks iframe embedding for security, so we open pages directly in new tabs for the best experience.</div>
  `;

  // Replace iframe container content
  const iframeContainer = document.querySelector('.iframe-container');
  iframeContainer.innerHTML = '';
  iframeContainer.appendChild(messageContainer);
}

function updateProductInfo(data) {
  productTitle.textContent = data.title || 'Product Details';
  productAsin.textContent = data.asin || 'N/A';
  productPrice.textContent = data.price || 'N/A';
  productInfo.style.display = 'block';

  console.log('ℹ️ Product info updated:', data);
}

function buildAmazonUrl(asin) {
  // Use mobile Amazon for better iframe compatibility
  const baseUrl = 'https://amazon.co.uk';
  return `${baseUrl}/dp/${asin}?ref=buybox_viewer&m=mobile`;
}

function showLoading() {
  hideAllStates();
  loadingEl.style.display = 'flex';
  loadingEl.innerHTML = '<div class="status-indicator"></div>Loading Amazon page...';
}

function showNoData() {
  hideAllStates();
  noDataEl.style.display = 'flex';
  productInfo.style.display = 'none';
  openNewTabBtn.style.display = 'none';
}

function showError(message) {
  hideAllStates();
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

function showFrame() {
  hideAllStates();
  amazonFrame.style.display = 'block';
}

function hideAllStates() {
  loadingEl.style.display = 'none';
  noDataEl.style.display = 'none';
  errorEl.style.display = 'none';
  amazonFrame.style.display = 'none';
}

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    console.log('👁️ Side panel became visible');
    // Request fresh data when panel becomes visible
    requestProductData();
  }
});

console.log('📱 Side panel script initialized');