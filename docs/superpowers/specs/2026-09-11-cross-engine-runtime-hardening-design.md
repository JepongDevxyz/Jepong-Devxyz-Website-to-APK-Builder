# Cross-Engine Runtime Hardening Design

Date: 2026-09-11
Repository: `JepongDevxyz/Jepong-Devxyz-Website-to-APK-Builder`
Target: current Batch 7 architecture

## Goal

Repair the current Batch 7 architecture instead of rolling it back.

Preserve the newer signing, capability matrix, toolbar, downloads,
external-link handling, permissions and four-engine CI work while
fixing runtime regressions across:

- Native WebView
- GeckoView
- Capacitor
- Cordova

## 1. Orientation and lifecycle

### Auto

When Orientation = Auto:

- follow phone rotation,
- preserve current page and browser history,
- preserve runtime/session where supported,
- preserve permission state,
- preserve scroll/form state where the engine permits,
- do not reload unnecessarily,
- do not show splash again,
- do not reinstall Gecko extensions.

### Portrait / Landscape

Portrait and Landscape stay locked to the selected orientation.

### Rotation

Rotation must not be treated as a new app launch.

Generated Native/Gecko manifests and patched Capacitor/Cordova
manifests must use a consistent configuration-change policy.

## 2. Splash screen

Splash is for true cold launch only.

It must NOT appear again because of:

- rotation,
- app background/foreground,
- Android permission dialogs,
- file picker,
- share sheet,
- return from another app/browser,
- website navigation,
- ordinary configuration changes.

If Android really recreates an Activity, browser state should be
restored when practical instead of treating it as a fresh launch.

## 3. Gecko Extensions

Firefox-style extensions remain GeckoView-only:

- AdGuard AdBlocker
- Ghostery
- Privacy Badger
- Dark Reader
- uBlock Origin

Native, Capacitor and Cordova show all extension options as
Unsupported / gray-out.

### Protection-first startup

When selected extensions need preparation:

1. Open Gecko runtime/session.
2. Inspect installed extensions.
3. Find already-installed selected extensions.
4. Enable selected extensions that are disabled.
5. Install selected extensions that are missing.
6. Verify successful extensions report enabled.
7. Only then load the website.

### Conditional extension loader

The extension loader must appear ONLY when actual extension work
is required.

Behavior:

- No extensions selected:
  no extension loader; load website directly after normal splash.

- All selected extensions already installed and enabled:
  quick silent check; no installation loader; load website.

- One or more selected extensions are missing/disabled:
  show extension preparation UI while installing/enabling them.

Already installed extensions must not be downloaded again every launch.

### Failure handling

Extension preparation must never wait forever.

On failure/timeout:

- identify failed extensions,
- show Retry,
- show Continue without failed extensions,
- never claim a failed/disabled extension is active.

If Continue is chosen, load the website with only extensions that
were actually ready.

## 4. White-screen prevention

The browser engine should remain mounted while splash/loader UI
transitions away.

Do not remove the loading/error layer so early that the user is left
with a long unexplained white screen.

Distinguish:

- extension preparation,
- page/network loading,
- actual loading failure.

A bounded timeout must produce a visible Retry/error state instead
of an indefinite blank screen.

Retry must restart only the failed stage and must not replay unrelated
cold-launch work.

## 5. Device Permissions

`capabilities.mjs` remains the source of truth.

Statuses:

- Verified = physically runtime-proven.
- Experimental = real implementation exists and builds successfully,
  but physical runtime testing is incomplete.
- Unsupported = no real implementation; disabled and gray.

Camera, Microphone, Location and Files are selectable only where the
engine has real browser/runtime support.

Normal Web Notifications are selectable only where there is a real
implementation.

Gecko Notifications may remain Experimental until physical testing.

Native, Capacitor and Cordova Notifications remain Unsupported until
a real normal Web Notifications implementation exists.

These remain Unsupported when only Android manifest permission exists
without a secure website-facing API/bridge:

- Photos & videos
- Contacts
- Calendar
- Biometrics
- Bluetooth
- Sensors

Manifest permission alone must never be presented as website API
support.

## 6. Website Controls

Only controls with real engine implementations may be selectable.

Preserve working implementations where applicable:

- Pull-down refresh
- Hide scrollbars
- Transparent system bars
- Pinch zoom
- Disable text copy
- Block ad redirects
- Navigation toolbar
- External-link routing
- Download manager

Unsupported controls stay disabled/gray.

AdGuard DNS remains Unsupported on all engines because a dedicated
VPN/DNS implementation does not exist.

## 7. Navigation and background recovery

Back / Forward / Home / Reload / Share must remain usable after
navigation and orientation changes.

Returning from:

- permission UI,
- file picker,
- share sheet,
- external browser/app,
- background state

must not restart splash/browser unnecessarily.

If Android kills the process, reopening must recover safely without
entering an endless loader.

## 8. Performance rules

Avoid unnecessary work:

- no browser-engine recreation on ordinary rotation,
- no splash outside cold launch,
- no repeated request for permissions already granted,
- no Gecko extension reinstall when installed/enabled,
- no extension loader when no extension work exists,
- no duplicate runtime subsystems when current infrastructure can
  simply be hardened.

Performance optimization must not weaken Gecko protection-first
startup when extensions really need preparation.

## 9. TDD / regression tests

Write failing regression tests before implementation changes.

Add coverage for:

- Auto orientation lifecycle policy,
- Portrait lock,
- Landscape lock,
- splash cold-launch-only behavior,
- no splash restart on rotation,
- Gecko no-extension fast path,
- Gecko already-installed extension silent path,
- Gecko missing/disabled extension install path,
- Gecko retry/continue extension failure behavior,
- capability gray-out truthfulness,
- supported Website Controls remaining selectable,
- Firefox extensions staying unsupported on Native/Capacitor/Cordova.

All existing tests must continue passing.

## 10. Build verification

Before saying the repair is build-complete:

1. `npm test`
2. `npm run check`
3. latest four-engine verification is 4/4 green
4. four normal APK artifacts exist
5. production signed verification is 4/4 green
6. four signed APK artifacts exist
7. signer verification passes

Compile/build verification is not physical runtime verification.

## 11. Physical runtime testing

Test one APK for each engine using the same Android phone.

For all four engines test:

- install,
- cold launch,
- splash only once,
- Auto rotate preserving state,
- Portrait lock,
- Landscape lock,
- background/foreground,
- HTTPS load,
- Camera where selectable,
- Microphone where selectable,
- Location where selectable,
- Files where selectable,
- toolbar where selectable,
- external links where selectable,
- downloads where selectable,
- other selectable controls.

For Gecko additionally test actual effects of:

- AdGuard
- Ghostery
- Privacy Badger
- Dark Reader
- uBlock Origin

Runtime results are:

- PASS
- FAIL
- NOT TESTED

Only physical PASS can promote a feature to Verified.

## 12. Success criteria

The repair is complete only when:

- all four engines compile/build successfully,
- all four signed APKs verify,
- Auto rotation no longer restarts splash/browser,
- Portrait/Landscape behave correctly,
- splash is cold-launch-only,
- Gecko extension loader appears only when extension work is needed,
- selected Gecko extensions are enabled before protected first load,
  or enter a clear recoverable failure state,
- long/stuck white-screen behavior is eliminated or replaced by a
  bounded visible Retry/error state,
- unsupported capabilities remain gray and disabled,
- manifest-only permissions are never presented as working website APIs,
- current working signing/toolbar/download/permission features remain,
- physical runtime results are recorded truthfully.
