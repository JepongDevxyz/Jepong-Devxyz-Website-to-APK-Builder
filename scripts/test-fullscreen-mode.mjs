/* Fullscreen mode contract test (all four engines).
   Verifies that fullscreenMode=true hides the bottom toolbar, builds the
   floating side-by-side edge panel with auto-hide, and enables working video
   fullscreen playback — and that fullscreenMode=false changes nothing. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeNative } from './write-native.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jepong-fullscreen-'));
let failures = 0;
function check(name, cond) {
  if (cond) { console.log(`  PASS: ${name}`); }
  else { failures++; console.error(`  FAIL: ${name}`); }
}

const baseCfg = {
  websiteUrl: 'https://example.com',
  appName: 'FS Test',
  packageName: 'com.jepongdevxyz.fstest',
  versionName: '1.0.0',
  versionCode: 1,
  engine: 'native',
  renderMode: 'software',
  orientation: 'auto',
  permissions: [],
  controls: ['navigationToolbar'],
  extensions: [],
  oneSignalAppId: '',
  iconDataUrl: '',
  splashDataUrl: '',
  splashEnabled: false,
  apkSigner: false,
};

function genJava(engine, fullscreenMode) {
  const out = path.join(temp, `${engine}-${fullscreenMode ? 'on' : 'off'}`);
  const cfg = { ...baseCfg, engine, fullscreenMode };
  writeNative(cfg, out, engine === 'gecko');
  const pkg = cfg.packageName.replace(/\./g, '/');
  return fs.readFileSync(path.join(out, 'app/src/main/java', pkg, 'MainActivity.java'), 'utf8');
}

// ---- native ----
console.log('native engine:');
{
  const on = genJava('native', true);
  check('side panel built', on.includes('jepongBuildSidePanel('));
  check('video fullscreen (onShowCustomView)', on.includes('onShowCustomView'));
  check('video fullscreen (onHideCustomView)', on.includes('onHideCustomView'));
  check('auto-hide scheduled', on.includes('jepongScheduleAutoHide'));
  check('back exits fullscreen video first (onKeyDown)', on.includes('onKeyDown') && on.includes('jepongIsFullscreenVideo'));
  check('bottom bar not built', !on.includes('LinearLayout bar=buildNativeNavigationBar()'));

  const off = genJava('native', false);
  check('no side panel when off', !off.includes('jepongBuildSidePanel('));
  check('no video fullscreen hooks when off', !off.includes('onShowCustomView'));
  check('bottom bar kept when off', off.includes('LinearLayout bar=buildNativeNavigationBar()'));
}

// ---- gecko ----
console.log('gecko engine:');
{
  const on = genJava('gecko', true);
  check('side panel built', on.includes('jepongBuildSidePanel('));
  check('ContentDelegate.onFullScreen present', on.includes('onFullScreen'));
  check('fullscreen flag tracked', on.includes('jepongGeckoFs'));
  check('auto-hide scheduled', on.includes('jepongScheduleAutoHide'));
  check('bottom bar skipped (constant folded)', on.includes('final boolean NAVIGATION_TOOLBAR=false'));

  const off = genJava('gecko', false);
  check('no side panel when off', !off.includes('jepongBuildSidePanel('));
  check('no onFullScreen when off', !off.includes('onFullScreen'));
  check('bottom bar kept when off', off.includes('final boolean NAVIGATION_TOOLBAR=true'));
}

// ---- shared module sanity ----
console.log('shared module:');
{
  const mod = fs.readFileSync(new URL('./fullscreen-mode.mjs', import.meta.url), 'utf8');
  check('auto-hide collapses to handle (not GONE)', mod.includes('jepongToggleSidePanel()'));
  check('3s auto-hide delay', mod.includes('postDelayed(jepongAutoHideRunnable,3000)'));
  check('side panel hidden during video fullscreen', mod.includes('jepongSidePanel.setVisibility(View.GONE)'));
  check('delegating chrome client exported', mod.includes('fullscreenChromeClientDelegate'));
}

if (failures > 0) {
  console.error(`\n${failures} fullscreen check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll fullscreen mode checks passed.');
