/**
 * Background Service Worker for Buy Box Viewer Extension
 * Handles communication between content script and side panel
 */

console.log('🔧 Buy Box Viewer Background Script loaded');

// Extension state
let currentProductData = null;
let sidePanelTabId = null;
let originalWindowState = null; // Store original window dimensions
let amazonWindowId = null; // Track existing Amazon window
let amazonTabId = null; // Track existing Amazon tab

// iPhone User Agent for mobile emulation
const UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

// Install/startup handler
chrome.runtime.onInstalled.addListener((details) => {
  console.log('🎉 Buy Box Viewer Extension installed/updated:', details.reason);

  // Enable side panel for all tabs by default
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Background received message:', message);

  switch (message.action) {
    case 'showAmazonPage':
      handleShowAmazonPage(message, sender.tab);
      sendResponse({ success: true });
      break;

    case 'getSidePanelData':
      sendResponse({
        productData: currentProductData,
        tabId: sidePanelTabId
      });
      break;

    case 'clearSidePanelData':
      currentProductData = null;
      sidePanelTabId = null;
      sendResponse({ success: true });
      break;

    case 'restoreWindowLayout':
      restoreOriginalWindow()
        .then(() => {
          console.log('✅ Restore completed successfully');
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('❌ Restore failed:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep message channel open for async response

    default:
      console.log('❓ Unknown background message:', message.action);
      sendResponse({ error: 'Unknown action' });
  }

  return true; // Keep message channel open
});

// Handle tab updates to clear data when navigating away
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && sidePanelTabId === tabId) {
    // Check if still on Buy Box Manager page
    if (!tab.url || (!tab.url.includes('localhost:5173') && !tab.url.includes('localhost:3000') && !tab.url.includes('buybox-manager'))) {
      console.log('📍 Navigated away from Buy Box Manager, clearing data');
      currentProductData = null;
      sidePanelTabId = null;
    }
  }
});

