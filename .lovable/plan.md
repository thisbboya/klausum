## Slice 11: Installable PWA (manifest-only, no service worker)

Make NkyinkyimIQ installable on iOS/Android/desktop via "Add to Home Screen" with a proper standalone shell, branded icons, and a soft in-app install prompt. **No service worker, no offline caching** — keeps the editor preview safe from cache pollution per Lovable's PWA guidance.

### What ships

1. **Web app manifest** at `public/manifest.webmanifest`
   - `name`: "NkyinkyimIQ — Learning that bends to your mind"
   - `short_name`: "NkyinkyimIQ"
   - `start_url`: "/", `scope`: "/", `display`: "standalone", `orientation`: "portrait-primary"
   - `background_color`: "#0F172A", `theme_color`: "#0F172A"
   - `icons`: 192×192 + 512×512 (any) + 512×512 (maskable)
   - `shortcuts`: quick links to /flashcards, /quiz, /codelab, /studyrooms (4 launcher shortcuts)
   - `categories`: ["education", "productivity"]

2. **Branded icons** (generated, premium quality)
   - `public/icon-192.png`, `public/icon-512.png`, `public/icon-512-maskable.png` (with ~20% safe-zone padding for Android adaptive icons)
   - `public/apple-touch-icon.png` (180×180, no transparency, dark indigo bg + brand mark) for iOS home screen
   - `public/favicon.ico` is already present; leave untouched

3. **`__root.tsx` head additions** (links/meta only, no SW)
   - `<link rel="manifest" href="/manifest.webmanifest">`
   - `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">`
   - `<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">`
   - `<meta name="apple-mobile-web-app-capable" content="yes">`
   - `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
   - `<meta name="apple-mobile-web-app-title" content="NkyinkyimIQ">`
   - `<meta name="mobile-web-app-capable" content="yes">`
   - keep existing `theme-color` (#0F172A)

4. **Soft install prompt** — `src/components/pwa/InstallPrompt.tsx`
   - Listens for `beforeinstallprompt` (Android/Chrome/Edge), stashes the event, shows a dismissible bottom-sheet card: "Install NkyinkyimIQ for a faster, app-like experience."
   - On iOS Safari (no `beforeinstallprompt`): shows a one-time tip with the share-icon + "Add to Home Screen" instructions when `navigator.standalone === false` and UA matches iPhone/iPad.
   - "Maybe later" stores `pwa-install-dismissed-at` in localStorage and re-appears after 14 days.
   - Hides entirely when already installed (`display-mode: standalone` or `navigator.standalone`).
   - Mounted in `RootComponent` next to `<Toaster />`.

5. **`useIsStandalone()` hook** — `src/hooks/useIsStandalone.ts`
   - Returns true when `matchMedia('(display-mode: standalone)').matches` or `navigator.standalone`. Used by InstallPrompt and (optionally) to hide redundant install CTAs.

### Out of scope (explicitly not doing)
- Service worker / Workbox / `vite-plugin-pwa`
- Offline read of notes/flashcards/formulas
- Push notifications
- Background sync
- Splash screen `.png` set per iOS device size (the manifest + theme/bg colors handle the modern flow)

### Files

**Created**
- `public/manifest.webmanifest`
- `public/icon-192.png`, `public/icon-512.png`, `public/icon-512-maskable.png`, `public/apple-touch-icon.png`
- `src/hooks/useIsStandalone.ts`
- `src/components/pwa/InstallPrompt.tsx`

**Edited**
- `src/routes/__root.tsx` — add manifest/apple-touch/meta links; mount `<InstallPrompt />` inside `RootComponent`

### Verification
- Inspect generated icons (QA each PNG visually)
- Check `__root.tsx` head renders manifest link in dev
- Confirm InstallPrompt is hidden when `display-mode: standalone` is simulated
- Note to user: install prompt only fires on the **published URL** (not in the editor iframe), but the manifest + iOS meta tags work everywhere

After this ships, next up is **Slice 12: Security tab** (passkeys, sessions, active devices in /settings).