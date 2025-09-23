/**
 * Popup Script for Buy Box Viewer Extension
 * Handles quick Amazon page preview in popup window
 */

console.log('🔧 Buy Box Viewer Popup loaded');

// DOM elements
let productInfo, productTitle, productAsin, productPrice;
let loadingEl, noDataEl, errorEl, amazonFrame;
let refreshBtn, openNewTabBtn, quickActions;
let viewMobileBtn, viewDesktopBtn, openSellerBtn;

// State
let currentProductData = null;
let frameLoaded = false;
let currentView = 'mobile'; // 'mobile' or 'desktop'

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎯 Popup DOM ready');
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
  quickActions = document.getElementById('quick-actions');

  refreshBtn = document.getElementById('refresh-btn');
  openNewTabBtn = document.getElementById('open-new-tab');

  viewMobileBtn = document.getElementById('view-mobile');
  viewDesktopBtn = document.getElementById('view-desktop');
  openSellerBtn = document.getElementById('open-seller');

  console.log('✅ Popup DOM elements initialized');
}

function setupEventListeners() {
  // Refresh button
  refreshBtn.addEventListener('click', () => {
    console.log('🔄 Refresh clicked');
    if (currentProductData) {
      // Just open in new tab directly
      const amazonUrl = buildAmazonUrl(currentProductData.asin, currentView);
      chrome.tabs.create({ url: amazonUrl, active: true });
    } else {
      requestProductData();
    }
  });

  // View mode buttons
  viewMobileBtn.addEventListener('click', () => {
    if (currentProductData) {
      currentView = 'mobile';
      updateViewButtons();
      const amazonUrl = buildAmazonUrl(currentProductData.asin, currentView);
      chrome.tabs.create({ url: amazonUrl, active: true });
    }
  });

  viewDesktopBtn.addEventListener('click', () => {
    if (currentProductData) {
      currentView = 'desktop';
      updateViewButtons();
      const amazonUrl = buildAmazonUrl(currentProductData.asin, currentView);
      chrome.tabs.create({ url: amazonUrl, active: true });
    }
  });

  // Open seller page
  openSellerBtn.addEventListener('click', () => {
    if (currentProductData && currentProductData.asin) {
      const sellerUrl = `https://amazon.co.uk/sp?seller=${currentProductData.sellerId || 'unknown'}`;
      chrome.tabs.create({ url: sellerUrl });
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
    showError('Failed to load Amazon page. Try opening in a new tab.');
  });

  console.log('🎧 Popup event listeners setup complete');
}

function updateViewButtons() {
  viewMobileBtn.style.background = currentView === 'mobile' ? '#e5e7eb' : 'white';
  viewDesktopBtn.style.background = currentView === 'desktop' ? '#e5e7eb' : 'white';
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
      loadAmazonPage(response.productData, currentView);
    } else {
      showNoData();
    }
  });
}

function loadAmazonPage(productData, viewMode = 'mobile') {
  console.log('🚀 Loading Amazon page for:', productData, 'View:', viewMode);

  currentProductData = productData;
  frameLoaded = false;

  // Update product info
  updateProductInfo(productData);

  // Show loading state
  showLoading();

  // Build Amazon URL
  const amazonUrl = buildAmazonUrl(productData.asin, viewMode);
  console.log('🔗 Amazon URL:', amazonUrl);

  // Update open in new tab link
  openNewTabBtn.href = amazonUrl;
  openNewTabBtn.style.display = 'inline-flex';

  // Show quick actions
  quickActions.style.display = 'block';
  updateViewButtons();

  // Load in iframe with timeout
  setTimeout(() => {
    amazonFrame.src = amazonUrl;

    // Fallback timeout in case iframe doesn't load
    setTimeout(() => {
      if (!frameLoaded) {
        console.log('⏱️ Frame load timeout, showing fallback');
        showError('Amazon page is taking too long to load. Try opening in a new tab or switching view mode.');
      }
    }, 8000); // 8 second timeout for popup
  }, 100);
}

function updateProductInfo(data) {
  productTitle.textContent = data.title || 'Product Details';
  productAsin.textContent = data.asin || 'N/A';
  productPrice.textContent = data.price || 'N/A';
  productInfo.style.display = 'block';

  console.log('ℹ️ Product info updated:', data);
}

function buildAmazonUrl(asin, viewMode = 'mobile') {
  const baseUrl = 'https://amazon.co.uk';

  if (viewMode === 'mobile') {
    return `${baseUrl}/dp/${asin}?ref=buybox_viewer&m=mobile`;
  } else {
    return `${baseUrl}/dp/${asin}?ref=buybox_viewer`;
  }
}

function showLoading() {
  hideAllStates();
  loadingEl.style.display = 'flex';
  loadingEl.innerHTML = '<div class="loading-icon">⏳</div><div>Loading Amazon page...</div>';
}

function showNoData() {
  hideAllStates();
  noDataEl.style.display = 'flex';
  productInfo.style.display = 'none';
  quickActions.style.display = 'none';
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

console.log('🔧 Popup script initialized');