async function handleShowAmazonPage(message, tab) {
  const { data, displayMode, trigger } = message;

  console.log(`🎯 Showing Amazon page for ASIN: ${data.asin}, Mode: ${displayMode}, Trigger: ${trigger}`);

  // Store current product data
  currentProductData = data;
  sidePanelTabId = tab.id;

  try {
    const amazonUrl = buildAmazonUrl(data.asin);

    if (displayMode === 'sidepanel') {
      // Check if Amazon window already exists and is valid
      let reuseExistingWindow = false;
      if (amazonWindowId && amazonTabId) {
        try {
          // Check if the window and tab still exist
          const existingWindow = await chrome.windows.get(amazonWindowId);
          const existingTab = await chrome.tabs.get(amazonTabId);

          if (existingWindow && existingTab && !existingTab.discarded) {
            console.log('🔄 Reusing existing Amazon window - keeping mobile emulation');

            // Don't focus the Amazon window, just update the URL
            // Keep Buy Box Manager as the active window
            await chrome.tabs.update(amazonTabId, { url: amazonUrl, active: true });

            // Wait for page to complete loading
            await waitForTabComplete(amazonTabId);

            // Just trigger auto-scroll without reapplying mobile emulation
            await triggerAutoScroll(amazonTabId);

            // Ensure Buy Box Manager stays focused
            await chrome.windows.update(tab.windowId, { focused: true });

            console.log('🔄 Page updated in existing window with auto-scroll, Buy Box Manager kept focused');
            reuseExistingWindow = true;
          }
        } catch (error) {
          console.log('ℹ️ Previous Amazon window/tab no longer exists, creating new one');
          amazonWindowId = null;
          amazonTabId = null;
        }
      }

      if (!reuseExistingWindow) {
        // Get current window information
        const currentWindow = await chrome.windows.get(tab.windowId);

        // Store original window state for later restore (only if not already stored)
        if (!originalWindowState) {
          originalWindowState = {
            id: currentWindow.id,
            left: currentWindow.left,
            top: currentWindow.top,
            width: currentWindow.width,
            height: currentWindow.height
          };
        }

        // Calculate dimensions based on current window
        const currentWidth = currentWindow.width;
        const currentHeight = currentWindow.height;
        const currentTop = currentWindow.top || 0;

        // Split window: 70% for Buy Box Manager, 30% for Amazon (reduce overlap)
        const leftWidth = Math.floor(currentWidth * 0.70);
        const rightWidth = Math.floor(currentWidth * 0.30);

        // Resize current window to left 70% - keep it focused initially
        await chrome.windows.update(currentWindow.id, {
          left: 0,
          top: currentTop,
          width: leftWidth,
          height: currentHeight,
          focused: true  // Keep Buy Box Manager focused
        });

        // Small delay to ensure window resize completes
        await new Promise(resolve => setTimeout(resolve, 150));

        // Collapse sidebar for better space utilization
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'collapseSidebar'
          });
          console.log('📱 Sidebar collapse requested');
        } catch (error) {
          console.log('ℹ️ Could not send sidebar collapse message:', error.message);
        }

        // Create Amazon window on right 30% with blank page first (no focus)
        const amazonWindow = await chrome.windows.create({
          url: 'about:blank',  // Start with blank page
          type: 'normal',
          left: leftWidth,
          top: currentTop,
          width: rightWidth,
          height: currentHeight,
          focused: false  // Don't focus the Amazon window
        });

        // Store the new Amazon window and tab IDs
        amazonWindowId = amazonWindow.id;
        amazonTabId = amazonWindow.tabs[0].id;

        // Get the tab and apply mobile emulation before loading Amazon
        await applyMobileEmulation(amazonTabId);

        // Now navigate to Amazon with mobile emulation already active
        await chrome.tabs.update(amazonTabId, { url: amazonUrl });

        // Ensure Buy Box Manager window stays focused
        await chrome.windows.update(currentWindow.id, { focused: true });

        console.log('✅ Created new side-by-side windows with mobile emulation:', {
          original: currentWindow.id,
          amazon: amazonWindowId,
          leftWidth,
          rightWidth,
          buyBoxManagerFocused: true
        });

        // Notify the Buy Box Manager page to show the restore button
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'showRestoreButton'
          });
          console.log('📱 Restore button display requested');
        } catch (error) {
          console.log('ℹ️ Could not send restore button message:', error.message);
        }
      }
    } else if (displayMode === 'popup') {
      // Create popup window with blank page first
      const popupWindow = await chrome.windows.create({
        url: 'about:blank',
        type: 'popup',
        width: 400,
        height: 600,
        focused: true
      });

      // Apply mobile emulation then navigate
      const popupTab = popupWindow.tabs[0];
      await applyMobileEmulation(popupTab.id);
      await chrome.tabs.update(popupTab.id, { url: amazonUrl });
    } else if (displayMode === 'tab') {
      // Create new blank tab first (don't make it active to avoid stealing focus)
      const newTab = await chrome.tabs.create({
        url: 'about:blank',
        active: false  // Don't steal focus from current tab
      });

      // Apply mobile emulation then navigate
      await applyMobileEmulation(newTab.id);
      await chrome.tabs.update(newTab.id, { url: amazonUrl });

      // Keep focus on the original Buy Box Manager tab
      await chrome.tabs.update(tab.id, { active: true });
    }

    console.log('✅ Amazon page opened with mobile emulation');

  } catch (error) {
    console.error('❌ Error showing Amazon page:', error);
  }
}

