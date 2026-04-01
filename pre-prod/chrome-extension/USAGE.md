# 🎯 How to Use the Buy Box Viewer Extension

## What You'll See on the Buy Box Manager Page

After installing the extension, you'll see **Preview buttons** next to each Amazon ASIN link in your product table.

### Visual Guide:

```
Product Row:
┌─────────────────────────────────────────────────────────────┐
│ 📦 Product Name                                              │
│ SKU-12345 📝                                                │
│ B08N5WRWNW → [👁️ Preview]  ← CLICK THIS BUTTON            │
│ 🏆 Buy Box Winner                                           │
│ Last checked: 2 hours ago                                   │
└─────────────────────────────────────────────────────────────┘
```

## How to Use:

### ✅ **Method 1: Preview Button (Recommended)**
- **Click the "👁️ Preview" button** next to any ASIN
- The Amazon page will open in the Chrome side panel
- Button will briefly show "👁️ Opening..." feedback

### ✅ **Method 2: Table Row Click (Fallback)**
- Click anywhere on a product row (table row)
- Extension will detect the product data and open preview

### ✅ **Method 3: Ctrl+Hover (Advanced)**
- Hold **Ctrl** and hover over any product row
- Extension will open a popup preview after 500ms delay
- Useful for quick peeks without opening side panel

### ✅ **Method 4: Extension Icon**
- Click the extension icon in Chrome toolbar
- Opens side panel with last viewed product (if any)

## What Happens:

1. **Extension detects** your click on the Preview button
2. **Extracts product data**: ASIN, SKU, title, price
3. **Opens Chrome side panel** with Amazon UK page for that product
4. **Shows live Amazon page** - you can interact with it normally

## Troubleshooting:

### Preview Button Not Working?
- Check that extension is loaded: `chrome://extensions/`
- Look for browser console errors (F12 → Console)
- Verify the button has data attributes

### Amazon Page Not Loading?
- Check internet connection
- Try clicking "🔄 Refresh" in the side panel
- Some Amazon pages may block iframe loading

### Extension Not Detecting Products?
- Make sure you're on the Buy Box Manager page
- Check that product rows have the preview buttons
- Look for the "🔍 Buy Box Viewer Active" indicator (appears briefly)

## Quick Start:

1. **Navigate to your Buy Box Manager page**
   - `http://localhost:3000/buy-box-manager` (development)
   - `https://operations.chefstorecookbook.com/buy-box-manager` (production)
2. **Look for blue "👁️ Preview" buttons** next to ASIN links
3. **Click any Preview button** to open Amazon page in side panel
4. **Interact with the Amazon page** as normal
5. **Use "🔗 Open in Tab" button** for full-page view

That's it! The extension makes it super easy to preview Amazon pages without leaving your Buy Box Manager workflow.