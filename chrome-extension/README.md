# Buy Box Viewer Chrome Extension

A Chrome extension that provides live Amazon page previews when browsing the Buy Box Manager interface. Hover or click on products to instantly view their Amazon pages in a side panel or popup.

## Features

- 🔍 **Product Detection**: Automatically detects product rows in the Buy Box Manager
- 📱 **Side Panel View**: View Amazon pages in a dedicated side panel
- 🔧 **Popup Preview**: Quick popup window for Amazon page previews
- 🎯 **Click & Hover**: Trigger previews with mouse interactions
- 📊 **Product Data**: Shows ASIN, SKU, title, and price information
- 🔗 **Direct Links**: Open products directly in new tabs

## Installation

### Option 1: Load as Unpacked Extension (Development)

1. **Open Chrome Extensions Page**
   - Go to `chrome://extensions/`
   - Enable "Developer mode" in the top right

2. **Load the Extension**
   - Click "Load unpacked"
   - Select the `chrome-extension` folder from your project
   - The extension should appear with a 📦 icon

3. **Verify Installation**
   - The extension icon should appear in the Chrome toolbar
   - Visit your Buy Box Manager page to test functionality

### Option 2: Chrome Web Store (Future)
When ready for production, this extension can be packaged and submitted to the Chrome Web Store.

## Usage

### In the Buy Box Manager

1. **Navigate to Buy Box Manager**
   - Open your Buy Box Manager page (`http://localhost:3000` or `https://operations.chefstorecookbook.com/buy-box-manager`)
   - Ensure the page has loaded completely

2. **Interact with Products**
   - **Click** on any product row to preview in side panel
   - **Hover** over products for quick preview
   - Product data (ASIN, SKU, price) is automatically detected

3. **View Amazon Pages**
   - **Side Panel**: Click the extension icon or interact with products
   - **Popup**: Right-click extension icon → "Open popup"
   - **New Tab**: Use the "Open in Tab" button for full page view

### Extension Features

- **Mobile/Desktop Views**: Switch between Amazon mobile and desktop layouts
- **Auto-refresh**: Refresh Amazon content without closing the preview
- **Product Context**: See product details (ASIN, SKU, price) in the preview
- **Quick Actions**: Direct links to seller pages and product management

## Technical Details

### Architecture
- **Manifest V3**: Modern Chrome extension format
- **Content Script**: Detects product interactions on Buy Box Manager
- **Background Script**: Manages communication and state
- **Side Panel**: Embedded Amazon page viewer
- **Popup**: Compact preview window

### Permissions
- `sidePanel`: For side panel functionality
- `activeTab`: To interact with the current page
- `host_permissions`: Access to localhost and production domains
- `storage`: Store user preferences

### Files Structure
```
chrome-extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for communication
├── content-script.js      # Product detection on Buy Box Manager
├── sidepanel.html         # Side panel interface
├── sidepanel.js          # Side panel functionality
├── popup.html            # Popup interface
└── popup.js              # Popup functionality
```

## Development

### Testing
1. Make changes to extension files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension
4. Test on Buy Box Manager page

### Debugging
- **Content Script**: Right-click page → Inspect → Console
- **Background Script**: Extensions page → Extension details → Service worker → Inspect
- **Side Panel/Popup**: Right-click in panel → Inspect

### Customization
- **Styling**: Modify CSS in HTML files
- **Behavior**: Update JavaScript event handlers
- **Permissions**: Adjust `manifest.json` as needed

## Troubleshooting

### Extension Not Loading
- Check Chrome Developer mode is enabled
- Verify all files are present in the folder
- Look for errors in Chrome Extensions page

### Amazon Pages Not Loading
- Check internet connection
- Verify Amazon isn't blocking iframe access
- Try switching between mobile/desktop views

### Product Detection Issues
- Ensure Buy Box Manager page has fully loaded
- Check that product rows have `data-asin` attributes
- Look for console errors in developer tools

## Security & Privacy

- **No Data Collection**: Extension doesn't store or transmit personal data
- **Local Operation**: All processing happens locally in your browser
- **Sandbox**: Amazon pages load in sandboxed iframes
- **Minimal Permissions**: Only requests necessary permissions

## Version History

- **v1.0.0**: Initial release with side panel and popup functionality
  - Product detection in Buy Box Manager
  - Amazon page previews
  - Mobile and desktop view options
  - Direct link functionality

## Support

For issues or feature requests:
1. Check the browser console for error messages
2. Verify all extension files are present and unmodified
3. Test with a simple product interaction
4. Check that Buy Box Manager has the required `data-asin` attributes

## Future Enhancements

- **Settings Panel**: Configurable preview modes and behaviors
- **Quick Actions**: Price comparison and analysis tools
- **History**: Recently viewed products
- **Performance**: Optimized loading and caching
- **Analytics**: Usage tracking and insights