# Jepong Devxyz Website-to-APK Builder

Build Android APK wrappers from a website using Native WebView, GeckoView, Capacitor, or Cordova.

## Engines

- Native WebView
- GeckoView
- Capacitor
- Cordova

## Verification

The repository includes generator, capability, runtime-contract, and APK build verification workflows. Capability labels are evidence-driven: `Verified`, `Experimental`, or `Unsupported`.

## Build flow

1. Configure the website/app details in the web UI.
2. Choose an engine and supported capabilities.
3. Generate a build configuration.
4. GitHub Actions generates and builds the Android project.
5. The final APK is aligned, signed, verified, and uploaded as an artifact.

## Branding

Custom icon and splash uploads override the defaults. When no custom branding is supplied, the builder uses the bundled Jepong Devxyz default icon and splash screen across all engines.

## Security

- Build inputs are validated before project generation.
- APK signing is performed in GitHub Actions; private keystore material belongs in GitHub Actions secrets and is never embedded in browser code.
- Unsupported website-facing native APIs remain disabled unless a secure bridge exists.

## Local checks

```bash
npm test
npm run check
```
