# Engine Capability Verification Design

Date: 2026-09-10
Repository: JepongDevxyz/Jepong-Devxyz-Website-to-APK-Builder

## Goal

Make the Website-to-APK Builder truthful and reliable across:

- Native WebView
- GeckoView
- Capacitor
- Cordova

Any option shown as supported must have a real implementation and must be verified.

Android permission declarations alone do NOT count as a working website capability.

## Capability statuses

Every feature per engine will be one of:

- Verified
- Experimental
- Unsupported

Only Verified features are enabled normally.

Experimental features must be clearly marked.

Unsupported features must be disabled with a reason.

## Device capabilities

Audit and implement where technically possible:

- Camera
- Microphone
- Notifications
- Location
- Photos & videos
- Contacts
- Calendar
- Biometrics
- Files & documents
- Bluetooth
- Sensors

Each feature must distinguish between:

1. Standard Web API
2. Android runtime permission
3. Native bridge
4. Engine-specific delegate/API

Advanced features such as Contacts, Calendar, Biometrics, Bluetooth,
and Sensors must not be advertised as standard website APIs if they
require a custom native bridge.

## Website controls

Audit and implement per engine:

- Pull-to-refresh
- Hide scrollbars
- Transparent system bars
- Pinch-to-zoom
- Disable copy
- Redirect/ad blocking
- Navigation toolbar
- External-link handling
- Download manager
- File picker/upload

A visible toggle is not proof that a feature works.

## Extensions

Firefox-style extensions remain GeckoView-only unless another engine
has a real equivalent implementation.

Do not claim extension support on Native, Capacitor, or Cordova if it
does not actually exist.

## Notifications vs Web Push

Normal Web Notifications and Web Push are separate.

Web Notifications:
- current website requests permission
- notification is displayed through engine/native integration

Web Push:
- service worker
- push subscription
- endpoint
- cryptographic keys
- backend delivery
- background handling

Web Push must remain unsupported/experimental until the full flow works.

## Security

Native bridge APIs must only be exposed to the configured website origin.

External or third-party pages must not automatically inherit privileged
native access.

Avoid unrestricted Android JavaScript bridges.

Advanced native APIs should use a namespaced API such as:

Jepong.contacts
Jepong.calendar
Jepong.biometrics
Jepong.bluetooth
Jepong.sensors
Jepong.files

Only selected capabilities should be exposed.

## Engine strategy

### Native WebView

Use standard WebView APIs when available.

Use secure origin-scoped native adapters only when WebView cannot
provide the capability directly.

Keep Native lightweight.

### GeckoView

Use GeckoView delegates for:

- permissions
- media
- location
- notifications
- navigation
- downloads
- file prompts
- extensions

Preserve existing per-site permission controls and extension diagnostics.

Fix the current notification compile regression before adding more.

### Capacitor

Use Capacitor's Android/native layer and WebView.

Use native Capacitor APIs where they are safer or more reliable.

Keep capability behavior aligned with the shared contract.

### Cordova

Use Cordova's native bridge and Android WebView layer.

Keep capability behavior aligned with the shared contract.

## Shared capability matrix

Create one canonical capability matrix used by:

- UI
- config validation
- generators
- automated tests
- compatibility display
- verification reports

Each entry records:

- engine
- capability
- Verified / Experimental / Unsupported
- implementation type
- compile verification
- runtime verification
- unsupported reason when applicable

This prevents UI claims from drifting away from actual implementation.

## Verification levels

Each feature progresses through:

1. Declared
2. Generated
3. Compile-verified
4. APK-artifact verified
5. Signed-build verified
6. Physical-device runtime verified

Compile success must never be presented as runtime proof.

## CI acceptance criteria

Every implementation batch must pass:

- npm test
- JS/YAML syntax
- Native Android build
- Gecko Android build
- Capacitor Android build
- Cordova Android build
- all 4 APK artifacts uploaded in the SAME latest Verify run

If one engine fails, the batch is not complete.

## Rollout

### Batch 4A
Capability audit + truthful compatibility matrix.

Also fix the current Gecko notification compilation error.

### Batch 4B
Native WebView capability completion.

### Batch 4C
GeckoView capability completion.

### Batch 4D
Capacitor capability completion.

### Batch 4E
Cordova capability completion.

### Batch 4F
Signed runtime APK testing for all four engines.

## Current Gecko regression

Current notification code fails compilation because generated code uses:

android.app.Notification.Builder.setSilent(true)

That method is unavailable in the current generated Android API usage.

Batch 4A will replace it with an Android-compatible notification
implementation.

## Rules

Do not:

- fake support
- treat manifest permissions as functional APIs
- promise universal engine parity where technically impossible
- expose unrestricted privileged bridges
- claim perfect ad blocking
- claim Web Push before it works end-to-end

## Success criteria

When a user selects an enabled capability:

- that engine contains a real implementation
- automated verification passes
- all four engines continue building
- supported/unsupported state is truthful
- physical runtime verification is tracked separately
