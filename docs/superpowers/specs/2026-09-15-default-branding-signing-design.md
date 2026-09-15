# Default Branding + Signing Design

The app builder must ship Jepong Devxyz default branding to every generated Android engine while still allowing user-uploaded branding to take precedence.

Required behavior:
- `assets/default-icon.png`, `assets/default-splash.png`, and `assets/default-splash.base64.txt` are the default assets.
- `brandedAsset(config, 'icon')` and `brandedAsset(config, 'splash')` return uploaded Data URL assets when present and fall back to the default assets when not present.
- Native and GeckoWebView generated projects must contain final Android drawable resources for icon and splash.
- Capacitor and Cordova generated projects must carry the same selected branding through their bootstrap files and patched final Android resources.
- Existing app capabilities and runtime UX must be preserved.
- Signing verification must use the existing GitHub secret-backed jepong-release.jks setup in CI, and local verification must not print or commit secrets.
