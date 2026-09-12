# GeckoView Capability Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish evidence-backed verification for the remaining GeckoView capabilities without promoting any capability beyond what fresh build/runtime evidence proves.

**Architecture:** Keep `capabilities.mjs` as the user-facing truth matrix and `verification/capability-evidence.mjs` as the evidence registry. Verify the existing Gecko generator first, build a representative real APK, then exercise deterministic Gecko behavior in an Android API 35 emulator. Only capabilities with complete required evidence move from Experimental to Verified; unsupported website-facing APIs remain Unsupported.

**Tech Stack:** Node.js 22, Java 17, Gradle 9.6, Android SDK 37.1 for Gecko compilation, Android API 35 x86_64 emulator, GeckoView `154.0.20260824154132`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-10-engine-capability-verification-design.md`

## Global Constraints

- A visible toggle is not proof that a feature works.
- Compile success must never be presented as runtime proof.
- Android permission declarations alone do not count as a working website capability.
- Firefox-style extensions remain GeckoView-only.
- Web Notifications and Web Push are separate; do not claim Web Push.
- `adguardDns` remains Unsupported until a dedicated VPN/DNS layer exists.
- Do not merge `main` during this verification task.
- Do not promote a capability unless its required evidence is complete.

---

### Task 1: Gecko generator verification gate

**Files:**
- Create: `scripts/test-gecko-capability-verification.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `writeNative(cfg,out,true)`, `patchGeckoStartup(cfg,out)`, `patchCrossEngineBrowserUx(cfg,out)`, `patchModernBackManifest(out)`, `getCapabilityEvidence(engine,group,id)`
- Produces: a deterministic static verification command for Gecko permissions/controls and evidence records.

- [ ] **Step 1: Write generator assertions**

Generate one Gecko project with permissions `notification` and `files`, controls `transparentNav`, `navigationToolbar`, `externalLinks`, and `downloadManager`, then assert generated source contains:

```text
runtime.setWebNotificationDelegate(
PERMISSION_DESKTOP_NOTIFICATION
onFilePrompt(
ACTION_OPEN_DOCUMENT
setNavigationBarColor(
buildNavigationBar()
onCanGoBack(
onCanGoForward(
shouldOpenExternally(
onExternalResponse(
enqueueDownload(
showExitConfirmation()
showPoweredByToast()
```

Also assert `adguardDns` evidence stays Unsupported with a VPN/DNS reason.

- [ ] **Step 2: Run the new test before any Gecko production edit**

Run: `node scripts/test-gecko-capability-verification.mjs`

Expected: if it fails, the failure must identify a genuinely missing Gecko generator behavior; if it passes, no production edit is justified for that behavior.

- [ ] **Step 3: Add the test to `npm test`**

Insert `node scripts/test-gecko-capability-verification.mjs` into the existing test chain without removing any existing regression test.

- [ ] **Step 4: Run syntax/test gate**

Run:

```bash
node scripts/test-gecko-capability-verification.mjs
npm test
npm run check
```

Expected: all commands exit 0 before runtime work proceeds.

### Task 2: Real Gecko APK build workflow

**Files:**
- Create temporarily: `.github/workflows/task4-inline-verify.yml`

**Interfaces:**
- Consumes: existing build generator and GeckoView Maven dependency.
- Produces: a fresh debug APK for `com.jepongdevxyz.geckocontrolsverify` built from the same selected capability set used by Task 1.

- [ ] **Step 1: Add isolated Task 4 workflow**

Use Node 22, Java 17, Android SDK `platforms;android-37.1`, build-tools `37.0.0` and `36.0.0`, Gradle 9.6, then run:

```bash
node scripts/test-gecko-capability-verification.mjs
node scripts/build.mjs prepare --build-id task4-gecko-controls
node scripts/build.mjs generate --build-id task4-gecko-controls
cd work/task4-gecko-controls/project
gradle --no-daemon :app:assembleDebug --stacktrace
```

- [ ] **Step 2: Require a real build result**

Expected evidence: `BUILD SUCCESSFUL` and a non-empty debug APK under `app/build/outputs/apk/debug/`.

### Task 3: Deterministic Gecko emulator runtime smoke

**Files:**
- Create: `scripts/runtime/gecko-controls-smoke.mjs`
- Reuse: `scripts/runtime/quickstep-anr-guard.mjs`
- Modify temporarily: `.github/workflows/task4-inline-verify.yml`

**Interfaces:**
- Consumes: the Task 2 APK and a local HTTP server available to the emulator at `10.0.2.2`.
- Produces: direct runtime evidence for toolbar navigation, external routing regression, file picker, download routing, exit handling, and notification flow where deterministic.

