# PWA Icon Configuration

## Overview
The FN app uses a **single source icon** (`home.png` at project root) to automatically generate all required PWA and iOS icons at build time.

## Source of Truth
**Location**: `./home.png` (project root: `C:\Data\Finance-app\home.png`)

This is the **only file you need to update** when changing the app icon. All other icon sizes are generated automatically from this source.

## How It Works

### Build Process
1. The `scripts/generate-icons.js` script runs before each build
2. It reads `home.png` from the project root
3. Uses `sharp` (image processing library) to generate all required sizes
4. Outputs icons to `public/` directory:
   - `icon-192.png` (192×192) - PWA manifest
   - `icon-512.png` (512×512) - PWA manifest
   - `apple-touch-icon.png` (180×180) - iOS default
   - `apple-touch-icon-152.png` (152×152) - iPad
   - `apple-touch-icon-167.png` (167×167) - iPad Pro
   - `apple-touch-icon-180.png` (180×180) - iPhone

### Generated Icons
All icons in `public/icon-*.png` and `public/apple-touch-icon*.png` are **build artifacts** (ignored by git). They are automatically regenerated from `home.png` on every build.

## Usage

### Development
Icons are **not** regenerated during `npm run dev`. If you update `home.png` during development, manually run:
```bash
npm run generate-icons
```

### Production Build
Icons are **automatically** generated before build:
```bash
npm run build
# Runs: npm run generate-icons && vite build
```

### Manual Generation
To regenerate icons without building:
```bash
npm run generate-icons
```

## Manifest & HTML Configuration

### manifest.json
Located at `public/manifest.json`:
```json
{
  "name": "FN - Finance Tracker",
  "short_name": "FN",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "purpose": "any" },
    { "src": "/icon-192.png", "sizes": "192x192", "purpose": "maskable" },
    { "src": "/icon-512.png", "sizes": "512x512", "purpose": "any" },
    { "src": "/icon-512.png", "sizes": "512x512", "purpose": "maskable" }
  ]
}
```

### index.html
iOS-specific meta tags:
```html
<!-- iOS PWA Support -->
<meta name="apple-mobile-web-app-title" content="FN" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="apple-touch-icon" sizes="152x152" href="/apple-touch-icon-152.png" />
<link rel="apple-touch-icon" sizes="167x167" href="/apple-touch-icon-167.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-180.png" />
```

## Forcing iOS to Refresh Icon Cache

When you update the app icon, iOS Safari may cache the old icon. To force a refresh:

### Method 1: Version Change (Recommended)
1. Update `manifest.json` by adding a cache-busting query parameter:
   ```json
   {
     "icons": [
       { "src": "/icon-192.png?v=2", "sizes": "192x192" }
     ]
   }
   ```

2. Also update `index.html`:
   ```html
   <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" />
   ```

3. Deploy the changes

### Method 2: Complete Cache Clear (User Side)
Ask users to:
1. Remove the app from home screen (long-press → Remove)
2. Close Safari completely (swipe up from app switcher)
3. Clear Safari cache: Settings → Safari → Clear History and Website Data
4. Re-add the app to home screen

### Method 3: Force Reload
1. Open the site in Safari
2. Pull down from the top to reveal the address bar
3. Tap the refresh button
4. Remove and re-add the app to home screen

## Testing

### Verify Generated Icons
After running `npm run generate-icons`, check that all files exist:
```bash
ls -lh public/*.png
```

Expected output:
- `icon-192.png` (~36KB)
- `icon-512.png` (~249KB)
- `apple-touch-icon.png` (~31KB)
- `apple-touch-icon-152.png` (~26KB)
- `apple-touch-icon-167.png` (~31KB)
- `apple-touch-icon-180.png` (~31KB)

### Verify Manifest
1. Open browser dev tools
2. Go to Application tab (Chrome) or Storage tab (Firefox)
3. Check "Manifest" section
4. Verify all icon URLs resolve correctly

### Test iOS Installation
1. Open the app in Safari on iPhone
2. Tap the Share button
3. Tap "Add to Home Screen"
4. Verify:
   - App name shows as "FN"
   - Icon displays correctly (from `home.png`)
   - No placeholder or generic icon

## Troubleshooting

### Icons Not Generating
**Problem**: `npm run generate-icons` fails

**Solutions**:
- Ensure `home.png` exists at project root
- Verify `sharp` is installed: `npm ls sharp`
- Check Node.js version (needs Node 18+)
- Reinstall dependencies: `npm install`

### Wrong Icon Showing on iOS
**Problem**: Old icon still appears after update

**Solutions**:
1. Add cache-busting query params (see "Forcing iOS to Refresh Icon Cache")
2. Clear Safari cache completely
3. Wait 24-48 hours (iOS CDN cache expiry)

### Icons Missing in Build
**Problem**: Production build has no icons

**Solutions**:
- Verify `build` script includes `generate-icons`: check `package.json`
- Manually run `npm run generate-icons` before deploying
- Check deployment process copies `public/` directory

### Manifest Not Loading
**Problem**: Browser can't find manifest.json

**Solutions**:
- Verify `<link rel="manifest" href="/manifest.json" />` in `index.html`
- Check manifest is in `public/` directory
- Ensure manifest is served with correct MIME type: `application/manifest+json`

## File Structure
```
Finance-app/
├── home.png                          # SOURCE OF TRUTH (tracked in git)
├── scripts/
│   └── generate-icons.js             # Icon generation script
├── public/
│   ├── manifest.json                 # PWA manifest
│   ├── icon-192.png                  # Generated (gitignored)
│   ├── icon-512.png                  # Generated (gitignored)
│   ├── apple-touch-icon.png          # Generated (gitignored)
│   ├── apple-touch-icon-152.png      # Generated (gitignored)
│   ├── apple-touch-icon-167.png      # Generated (gitignored)
│   └── apple-touch-icon-180.png      # Generated (gitignored)
└── index.html                        # Apple touch icon meta tags
```

## Dependencies
- **sharp** (v0.34.4): High-performance image processing
  - Installed as devDependency
  - Used only at build time
  - Not included in production bundle

## Notes
- All paths in manifest.json and index.html use **absolute paths** (`/icon-192.png`) to ensure proper resolution from any route
- Icons use transparent backgrounds to work with iOS's automatic masking
- The `maskable` purpose allows Android to apply safe area padding
- iOS prefers PNG format over SVG for touch icons
- Icon generation adds ~1-2 seconds to build time