// Helper function to wait for tab to complete loading
function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const listener = (updatedTabId, changeInfo, tab) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Function to trigger auto-scroll without mobile emulation (for reused windows)
async function triggerAutoScroll(tabId) {
  try {
    console.log(`📍 Triggering auto-scroll for tab ${tabId}`);

    // Wait a moment for page to settle
    await new Promise(resolve => setTimeout(resolve, 1500));

    await chrome.debugger.sendCommand({ tabId }, "Runtime.evaluate", {
      expression: `
        (function(){
          // Try to find buy box or key product elements in priority order
          const selectors = [
            '[data-feature-name="buybox"]',
            '#buybox',
            '#add-to-cart-button', 
            '#priceblock_dealprice',
            '#priceblock_ourprice',
            '.a-price.a-text-price.a-size-medium.apexPriceToPay',
            '#dp-container',
            '#productTitle'
          ];
          
          let foundElement = null;
          let elementInfo = '';
          
          for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el && el.offsetHeight > 0) {
              foundElement = el;
              elementInfo = selector;
              break;
            }
          }
          
          if (foundElement) {
            // Scroll to element with some padding above
            const elementTop = foundElement.getBoundingClientRect().top + window.scrollY;
            const offsetTop = Math.max(0, elementTop - 100); // 100px padding from top
            
            window.scrollTo({
              top: offsetTop,
              behavior: 'smooth'
            });
            
            console.log('📍 Auto-scrolled to:', elementInfo);
            
            // Brief highlight
            foundElement.style.boxShadow = '0 0 10px rgba(255, 165, 0, 0.7)';
            setTimeout(() => {
              foundElement.style.boxShadow = '';
            }, 2000);
            
            return 'Scrolled to: ' + elementInfo;
          } else {
            // If no specific element found, scroll to a reasonable position
            window.scrollTo({
              top: window.innerHeight * 0.5,
              behavior: 'smooth'
            });
            console.log('📍 No buy box found, scrolled to middle');
            return 'Scrolled to middle of page';
          }
        })();`
    });

    console.log('✅ Auto-scroll completed');

  } catch (error) {
    console.log('ℹ️ Auto-scroll failed:', error.message);
  }
}

async function applyMobileEmulation(tabId) {
  try {
    console.log(`📱 Applying mobile emulation to tab ${tabId}`);

    // First, try to detach any existing debugger session to avoid conflicts
    try {
      await chrome.debugger.detach({ tabId });
      console.log(`🧹 Detached existing debugger from tab ${tabId}`);
    } catch (error) {
      // No existing debugger attached, that's fine
    }

    // Small delay to ensure clean state
    await new Promise(resolve => setTimeout(resolve, 100));

    // Attach to the tab's DevTools protocol
    await chrome.debugger.attach({ tabId }, "1.3");

    // Enable all emulation features BEFORE page loads
    await chrome.debugger.sendCommand({ tabId }, "Emulation.setUserAgentOverride", {
      userAgent: UA_IPHONE,
      platform: "iPhone",
      acceptLanguage: "en-GB,en;q=0.9"
    });

    // Set mobile viewport optimized for narrow window (30% of screen)
    await chrome.debugger.sendCommand({ tabId }, "Emulation.setDeviceMetricsOverride", {
      width: 375,              // iPhone X/11/12 width - perfect for narrow window
      height: 812,             // iPhone X/11/12 height
      deviceScaleFactor: 2,    // Good balance between clarity and content
      mobile: true,
      fitWindow: true          // Fit to window for better scaling
    });

    // Enable touch events
    await chrome.debugger.sendCommand({ tabId }, "Emulation.setTouchEmulationEnabled", {
      enabled: true,
      configuration: "mobile"
    });

    // Set timezone and geolocation for mobile context
    await chrome.debugger.sendCommand({ tabId }, "Emulation.setTimezoneOverride", {
      timezoneId: "Europe/London"
    });

    // Force reload the page with mobile settings
    await chrome.debugger.sendCommand({ tabId }, "Page.reload", {
      ignoreCache: true
    });

    console.log('✅ Mobile emulation applied and page reloaded');

    // Auto-scroll to buy box and apply zoom after page loads
    setTimeout(async () => {
      try {
        await chrome.debugger.sendCommand({ tabId }, "Runtime.evaluate", {
          expression: `
            (function(){
              // Force mobile CSS classes if not already applied
              document.documentElement.classList.add('mobile');
              document.body.classList.add('mobile', 'touch');
              
              // Apply zoom for better readability
              document.body.style.zoom = '1.1';
              
              // Try to find buy box or key product elements in priority order
              const selectors = [
                '[data-feature-name="buybox"]',
                '#buybox',
                '#add-to-cart-button', 
                '#priceblock_dealprice',
                '#priceblock_ourprice',
                '.a-price.a-text-price.a-size-medium.apexPriceToPay',
                '#dp-container',
                '#productTitle'
              ];
              
              let foundElement = null;
              let elementInfo = '';
              
              for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el && el.offsetHeight > 0) {
                  foundElement = el;
                  elementInfo = selector;
                  break;
                }
              }
              
              if (foundElement) {
                // Scroll to element with some padding above
                const elementTop = foundElement.getBoundingClientRect().top + window.scrollY;
                const offsetTop = Math.max(0, elementTop - 100); // 100px padding from top
                
                window.scrollTo({
                  top: offsetTop,
                  behavior: 'smooth'
                });
                
                console.log('📍 Scrolled to:', elementInfo);
                
                // Highlight the buy box area briefly
                foundElement.style.boxShadow = '0 0 10px rgba(255, 165, 0, 0.7)';
                setTimeout(() => {
                  foundElement.style.boxShadow = '';
                }, 2000);
                
                return 'Scrolled to: ' + elementInfo;
              } else {
                // If no specific element found, scroll to a reasonable position
                window.scrollTo({
                  top: window.innerHeight * 0.5,
                  behavior: 'smooth'
                });
                console.log('📍 No buy box found, scrolled to middle');
                return 'Scrolled to middle of page';
              }
            })();`
        });
      } catch (error) {
        console.log('ℹ️ Auto-scroll failed:', error.message);
      }
    }, 3000); // Longer delay for mobile page load

  } catch (error) {
    console.error('❌ Error applying mobile emulation:', error);
  }
}

