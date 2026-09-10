# Jepong Devxyz Website → APK Builder

A Vercel-compatible frontend/API plus GitHub Actions APK build pipeline. It keeps engine toolchains separate so Native WebView, GeckoView, Capacitor, and Cordova do not share incompatible Gradle/Java assumptions.

## Verified/pinned stack (2026-09-09)

- Native Android: Android Gradle Plugin 9.4.0, Gradle 9.6.0, JDK 17, compile/target SDK 36.
- GeckoView: stable `org.mozilla.geckoview:geckoview:154.0.20260824154132`, JDK 17.
- Capacitor: 8.5.0, Android template line uses AGP 8.13.0 / Gradle 8.14.3 / Java 21.
- Cordova CLI: 13.0.0; cordova-android: 15.1.0; Gradle 8.14.2; AGP 8.10.1; JDK 17.
- OneSignal Android: 5.9.8 when an App ID is configured; Capacitor plugin 1.1.8.
- GitHub Actions: checkout v7, setup-node v7, setup-java v6, setup-android v4, setup-gradle v6, upload-artifact v7.

## Important compatibility behavior

The UI intentionally greys out controls that are not safely implemented for the selected engine. In particular, true AdGuard DNS requires an Android VPN/DNS filtering layer and is not faked. Firefox-style extensions are offered only with GeckoView and are installed from Mozilla-signed Firefox Add-ons XPI endpoints at runtime; their publisher/Mozilla compatibility can change independently of this builder.

The 11 Device Permission switches control Android manifest/runtime permission requests. Some sensitive device APIs (contacts, calendar, biometrics, Bluetooth, sensors) are not automatically exposed as JavaScript APIs to arbitrary websites; this is intentional for privacy/security.

## GitHub setup

1. Create a GitHub repository and upload this project.
2. Create a fine-grained GitHub token for the builder backend with access to this repository:
   - Contents: Read and write (the backend stores each build config under `builds/`).
   - Actions: Read and write (dispatch workflow and read runs/artifacts/logs).
3. Deploy the same repository to Vercel.
4. Set Vercel environment variables from `.env.example`:
   - `GH_BUILDER_TOKEN`
   - `GH_OWNER`
   - `GH_REPO`
   - `GH_BRANCH` (usually `main`)
5. Open the deployed site, configure an app, and press **Generate & Build APK**.

The backend stores the compressed PNG icon/splash inside the build JSON, dispatches `.github/workflows/build-apk.yml`, polls GitHub job/step state, exposes job logs, and proxies the final APK out of the GitHub artifact ZIP so the website download does not redirect the user to GitHub.

## Local validation

```bash
npm test
npm run check
```

These tests validate JavaScript syntax and generate all four engine project directory structures using a fixture config. A full Android compile needs an Android SDK and network access to Google/Mozilla/Maven/npm repositories; the included GitHub Actions workflow is the intended clean-room E2E compiler.

## Default branding

If no custom image is selected, the generated Android app uses the Jepong Devxyz default vector branding. Uploaded browser-supported images are downscaled and converted to PNG before they are sent to the backend.
