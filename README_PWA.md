# Office Attendance Tracker PWA

This app is now configured as a Progressive Web App (PWA) with offline support, install prompt, and app icons.

## PWA Features
- `manifest.json` for app metadata and install support
- `sw.js` to cache the app shell and allow offline loading
- `icon.svg` for app icons
- install banner prompt via `beforeinstallprompt`
- full mobile login and local persistence functionality

## How to test
1. Host the app using a static server.
2. Open the app in Chrome or Edge.
3. Use DevTools > Application to verify:
   - Service Worker registered
   - Manifest loaded
   - Icon displayed
4. On supported browsers, install the app from the prompt or browser menu.

## Notes
- For a production install experience, use HTTPS hosting.
- The service worker caches `index.html`, `manifest.json`, `sw.js`, and `icon.svg`.
