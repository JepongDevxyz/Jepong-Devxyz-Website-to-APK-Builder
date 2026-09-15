# Default Branding + Signing Plan

## Global Constraints
- Work only on isolated branch/worktree.
- Do not merge main.
- Default Jepong Devxyz icon/splash must apply to Native, GeckoWebView, Capacitor, Cordova when no custom upload is provided.
- Custom uploaded icon/splash must override defaults.
- Preserve existing permissions, website controls, extensions, navigation, rendering, ABI, signing and runtime behavior.
- Do not expose or commit signing secrets.
- Verification must use fresh generated projects/APKs and apksigner evidence before claiming completion.

## Tasks
1. Strengthen generator-level branding contracts and custom upload override tests for all four engines.
2. Verify/fix final Android resource injection for Native and GeckoWebView outputs, preserving existing runtime splash wiring.
3. Verify/fix final Android resource injection for Capacitor and Cordova outputs, preserving existing patch stages.
4. Add fresh four-engine branding/signing verification helper that builds generated projects when local Android tooling is available and reports limitations honestly.
5. Run complete local verification, task-level reviews, final branch review, and collect GitHub Actions evidence after push to isolated branch.
