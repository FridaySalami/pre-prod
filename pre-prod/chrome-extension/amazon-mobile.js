/**
 * Content Script for Amazon Pages
 * Forces mobile view by injecting viewport and CSS modifications
 */

console.log('📱 Amazon Mobile View Injector loaded');

// Only run on Amazon pages
if (window.location.hostname.includes('amazon.co.uk')) {
  initializeMobileView();
}

function initializeMobileView() {
  console.log('🔧 Initializing mobile view for Amazon');

  // Method 1: Add mobile viewport meta tag
  addMobileViewport();

  // Method 2: Inject mobile CSS
  injectMobileCSS();

  // Method 3: Modify page layout
  modifyPageLayout();

  // Method 4: Set mobile user agent flag
  setMobileFlag();
}

function addMobileViewport() {
  // Remove existing viewport tags
  const existingViewports = document.querySelectorAll('meta[name="viewport"]');
  existingViewports.forEach(tag => tag.remove());

  // Add mobile viewport
  const viewport = document.createElement('meta');
  viewport.name = 'viewport';
  viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
  document.head.appendChild(viewport);

  console.log('✅ Mobile viewport added');
}

function injectMobileCSS() {
  const mobileCSS = `
    /* Force mobile layout */
    body {
      max-width: 480px !important;
      margin: 0 auto !important;
    }
    
    /* Hide desktop-specific elements */
    #navbar, 
    #nav-belt,
    .nav-desktop,
    .desktop-only,
    #rhf {
      display: none !important;
    }
    
    /* Make mobile-friendly adjustments */
    #dpx-aplus_feature_div,
    #feature-bullets,
    #productDetails_feature_div {
      max-width: 100% !important;
      padding: 10px !important;
    }
    
    /* Simplify product images */
    #imgTagWrapperId img,
    .a-dynamic-image {
      max-width: 100% !important;
      height: auto !important;
    }
    
    /* Mobile-friendly typography */
    h1, h2, h3 {
      font-size: 1.2em !important;
      line-height: 1.3 !important;
    }
    
    /* Simplify product details */
    #productDetails_detailBullets_sections1,
    #productDetails_techSpec_section_1 {
      font-size: 0.9em !important;
    }
    
    /* Hide complex features for cleaner mobile view */
    #askATFLink,
    #social-share_feature_div,
    #reviews-medley-footer,
    .a-carousel-container {
      display: none !important;
    }
    
    /* Mobile buy box */
    #desktop_buybox,
    #buybox {
      max-width: 100% !important;
      margin: 10px 0 !important;
    }
  `;

  const style = document.createElement('style');
  style.textContent = mobileCSS;
  document.head.appendChild(style);

  console.log('✅ Mobile CSS injected');
}

function modifyPageLayout() {
  // Wait for DOM to be ready
  setTimeout(() => {
    // Force mobile class on body
    document.body.classList.add('a-mobile', 'a-touch');
    document.documentElement.classList.add('a-mobile', 'a-touch');

    // Remove desktop classes
    document.body.classList.remove('a-desktop');
    document.documentElement.classList.remove('a-desktop');

    // Set data attributes for mobile
    document.body.setAttribute('data-mobile', 'true');

    console.log('✅ Page layout modified for mobile');
  }, 500);
}

function setMobileFlag() {
  // Set window properties that Amazon might check
  if (typeof window !== 'undefined') {
    window.isMobile = true;
    window.innerWidth = 375; // iPhone width

    // Override screen properties
    Object.defineProperty(screen, 'width', { value: 375 });
    Object.defineProperty(screen, 'height', { value: 667 });

    console.log('✅ Mobile flags set');
  }
}

// Listen for page changes (SPA navigation)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    console.log('📱 Page changed, re-applying mobile view');
    setTimeout(initializeMobileView, 100);
  }
}).observe(document, { subtree: true, childList: true });

console.log('📱 Amazon mobile view setup complete');