/* Tests for Fullscreen Mode (all four engines).
   New behavior: NO side panel. Bottom toolbar auto-hides after 3s idle, reappears on tap.
   Status bar uses IMMERSIVE_STICKY. Video fullscreen: absolutely no UI. */

import { writeNative } from './write-native.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let failures = 0;
function check(name, cond) {
  if (cond) {
    console.log(`  PASS: ${name}`);
  } else {
    console.log(`  FAIL: ${name}`);
    failures++;
  }
}

const baseCfg = {
  websiteUrl: 'https://example.com',
  appName: 'T',
  packageName: 'com.t.t',
  versionName: '1.0',
  versionCode: 1,
  controls: ['navigationToolbar'],
  permissions: [],
};

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fs-test-'));
}

function genNative(fullscreenMode) {
  const out = tmpDir();
  const cfg = { ...baseCfg, engine: 'native', fullscreenMode };
  writeNative(cfg, out, false);
  return fs.readFileSync(out + '/app/src/main/java/com/t/t/MainActivity.java', 'utf8');
}

function genGecko(fullscreenMode) {
  const out = tmpDir();
  const cfg = { ...baseCfg, engine: 'gecko', fullscreenMode };
  writeNative(cfg, out, true);
  return fs.readFileSync(out + '/app/src/main/java/com/t/t/MainActivity.java', 'utf8');
}

console.log('Native engine:');
{
  const java = genNative(true);
  check('no side panel (jepongBuildSidePanel absent)', !java.includes('jepongBuildSidePanel'));
  check('immersive sticky mode', java.includes('SYSTEM_UI_FLAG_IMMERSIVE_STICKY'));
  check('toolbar auto-hide setup', java.includes('jepongSetupToolbarAutoHide(bar)'));
  check('tap shows toolbar (dispatchTouchEvent)', java.includes('dispatchTouchEvent') && java.includes('jepongShowToolbar()'));
  check('3s auto-hide delay', java.includes('postDelayed(jepongUiHideRunnable,3000)'));
  check('toolbar hidden during video fullscreen', java.includes('jepongVideoFullscreen=true'));
  check('back exits fullscreen video', java.includes('jepongIsFullscreenVideo'));
}
console.log('Native engine (off):');
{
  const java = genNative(false);
  check('no toolbar auto-hide when off', !java.includes('jepongSetupToolbarAutoHide'));
  check('no immersive when off', !java.includes('jepongSetupImmersive'));
}

console.log('Gecko engine:');
{
  const java = genGecko(true);
  check('no side panel', !java.includes('jepongBuildSidePanel'));
  check('toolbar auto-hide setup', java.includes('jepongSetupToolbarAutoHide(navigationBar)'));
  check('tap shows toolbar', java.includes('jepongShowToolbar()'));
  check('video fullscreen hides UI', java.includes('jepongVideoFullscreen=true'));
}

console.log('Shared module:');
{
  const { fullscreenJavaMethods, fullscreenDispatchTouchEvent } = await import('./fullscreen-mode.mjs');
  const methods = fullscreenJavaMethods();
  check('no side panel in shared module', !methods.includes('jepongBuildSidePanel'));
  check('has immersive setup', methods.includes('jepongSetupImmersive'));
  check('has toolbar auto-hide', methods.includes('jepongSetupToolbarAutoHide'));
  check('has tap-to-show', methods.includes('jepongShowToolbar'));
  check('video fullscreen flag', methods.includes('jepongVideoFullscreen'));
  const touch = fullscreenDispatchTouchEvent();
  check('dispatchTouchEvent exported', touch.includes('dispatchTouchEvent'));
}

if (failures > 0) {
  console.log(`\n${failures} fullscreen check(s) FAILED`);
  process.exit(1);
} else {
  console.log('\nAll fullscreen mode checks passed.');
}