function buildAmazonUrl(asin) {
  // Use Amazon mobile web URL format for better mobile experience
  return `https://www.amazon.co.uk/gp/aw/d/${asin}`;
}

async function restoreOriginalWindow() {
  if (originalWindowState) {
    try {
      await chrome.windows.update(originalWindowState.id, {
        left: originalWindowState.left,
        top: originalWindowState.top,
        width: originalWindowState.width,
        height: originalWindowState.height
      });

      // Restore sidebar to normal width
      try {
        await chrome.tabs.sendMessage(sidePanelTabId, {
          action: 'restoreSidebar'
        });
        console.log('📱 Sidebar restore requested');
      } catch (error) {
        console.log('ℹ️ Could not send sidebar restore message:', error.message);
      }

      // Hide the restore button since layout is restored
      try {
        await chrome.tabs.sendMessage(sidePanelTabId, {
          action: 'hideRestoreButton'
        });
        console.log('🪟 Restore button hide requested');
      } catch (error) {
        console.log('ℹ️ Could not send hide restore button message:', error.message);
      }

      console.log('✅ Window layout and sidebar restored');
      originalWindowState = null;
    } catch (error) {
      console.error('❌ Error restoring window:', error);
    }
  }
}

// Action button click handler
chrome.action.onClicked.addListener(async (tab) => {
  console.log('🔘 Extension action clicked');

  try {
    // Toggle side panel
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (error) {
    console.error('❌ Error opening side panel:', error);
  }
});

// Handle side panel messages
chrome.runtime.onConnect.addListener((port) => {
  console.log('🔌 Side panel connected');

  port.onMessage.addListener((message) => {
    console.log('📨 Side panel message:', message);

    if (message.action === 'requestProductData') {
      port.postMessage({
        action: 'productData',
        data: currentProductData
      });
    }
  });

  port.onDisconnect.addListener(() => {
    console.log('🔌 Side panel disconnected');
  });
});

// Clean up debugger sessions when tabs are closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    await chrome.debugger.detach({ tabId });
    console.log(`🧹 Detached debugger from closed tab ${tabId}`);
  } catch (error) {
    // Tab may not have had debugger attached, that's fine
  }

  // Clear Amazon tab tracking if this was the Amazon tab
  if (tabId === amazonTabId) {
    console.log('🧹 Amazon tab closed, clearing tracking');
    amazonTabId = null;
    amazonWindowId = null;
  }
});

// Clean up when windows are closed
chrome.windows.onRemoved.addListener((windowId) => {
  // Clear Amazon window tracking if this was the Amazon window
  if (windowId === amazonWindowId) {
    console.log('🧹 Amazon window closed, clearing tracking');
    amazonWindowId = null;
    amazonTabId = null;
  }
});

// Handle debugger detach events
chrome.debugger.onDetach.addListener((source, reason) => {
  console.log(`🔌 Debugger detached from tab ${source.tabId}, reason: ${reason}`);
});
