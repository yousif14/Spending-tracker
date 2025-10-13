# PWA Icon Implementation Summary

## What Was Done

Updated the PWA icon configuration to use `home.png` from the project root as the single source of truth, with automatic generation of all required icon sizes at build time.

## Changes Made

### 1. Icon Generation Script
**File**: [scripts/generate-icons.js](scripts/generate-icons.js)
- Uses `sharp` library to generate icons from `./home.png`
- Creates 6 icon sizes:
  - `icon-192.png` (192×192) - PWA Android
  - `icon-512.png` (512×512) - PWA Android
  - `apple-touch-icon.png` (180×180) - iOS default
  - `apple-touch-icon-152.png` (152×152) - iPad
  - `apple-touch-icon-167.png` (167×167) - iPad Pro
  - `apple-touch-icon-180.png` (180×180) - iPhone
- All icons output to `public/` directory

### 2. Build Integration
**File**: [package.json](package.json)
- Added `generate-icons` script: `node scripts/generate-icons.js`
- Updated `build` script: `npm run generate-icons && vite build`
- Updated `build:dev` script: `npm run generate-icons && vite build --mode development`
- Icons are now automatically generated before every build

### 3. Manifest Configuration
**File**: [public/manifest.json](public/manifest.json)
- Updated to reference generated icons: `/icon-192.png`, `/icon-512.png`
- Separated `any` and `maskable` purposes for Android compatibility
- App name remains "FN" (short_name: "FN", name: "FN - Finance Tracker")

### 4. iOS Meta Tags
**File**: [index.html](index.html)
- Updated Apple touch icon references to point to generated files
- Added all device-specific sizes (152, 167, 180)
- Kept app title as "FN" (`apple-mobile-web-app-title`)

### 5. Git Configuration
**File**: [.gitignore](.gitignore)
- Added generated icons to gitignore:
  ```
  public/icon-*.png
  public/apple-touch-icon*.png
  ```
- Only `home.png` (source) is tracked in git

### 6. Dependencies
**File**: [package.json](package.json)
- Added `sharp@0.34.4` as devDependency for image processing

## How Asset Is Copied/Served

### Development (npm run dev)
- Icons must be pre-generated with `npm run generate-icons`
- Vite serves files from `public/` directly
- Icons accessible at `http://localhost:8082/icon-192.png`, etc.

### Production (npm run build)
1. Build script runs `npm run generate-icons` first
2. Script reads `./home.png` and generates all sizes to `public/`
3. Vite build process copies `public/` contents to `dist/`
4. Icons are served as static assets from root (`/icon-192.png`)

### Asset Flow
```
home.png (source, git-tracked)
    ↓
scripts/generate-icons.js (build time)
    ↓
public/*.png (generated, gitignored)
    ↓
dist/*.png (production build)
    ↓
Served at runtime (/icon-192.png, etc.)
```

## Forcing iOS to Refresh Icon Cache

iOS Safari aggressively caches PWA icons. To force a refresh after updating `home.png`:

### Option 1: Cache-Busting Query Parameters (Recommended)
1. Update [public/manifest.json](public/manifest.json):
   ```json
   {
     "icons": [
       { "src": "/icon-192.png?v=2", "sizes": "192x192" }
     ]
   }
   ```

2. Update [index.html](index.html):
   ```html
   <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" />
   ```

3. Increment version number (`?v=2` → `?v=3`) each time you update the icon

### Option 2: User Cache Clear
Users must:
1. Remove the app from home screen (long-press → Remove)
2. Close Safari completely (swipe up from app switcher)
3. Open Safari Settings → Clear History and Website Data
4. Re-open the site in Safari and re-add to home screen

### Option 3: Wait
iOS CDN cache typically expires in 24-48 hours. The new icon will appear automatically after cache expiry.

### Testing Cache Refresh
To verify the new icon is being served:
1. Open Safari on iPhone
2. Navigate to the site
3. Open Web Inspector (if using Safari on Mac)
4. Check Network tab for icon requests
5. Verify the icon file has the correct timestamp/etag

## Verification Steps

### 1. Check Generated Icons Locally
```bash
npm run generate-icons
ls -lh public/*.png
```

Expected output: 7 PNG files (home.png + 6 generated)

### 2. Test Dev Server
```bash
curl -I http://localhost:8082/icon-192.png
curl -I http://localhost:8082/apple-touch-icon.png
```

Both should return `HTTP/1.1 200 OK`

### 3. Inspect Manifest
```bash
curl http://localhost:8082/manifest.json
```

Verify `icons` array references `/icon-192.png` and `/icon-512.png`

### 4. Test iOS Installation
1. Open `http://localhost:8082` in Safari on iPhone
2. Tap Share → Add to Home Screen
3. Verify:
   - App name shows "FN"
   - Icon displays correctly (from `home.png`)
   - No generic/placeholder icon

### 5. Test Production Build
```bash
npm run build
ls dist/*.png
```

Verify all 6 generated icons are present in `dist/`

## Troubleshooting

### Icons Not Showing on iPhone
**Problem**: Generic icon appears instead of `home.png`

**Solution**:
1. Check [index.html](index.html) has all `apple-touch-icon` links
2. Verify icons are accessible: visit `yourdomain.com/apple-touch-icon.png` in Safari
3. Add cache-busting query params: `?v=2`
4. Remove app and clear Safari cache, then re-add

### Build Fails with Sharp Error
**Problem**: `npm run build` fails with sharp error

**Solution**:
1. Verify Node.js version: `node --version` (needs v18+)
2. Reinstall sharp: `npm uninstall sharp && npm install --save-dev sharp`
3. On Windows, may need Visual C++ Build Tools

### Icons Missing in Production
**Problem**: Production build has broken icon links

**Solution**:
1. Verify `public/` directory is deployed with `dist/`
2. Check web server serves static assets from root
3. Ensure icons are generated before build: `npm run generate-icons && npm run build`

## Files Modified

- ✅ [.gitignore](.gitignore) - Ignore generated icons
- ✅ [index.html](index.html) - Apple touch icon meta tags
- ✅ [package.json](package.json) - Build scripts and sharp dependency
- ✅ [public/manifest.json](public/manifest.json) - PWA manifest icon paths
- ✅ [scripts/generate-icons.js](scripts/generate-icons.js) - Icon generation script (new)
- ✅ [PWA_ICON_SETUP.md](PWA_ICON_SETUP.md) - Detailed setup guide (new)

## Commit
```
c8f0a30 - Configure PWA icons with automatic generation from home.png
```

## Testing Checklist

- [x] Icons generate successfully from `home.png`
- [x] All 6 icon sizes created in `public/`
- [x] Icons accessible via dev server
- [x] Manifest.json references correct paths
- [x] index.html has all Apple touch icon tags
- [x] App name shows as "FN" in manifest and HTML
- [x] Generated icons gitignored
- [x] Build script includes icon generation
- [ ] Production build tested (deploy required)
- [ ] iOS installation tested with real device
- [ ] Icon cache refresh tested on iOS

## Next Steps for Testing

1. **Deploy to production** to test with real URLs
2. **Test on iPhone** by adding to home screen
3. **Verify icon displays correctly** (no placeholder)
4. **Test cache refresh** by updating `home.png` and adding `?v=2` query params
