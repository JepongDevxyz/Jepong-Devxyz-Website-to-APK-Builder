# Batch 7 Physical Runtime Checklist

Primary test site: **What PWA Can Do Today**  
Test URL: `https://whatpwacando.today/`

Device scope: one Android phone.

A successful compile, APK signature verification, or installation does
**not** automatically mean a feature is runtime verified.

Allowed result values:

- `PASS` — physically observed working on the test phone.
- `FAIL` — physically observed not working or producing an error.
- `NOT TESTED` — no physical result yet.

Unsupported capabilities are intentionally excluded. Do not use a demo
on the test website to claim builder support for Contacts, Calendar,
Biometrics, Bluetooth, Sensors, or other capabilities marked Unsupported
in `capabilities.mjs`.

## Native WebView

| Runtime check | Result | Notes |
|---|---|---|
| Install APK | NOT TESTED | |
| Launch app | NOT TESTED | |
| HTTPS site loads | NOT TESTED | |
| Camera | NOT TESTED | |
| Microphone | NOT TESTED | |
| Location | NOT TESTED | |
| Files / file chooser | NOT TESTED | |
| Pull-down refresh | NOT TESTED | |
| Hide scrollbars | NOT TESTED | |
| Transparent system bars | NOT TESTED | |
| Pinch to zoom | NOT TESTED | |
| Disable text copy | NOT TESTED | |
| Block ad redirects | NOT TESTED | Test redirect behavior only; this is not a claim of 100% ad blocking. |
| Navigation toolbar | NOT TESTED | Back / Next / Home / Reload / Share |
| External links | NOT TESTED | Off-site user-clicked link should follow configured routing. |
| Download manager | NOT TESTED | |

## GeckoView

Camera, Microphone, Location, and external-link routing passed an earlier
physical Gecko test. Re-test them on the final Batch 7 APK so the result
belongs to this exact runtime build.

| Runtime check | Result | Notes |
|---|---|---|
| Install APK | NOT TESTED | |
| Launch app | NOT TESTED | |
| HTTPS site loads | NOT TESTED | |
| Camera | NOT TESTED | |
| Microphone | NOT TESTED | |
| Location | NOT TESTED | |
| Notifications | NOT TESTED | Test normal Web Notifications, not Web Push subscription. |
| Files / file chooser | NOT TESTED | |
| Transparent system bars | NOT TESTED | |
| Navigation toolbar | NOT TESTED | Back / Next / Home / Reload / Share |
| External links | NOT TESTED | |
| Download manager | NOT TESTED | |
| Firefox WebExtensions — AdGuard | NOT TESTED | |
| Firefox WebExtensions — Ghostery | NOT TESTED | |
| Firefox WebExtensions — Privacy Badger | NOT TESTED | |
| Firefox WebExtensions — Dark Reader | NOT TESTED | |
| Firefox WebExtensions — uBlock Origin | NOT TESTED | |

## Capacitor

| Runtime check | Result | Notes |
|---|---|---|
| Install APK | NOT TESTED | |
| Launch app | NOT TESTED | |
| HTTPS site loads | NOT TESTED | |
| Camera | NOT TESTED | |
| Microphone | NOT TESTED | |
| Location | NOT TESTED | |
| Files / file chooser | NOT TESTED | |
| Transparent system bars | NOT TESTED | |
| Pinch to zoom | NOT TESTED | |
| Navigation toolbar | NOT TESTED | Back / Next / Home / Reload / Share |
| External links | NOT TESTED | |
| Download manager | NOT TESTED | |

## Cordova

| Runtime check | Result | Notes |
|---|---|---|
| Install APK | NOT TESTED | |
| Launch app | NOT TESTED | |
| HTTPS site loads | NOT TESTED | |
| Camera | NOT TESTED | |
| Microphone | NOT TESTED | |
| Location | NOT TESTED | |
| Files / file chooser | NOT TESTED | |
| Transparent system bars | NOT TESTED | |
| Pinch to zoom | NOT TESTED | |
| Navigation toolbar | NOT TESTED | Back / Next / Home / Reload / Share |
| External links | NOT TESTED | |
| Download manager | NOT TESTED | |

## Runtime verification rule

Only change a capability from Experimental to Verified in
`capabilities.mjs` after its corresponding physical check is `PASS`
on the exact Batch 7 runtime APK.

A failed or untested capability stays Experimental or Unsupported as
appropriate.
