/**
 * Content Script for Buy Box Manager Integration
 * Runs on your Buy Box Manager pages to detect product interactions
 */

console.log('🔌 Buy Box Viewer Extension loaded');

// Extension state
let isExtensionActive = true;
let currentHoverTimeout = null;

// Initialize extension when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}

function initializeExtension() {
  console.log('🚀 Initializing Buy Box Viewer on:', window.location.hostname);

  // Add visual indicator that extension is active
  addExtensionIndicator();

  // Set up event listeners
  setupProductInteractionListeners();

  // Listen for extension messages
  chrome.runtime.onMessage.addListener(handleExtensionMessages);
}

function addExtensionIndicator() {
  // Add a small indicator to show extension is active
  const indicator = document.createElement('div');
  indicator.id = 'buybox-viewer-indicator';
  indicator.innerHTML = '🔍 Buy Box Viewer Active';
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #1a73e8;
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    opacity: 0.8;
    pointer-events: none;
  `;

  document.body.appendChild(indicator);

  // Add restore window button
  addRestoreWindowButton();

  // Auto-hide after 3 seconds
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.style.opacity = '0';
      setTimeout(() => indicator.remove(), 300);
    }
  }, 3000);
}

function addRestoreWindowButton() {
  // Add a restore window button
  const restoreBtn = document.createElement('div');
  restoreBtn.id = 'buybox-restore-window';
  restoreBtn.innerHTML = '⬜ Restore Window';
  restoreBtn.style.cssText = `
    position: fixed;
    top: 50px;
    right: 10px;
    background: #059669;
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    cursor: pointer;
    opacity: 0.9;
    transition: opacity 0.2s;
  `;

  restoreBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'restoreWindowLayout' });
    restoreBtn.style.opacity = '0.5';
    setTimeout(() => {
      if (restoreBtn.parentNode) {
        restoreBtn.remove();
      }
    }, 1000);
  });

  restoreBtn.addEventListener('mouseenter', () => {
    restoreBtn.style.opacity = '1';
  });

  restoreBtn.addEventListener('mouseleave', () => {
    restoreBtn.style.opacity = '0.9';
  });

  document.body.appendChild(restoreBtn);

  // Auto-hide after 10 seconds
  setTimeout(() => {
    if (restoreBtn.parentNode) {
      restoreBtn.style.opacity = '0';
      setTimeout(() => restoreBtn.remove(), 300);
    }
  }, 10000);
}

function setupProductInteractionListeners() {
  // ONLY handle specific Amazon Preview buttons - no general click interception
  document.addEventListener('click', handlePreviewButtonClick, true);

  // Optional: Keep hover handler for Ctrl+hover quick preview (disabled by default)
  // document.addEventListener('mouseenter', handleProductHover, true);
  // document.addEventListener('mouseleave', handleProductHoverEnd, true);

  // Keyboard shortcuts (if needed)
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

function handlePreviewButtonClick(event) {
  // ONLY handle buttons with specific amazon-preview-btn class
  if (!event.target.matches('button.amazon-preview-btn')) {
    return; // Let all other clicks behave normally
  }

  // This is a preview button - intercept and handle with extension
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const button = event.target;

  // Prevent double-clicks
  if (button.disabled) return false;

  console.log('👁️ Preview button clicked:', button);

  const productData = {
    asin: button.dataset.asin,
    sku: button.dataset.sku,
    title: button.dataset.title,
    price: button.dataset.price
  };

  if (productData.asin) {
    console.log('👁️ Preview button data:', productData);

    // Disable button temporarily to prevent double-clicks
    button.disabled = true;
    setTimeout(() => button.disabled = false, 2000);

    // Send message to extension background script
    chrome.runtime.sendMessage({
      action: 'showAmazonPage',
      data: productData,
      displayMode: 'sidepanel',
      trigger: 'preview-button'
    }).catch(err => console.log('Extension message failed:', err));

    // Add visual feedback to button
    addButtonClickFeedback(button);
  }

  return false;
}

function handleProductHover(event) {
  // Only activate on Ctrl+hover to avoid accidental triggers
  if (!event.ctrlKey) return;

  const productData = extractProductData(event.target);

  if (productData) {
    console.log('🎯 Product hovered (with Ctrl):', productData);

    // Clear any existing timeout
    if (currentHoverTimeout) {
      clearTimeout(currentHoverTimeout);
    }

    // Delay to avoid accidental triggers
    currentHoverTimeout = setTimeout(() => {
      chrome.runtime.sendMessage({
        action: 'showAmazonPage',
        data: productData,
        displayMode: 'popup',
        trigger: 'hover'
      }).catch(err => console.log('Extension message failed:', err));
    }, 500);

    // Add visual feedback
    addHoverFeedback(event.target);
  }
}

function handleProductHoverEnd(event) {
  // Clear hover timeout
  if (currentHoverTimeout) {
    clearTimeout(currentHoverTimeout);
    currentHoverTimeout = null;
  }

  // Remove hover feedback
  removeHoverFeedback(event.target);
}

function extractProductData(element) {
  // Find the closest product container
  const productRow = element.closest('tr, [data-asin], .product-row, .buy-box-item');

  if (!productRow) return null;

  // Try multiple methods to extract ASIN
  let asin = null;
  let sku = null;
  let productName = null;

  // Method 1: Direct data attributes
  asin = productRow.dataset.asin || productRow.getAttribute('data-asin');
  sku = productRow.dataset.sku || productRow.getAttribute('data-sku');

  // Method 2: Search within the row for ASIN/SKU patterns
  if (!asin || !sku) {
    const rowText = productRow.textContent || '';

    // Look for ASIN pattern (B followed by 9 alphanumeric characters)
    const asinMatch = rowText.match(/B[0-9A-Z]{9}/);
    if (asinMatch) asin = asinMatch[0];

    // Look for SKU in table cells
    const cells = productRow.querySelectorAll('td');
    cells.forEach(cell => {
      const cellText = cell.textContent.trim();
      // Assume first non-price, non-numeric cell might be SKU
      if (!sku && cellText && !cellText.match(/^[£$€]\d/) && cellText.length > 3) {
        sku = cellText;
      }
    });
  }

  // Method 3: Look for product name
  const nameElement = productRow.querySelector('.product-name, .item-name, [data-product-name]');
  if (nameElement) {
    productName = nameElement.textContent.trim();
  }

  // Return data if we have at least an ASIN
  if (asin) {
    return {
      asin: asin,
      sku: sku,
      productName: productName,
      timestamp: Date.now()
    };
  }

  return null;
}

function addClickFeedback(element) {
  const feedback = document.createElement('div');
  feedback.innerHTML = '🔍 Opening Amazon...';
  feedback.style.cssText = `
    position: absolute;
    background: #34d399;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    z-index: 10001;
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  `;

  const rect = element.getBoundingClientRect();
  feedback.style.left = (rect.left + window.scrollX) + 'px';
  feedback.style.top = (rect.top + window.scrollY - 30) + 'px';

  document.body.appendChild(feedback);

  // Animate and remove
  setTimeout(() => {
    feedback.style.opacity = '0';
    feedback.style.transform = 'translateY(-10px)';
    feedback.style.transition = 'all 0.3s ease';
    setTimeout(() => feedback.remove(), 300);
  }, 1000);
}

function addHoverFeedback(element) {
  element.style.outline = '2px solid #1a73e8';
  element.style.backgroundColor = 'rgba(26, 115, 232, 0.1)';
  element.title = 'Ctrl+hover detected - Amazon preview loading...';
}

function removeHoverFeedback(element) {
  element.style.outline = '';
  element.style.backgroundColor = '';
  element.title = '';
}

function addButtonClickFeedback(button) {
  // Save original styles
  const originalText = button.textContent;
  const originalBackground = button.style.backgroundColor;

  // Show loading state
  button.textContent = '👁️ Opening...';
  button.style.backgroundColor = '#1a73e8';
  button.style.color = 'white';
  button.disabled = true;

  // Reset after animation
  setTimeout(() => {
    button.textContent = originalText;
    button.style.backgroundColor = originalBackground;
    button.style.color = '';
    button.disabled = false;
  }, 1500);
}

function handleKeyboardShortcuts(event) {
  // Ctrl+A to open Amazon page for currently selected/hovered product
  if (event.ctrlKey && event.key === 'a' && !event.shiftKey) {
    const hoveredElement = document.querySelector(':hover');
    if (hoveredElement) {
      const productData = extractProductData(hoveredElement);
      if (productData) {
        event.preventDefault();
        chrome.runtime.sendMessage({
          action: 'showAmazonPage',
          data: productData,
          displayMode: 'sidepanel',
          trigger: 'keyboard'
        }).catch(err => console.log('Extension message failed:', err));
      }
    }
  }
}

function handleExtensionMessages(message, sender, sendResponse) {
  console.log('📨 Extension message received:', message);

  switch (message.action) {
    case 'ping':
      sendResponse({ status: 'active', url: window.location.href });
      break;

    case 'toggleExtension':
      isExtensionActive = !isExtensionActive;
      console.log('🔄 Extension toggled:', isExtensionActive ? 'ON' : 'OFF');
      sendResponse({ active: isExtensionActive });
      break;

    case 'collapseSidebar':
      collapseSidebar();
      sendResponse({ success: true });
      break;

    case 'restoreSidebar':
      restoreSidebar();
      sendResponse({ success: true });
      break;

    case 'showRestoreButton':
      showRestoreButton();
      sendResponse({ success: true });
      break;

    case 'hideRestoreButton':
      hideRestoreButton();
      sendResponse({ success: true });
      break;

    default:
      console.log('❓ Unknown message action:', message.action);
  }

  return true; // Keep message channel open for async response
}

function collapseSidebar() {
  console.log('📱 Attempting to collapse sidebar for extension layout');

  // Method 1: Try to use the shadcn sidebar trigger (proper way)
  const sidebarTrigger = document.querySelector('[data-sidebar="trigger"]');
  if (sidebarTrigger) {
    console.log('🎯 Found shadcn sidebar trigger, checking current state');

    // Check if sidebar is currently expanded
    const sidebarProvider = document.querySelector('[data-state]');
    const isExpanded = sidebarProvider && (
      sidebarProvider.getAttribute('data-state') === 'expanded' ||
      sidebarProvider.getAttribute('data-state') === 'open'
    );

    if (isExpanded) {
      console.log('📱 Sidebar is expanded, triggering collapse');
      sidebarTrigger.click();
      console.log('✅ Sidebar collapsed using shadcn trigger');
      return true;
    } else {
      console.log('ℹ️ Sidebar already collapsed');
      return true;
    }
  }

  // Method 2: Look for any sidebar elements that might need collapsing
  const sidebarElements = document.querySelectorAll(
    '[data-slot="sidebar"], [class*="sidebar"], nav, aside'
  );

  for (const sidebar of sidebarElements) {
    // Check if this looks like a main sidebar (has significant width)
    if (sidebar.offsetWidth > 200) {
      console.log('📱 Found wide sidebar element, applying manual collapse');

      // Add extension-specific styling for manual collapse
      const style = document.createElement('style');
      style.id = 'extension-sidebar-collapse';
      style.textContent = `
        [data-slot="sidebar"][data-state="collapsed"],
        .extension-sidebar-collapsed {
          width: 60px !important;
          min-width: 60px !important;
          overflow: hidden !important;
          transition: width 0.3s ease !important;
        }
        
        [data-slot="sidebar"][data-state="collapsed"] .sidebar-content *,
        .extension-sidebar-collapsed * {
          white-space: nowrap !important;
          overflow: hidden !important;
        }
        
        [data-slot="sidebar"][data-state="collapsed"] [data-slot="sidebar-group-label"],
        [data-slot="sidebar"][data-state="collapsed"] .app-name,
        .extension-sidebar-collapsed .text, 
        .extension-sidebar-collapsed span:not([class*="icon"]),
        .extension-sidebar-collapsed p,
        .extension-sidebar-collapsed label {
          opacity: 0 !important;
          width: 0 !important;
          display: none !important;
        }
      `;

      if (!document.getElementById('extension-sidebar-collapse')) {
        document.head.appendChild(style);
      }

      sidebar.classList.add('extension-sidebar-collapsed');
      console.log('✅ Applied manual sidebar collapse');
      return true;
    }
  }

  console.log('ℹ️ No suitable sidebar found to collapse');
  return false;
}

function restoreSidebar() {
  console.log('📱 Restoring sidebar to normal width');

  // Method 1: Try to use the shadcn sidebar trigger (proper way)
  const sidebarTrigger = document.querySelector('[data-sidebar="trigger"]');
  if (sidebarTrigger) {
    console.log('🎯 Found shadcn sidebar trigger, checking current state');

    // Check if sidebar is currently collapsed
    const sidebarProvider = document.querySelector('[data-state]');
    const isCollapsed = sidebarProvider && (
      sidebarProvider.getAttribute('data-state') === 'collapsed' ||
      sidebarProvider.getAttribute('data-state') === 'closed'
    );

    if (isCollapsed) {
      console.log('📱 Sidebar is collapsed, triggering expand');
      sidebarTrigger.click();
      console.log('✅ Sidebar expanded using shadcn trigger');
    } else {
      console.log('ℹ️ Sidebar already expanded');
    }
  }

  // Method 2: Clean up any manual collapse styling
  const extensionStyle = document.getElementById('extension-sidebar-collapse');
  if (extensionStyle) {
    extensionStyle.remove();
    console.log('🧹 Removed extension collapse styles');
  }

  // Remove manual collapse classes
  const manuallyCollapsed = document.querySelectorAll('.extension-sidebar-collapsed');
  manuallyCollapsed.forEach(element => {
    element.classList.remove('extension-sidebar-collapsed');
    element.style.width = '';
    element.style.minWidth = '';
    element.style.overflow = '';
    element.style.transition = '';
  });

  console.log('✅ Sidebar restored to normal layout');
  return true;
}

function showRestoreButton() {
  console.log('🪟 Showing restore window button');

  // Show the restore button that was added to the layout
  const restoreBtn = document.getElementById('restore-window-btn');
  if (restoreBtn) {
    restoreBtn.style.display = 'inline-flex';
    console.log('✅ Restore button is now visible');
  } else {
    console.log('ℹ️ Restore button not found in DOM');
  }

  return true;
}

function hideRestoreButton() {
  console.log('🪟 Hiding restore window button');

  // Hide the restore button
  const restoreBtn = document.getElementById('restore-window-btn');
  if (restoreBtn) {
    restoreBtn.style.display = 'none';
    console.log('✅ Restore button is now hidden');
  } else {
    console.log('ℹ️ Restore button not found in DOM');
  }

  return true;
}