- [ ] **Step 1: Build deterministic local pages**

Serve `/index.html`, `/page2.html`, and `/download.txt`. Include buttons/links for page navigation, `<input type="file">`, a downloadable attachment, and a notification request button.

- [ ] **Step 2: Verify Gecko toolbar behavior**

Launch the app, assert Back/Next/Home/Reload/Share labels exist, navigate to page 2, then verify Back, Next, Home, and Reload produce the expected page transitions.

- [ ] **Step 3: Verify external-link regression**

Trigger a user-clicked `tel:` or off-site link, confirm an external Android activity becomes resumed, then return and confirm the Gecko app resumes.

- [ ] **Step 4: Verify file picker**

Tap the local file input and require a system picker activity such as DocumentsUI to become foreground. Return to the Gecko app deterministically.

- [ ] **Step 5: Verify download path**

Trigger `/download.txt`, confirm the local HTTP server receives the download request initiated after Gecko `onExternalResponse`, and confirm the app does not crash.

- [ ] **Step 6: Verify notification flow if stable in emulator**

Request Web Notification permission from the local page, interact with the Gecko site-permission dialog and Android notification permission where applicable, then inspect `dumpsys notification` for the app/channel/title. If emulator notification behavior cannot be made deterministic, keep Gecko Notifications Experimental and record the missing evidence rather than weakening the test.

- [ ] **Step 7: Verify exit confirmation and crash-free runtime**

Return to the root page, send system Back, require the Exit/Cancel confirmation, dismiss it, and scan logcat for fatal exceptions/ANRs attributable to the app.

### Task 4: Runtime-state evidence for non-visual controls

**Files:**
- Create if needed: `scripts/runtime/gecko-controls-state-probe.mjs`
- Modify temporarily: `.github/workflows/task4-inline-verify.yml`

**Interfaces:**
- Consumes: a test-only instrumented generated APK only when Android/Gecko state cannot be observed externally.
- Produces: live runtime evidence without modifying production generator source.

- [ ] **Step 1: Probe transparent system bars**

Use either reliable WindowManager output or test-only generated-activity logging to verify navigation/status colors are transparent while the app is running.

- [ ] **Step 2: Keep instrumentation test-only**

Any logging/probe insertion happens after project generation inside the temporary workflow. Do not commit instrumentation into `write-native.mjs` unless a real production bug is discovered through a failing test.

- [ ] **Step 3: Re-run an uninstrumented APK before completion**

After evidence is collected, remove test-only generation rewrites and require one final build + runtime smoke against a plain production-generated Gecko APK.

### Task 5: Truthful evidence/status promotion

**Files:**
- Modify: `verification/capability-evidence.mjs`
- Modify: `capabilities.mjs`
- Modify if stale: Gecko-specific regression tests/package test chain.

**Interfaces:**
- Consumes: fresh Task 2–4 evidence.
- Produces: capability states that match actual evidence.

- [ ] **Step 1: Promote only proven capabilities**

Set `generator:true`, `build:true`, and required runtime fields only for capabilities actually exercised. Keep `physical:false` unless a physical-device test exists.

- [ ] **Step 2: Preserve Experimental where evidence is incomplete**

In particular, do not promote Gecko Notifications or Files merely because the source compiles; keep their reason explicit if physical/runtime evidence remains incomplete.

- [ ] **Step 3: Run policy and truth gates**

Run:

```bash
node scripts/test-capability-evidence-policy.mjs
node scripts/test-capability-truth.mjs
npm test
npm run check
```

Expected: all commands exit 0 and no Verified capability lacks complete required evidence.

### Task 6: Final cross-engine regression and cleanup

**Files:**
- Temporary: `.github/workflows/task4-inline-verify.yml`

**Interfaces:**
- Consumes: final Task 4 source.
- Produces: a clean Task 4 branch with verification workflow removed after a successful predecessor run.

- [ ] **Step 1: Run final plain-production Gecko verification**

Require generator test, real Gecko APK build, emulator smoke, capability policy/truth tests, full `npm test`, and `npm run check` in one fresh workflow run.

- [ ] **Step 2: Do not claim all-engine completion from Gecko-only evidence**

The final report must distinguish Task 4 Gecko completion from remaining Capacitor/Cordova verification.

- [ ] **Step 3: Remove temporary workflow only after GREEN evidence**

Delete `.github/workflows/task4-inline-verify.yml` in a cleanup commit. Record the verified predecessor SHA and cleanup SHA separately.
