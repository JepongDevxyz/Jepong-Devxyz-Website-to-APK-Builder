# Remaining Engine Verification Plan

> Execution plan for the remaining GeckoView, Capacitor, and Cordova verification work. This plan preserves evidence-first capability claims and keeps `main` untouched until the user explicitly requests integration.

## Goal

Finish the three remaining engine verification stages with fresh build/runtime evidence, then run one final cross-engine regression and clean up temporary verification workflows.

## Non-negotiable rules

- Compile success is not runtime proof.
- A visible UI toggle is not capability proof.
- Web Notifications are not Web Push.
- Unsupported capabilities stay Unsupported unless a real implementation and matching evidence exist.
- Physical-device-only claims stay Experimental when CI/emulator evidence is insufficient.
- Do not merge or move `main` during this plan.
- Every capability promotion must pass capability-policy/truth checks in the same verified state.

## Task 1 — Complete GeckoView verification

1. Reproduce/read the current DownloadManager failure evidence before editing production code.
2. Determine whether the failure is a production bug (for example header/filename handling), a DownloadManager failure, or a brittle runtime assertion.
3. Add/update the smallest failing regression test first when a production behavior change is required.
4. Run the representative Gecko generator and real Android APK build.
5. Run deterministic API 35 emulator coverage for navigation toolbar, external-link routing, file picker launch/return, transparent system bars, DownloadManager completion/content, and back/exit handling.
6. Assess Web Notification runtime separately; do not promote notification unless end-to-end behavior is actually demonstrated.
7. Update Gecko capability evidence/statuses only for capabilities whose required evidence is complete.
8. Run capability policy/truth checks, `npm test`, and `npm run check`.

## Task 2 — Complete Capacitor verification

1. Keep existing generator-level browser-control tests as the baseline.
2. Generate a representative Capacitor app and perform a fresh real Android APK build.
3. Add/adapt deterministic API 35 emulator runtime coverage for the controls that can be directly exercised: toolbar navigation, external links, DownloadManager, transparent system bars, back/exit handling, and any other behavior with a reliable assertion.
4. Do not promote pinch zoom or permission capabilities from source/build evidence alone; retain Experimental when direct runtime/physical proof is missing.
5. Record generator/build/emulator evidence and update capability status only where all required gates are satisfied.
6. Run capability policy/truth checks, `npm test`, and `npm run check`.

## Task 3 — Complete Cordova verification

1. Keep existing generator-level browser-control tests as the baseline.
2. Generate a representative Cordova app and perform a fresh real Android APK build.
3. Add/adapt deterministic API 35 emulator runtime coverage for toolbar navigation, external links, DownloadManager, transparent system bars, back/exit handling, and other reliably assertable controls.
4. Keep capabilities Experimental when runtime or physical evidence required by policy is unavailable.
5. Record generator/build/emulator evidence and update capability status only where all required gates are satisfied.
6. Run capability policy/truth checks, `npm test`, and `npm run check`.

## Task 4 — Final all-engine regression and cleanup

1. Run fresh representative builds for Native, GeckoView, Capacitor, and Cordova using the repository's all-engine verification workflow.
2. Run all deterministic runtime smoke jobs that are part of the verified state.
3. Run `npm test`, `npm run check`, and capability policy/truth validation in the same final state.
4. Fix any regression by returning to the relevant engine task and repeating its evidence gates.
5. Once the final production state is green, remove temporary one-off verification workflows that are no longer needed.
6. Record the last fully verified production commit SHA and the subsequent cleanup commit SHA separately.
7. Report exactly what is Verified, Experimental, and Unsupported; do not claim broader coverage than the fresh evidence supports.
