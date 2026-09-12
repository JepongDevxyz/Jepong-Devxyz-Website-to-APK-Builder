import fs from 'node:fs';
import assert from 'node:assert/strict';

const workflow=fs.readFileSync(new URL('../.github/workflows/task4-inline-verify.yml',import.meta.url),'utf8');
const runtimeMarker='node scripts/runtime/webview-engine-controls-smoke.mjs';
const launcherStop='adb shell am force-stop com.android.launcher3 || true';

const runtimeIndex=workflow.indexOf(runtimeMarker);
const launcherIndex=workflow.indexOf(launcherStop);

assert.ok(runtimeIndex>=0,'Task4 WebView runtime smoke invocation missing');
assert.ok(launcherIndex>=0,'Task4 WebView runtime must stabilize Launcher3 before smoke');
assert.ok(launcherIndex<runtimeIndex,'Launcher3 stabilization must run before WebView runtime smoke');

console.log('✓ Task4 WebView launcher stabilization contract');
