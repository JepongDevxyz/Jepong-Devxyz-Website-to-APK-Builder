/* TV optimization contract test (all four engines).
   Verifies that tvOptimized=true adds the Android TV / Google TV declarations
   (touchscreen optional, Leanback banner + launcher, landscape, hardware
   acceleration, banner drawable) and that tvOptimized=false changes nothing. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { writeNative, writeTvBanner } from './write-native.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'jepong-tv-opt-'));
let failures = 0;
function check(name, cond) {
  if (cond) { console.log(`  PASS: ${name}`); }
  else { failures++; console.error(`  FAIL: ${name}`); }
}

const baseCfg = {
  websiteUrl: 'https://example.com',
  appName: 'TV Test',
  packageName: 'com.jepongdevxyz.tvtest',
  versionName: '1.0.0',
  versionCode: 1,
  engine: 'native',
  renderMode: 'software',
  orientation: 'auto',
  permissions: [],
  controls: [],
  extensions: [],
  oneSignalAppId: '',
  offlineFallback: 'Offline',
  iconDataUrl: '',
  splashDataUrl: '',
  splashEnabled: false,
  apkSigner: false,
};

/* ---------- native + gecko (writeNative) ---------- */
for (const gecko of [false, true]) {
  const engine = gecko ? 'gecko' : 'native';
  for (const tv of [true, false]) {
    console.log(`writeNative engine=${engine} tvOptimized=${tv}`);
    const out = path.join(temp, `${engine}-${tv}`);
    writeNative({ ...baseCfg, engine, tvOptimized: tv }, out, gecko);
    const manifest = fs.readFileSync(path.join(out, 'app/src/main/AndroidManifest.xml'), 'utf8');
    const bannerPath = path.join(out, 'app/src/main/res/drawable/app_banner.xml');
    check('touchscreen uses-feature required=false', (manifest.includes('android.hardware.touchscreen') && manifest.includes('android:required="false"')) === tv);
    check('android:banner attr', manifest.includes('android:banner="@drawable/app_banner"') === tv);
    check('LEANBACK_LAUNCHER category', manifest.includes('android.intent.category.LEANBACK_LAUNCHER') === tv);
    check('LAUNCHER category kept', manifest.includes('android.intent.category.LAUNCHER'));
    check('landscape forced on TV', (manifest.includes('android:screenOrientation="landscape"')) === tv);
    check('hardwareAccelerated=true on TV', (manifest.includes('android:hardwareAccelerated="true"')) === tv);
    check('banner drawable written', fs.existsSync(bannerPath) === tv);
    if (tv) {
      const banner = fs.readFileSync(bannerPath, 'utf8');
      check('banner is layer-list with app_icon', banner.includes('<layer-list') && banner.includes('@drawable/app_icon'));
    }
  }
}

/* ---------- capacitor (patch-android-platform.mjs) ---------- */
const root = process.cwd();
for (const tv of [true, false]) {
  console.log(`patch-android-platform engine=capacitor tvOptimized=${tv}`);
  const id = `test-tv-cap-${tv}`;
  const buildPath = path.join(root, 'builds', `${id}.json`);
  const project = path.join(root, 'work', id, 'project');
  const cleanup = () => {
    fs.rmSync(path.join(root, 'work', id), { recursive: true, force: true });
    fs.rmSync(buildPath, { force: true });
  };
  cleanup();
  fs.mkdirSync(path.dirname(buildPath), { recursive: true });
  fs.writeFileSync(buildPath, JSON.stringify({ ...baseCfg, engine: 'capacitor', tvOptimized: tv }, null, 2));
  const app = path.join(project, 'android', 'app');
  const javaDir = path.join(app, 'src/main/java/com/jepongdevxyz/tvtest');
  fs.mkdirSync(javaDir, { recursive: true });
  fs.mkdirSync(path.join(app, 'src/main/res/values'), { recursive: true });
  fs.writeFileSync(path.join(app, 'src/main/AndroidManifest.xml'),
`<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application android:icon="@mipmap/ic_launcher">
    <activity android:name=".MainActivity" android:exported="true">
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>
    </activity>
  </application>
</manifest>`);
  fs.writeFileSync(path.join(app, 'build.gradle'),
`android {
  namespace 'com.jepongdevxyz.tvtest'
  defaultConfig {
    versionCode 1
    versionName "1.0"
  }
}
dependencies {
  implementation 'example:dep:1'
}
`);
  fs.writeFileSync(path.join(app, 'src/main/res/values/styles.xml'), '<resources></resources>');
  fs.writeFileSync(path.join(javaDir, 'MainActivity.java'), 'package com.jepongdevxyz.tvtest; public class MainActivity {}');

  const run = spawnSync(process.execPath, ['scripts/patch-android-platform.mjs', '--build-id', id, '--engine', 'capacitor'], { cwd: root, encoding: 'utf8' });
  check('patch script exits 0', run.status === 0);
  if (run.status !== 0) console.error(run.stderr?.slice(0, 500));
  const manifest = fs.readFileSync(path.join(app, 'src/main/AndroidManifest.xml'), 'utf8');
  const bannerPath = path.join(app, 'src/main/res/drawable/app_banner.xml');
  check('touchscreen uses-feature required=false', (manifest.includes('android.hardware.touchscreen') && manifest.includes('android:required="false"')) === tv);
  check('android:banner attr', manifest.includes('android:banner="@drawable/app_banner"') === tv);
  check('LEANBACK_LAUNCHER category', manifest.includes('android.intent.category.LEANBACK_LAUNCHER') === tv);
  check('landscape forced on TV', manifest.includes('android:screenOrientation="landscape"') === tv);
  check('banner drawable written', fs.existsSync(bannerPath) === tv);
  cleanup();
}

/* writeTvBanner is exported for reuse; smoke-check it directly too. */
{
  const out = path.join(temp, 'banner-direct');
  writeTvBanner(out);
  check('writeTvBanner export works', fs.existsSync(path.join(out, 'app/src/main/res/drawable/app_banner.xml')));
}

fs.rmSync(temp, { recursive: true, force: true });
if (failures) { console.error(`\n${failures} TV optimization check(s) FAILED`); process.exit(1); }
console.log('\nAll TV optimization checks passed.');
