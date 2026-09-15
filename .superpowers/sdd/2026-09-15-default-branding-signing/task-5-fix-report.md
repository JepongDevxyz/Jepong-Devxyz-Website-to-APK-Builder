# Task 5 Fix Report

## Root Cause

Capacitor and Cordova returned early from `relocateAndroidSplashToAsset`, leaving the selected splash PNG in Android resources. The default splash payload predates this branch and may not compile safely, so that bypass exposed it to Android resource compilation.

## Files Changed

- `scripts/relocate-android-splash-asset.mjs`: restores relocation for Capacitor and Cordova.
- `scripts/common.mjs`: rejects malformed uploaded PNG data before branding propagation.
- `scripts/test-default-branding-assets.mjs`: uses a decodable custom splash fixture and verifies selected runtime bytes are separate from the compile-safe Android drawable.
- `scripts/verify-four-engine-branding-signing.mjs`: adds `--strict-signing`, reports compile-safe relocation honestly, and fails strict gates for skipped builds, missing APKs, or non-verified signatures.
- `scripts/test-verify-four-engine-branding-signing.mjs`: covers strict-mode failure when required build tooling is unavailable.

## Verification

| Command | Exit status |
| --- | --- |
| `node scripts/test-default-branding-assets.mjs` | 0 |
| `node scripts/test-three-engine-splash-launcher.mjs` | 0 |
| `node scripts/test-verify-four-engine-branding-signing.mjs` | 0 |
| `npm run check` | 0 |
| `npm test` | 0 |

## Commit

Implementation commit: `b1ae26fcab9ee78a4c0cbb60998efaa2d8a8eee9`

## Residual Limitations

- The pre-existing default splash payload and its hash expectations were intentionally not changed. Relocation protects Android resource compilation, but a future asset replacement still needs real Android build evidence and coordinated hash/documentation updates.
- This fix wave did not create a real Android APK or run `apksigner`; `--strict-signing --build` now fails rather than treating missing tooling, missing APKs, or failed verification as a passing signing gate.
- Uploaded PNGs receive structural and compressed-image-data validation. WebP and JPEG uploads retain the existing format handling.

## Re-review: Bounded PNG Decompression

`assertDecodablePng` now limits decompressed IDAT data to 8 MiB and rejects payloads that exceed that limit. The default asset path is unchanged. The branding asset regression test includes a compressed IDAT payload that expands past the cap.

| Command | Exit status |
| --- | --- |
| `node scripts/test-default-branding-assets.mjs` | 0 |
| `node scripts/test-verify-four-engine-branding-signing.mjs` | 0 |
| `npm run check` | 0 |
| `npm test` | 0 |

Implementation commit: `4f7d2fb5d5b896daf7ba10daae7bdd8f2cd2b9d6`
