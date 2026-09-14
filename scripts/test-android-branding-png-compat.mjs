import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { writeNative } from './write-native.mjs';
import { writeCapacitor } from './write-capacitor.mjs';
import { writeCordova } from './write-cordova.mjs';

function pngColorType(buffer, label) {
  assert.deepEqual([...buffer.subarray(0, 8)], [137,80,78,71,13,10,26,10], `${label}: expected PNG signature`);
  assert.equal(buffer.toString('ascii', 12, 16), 'IHDR', `${label}: expected IHDR first chunk`);
  return buffer[25];
}

function assertAndroidSafeSplash(file, label) {
  assert.ok(fs.existsSync(file), `${label}: missing ${file}`);
  const colorType = pngColorType(fs.readFileSync(file), label);
  assert.notEqual(
    colorType,
    3,
    `${label}: Android splash PNG must not remain indexed/palette color type 3`
  );
}

const baseConfig = {
  websiteUrl: 'https://example.com',
  appName: 'Android PNG Compatibility Test',
  packageName: 'com.jepongdevxyz.pngcompat',
  versionName: '1.0.0',
  versionCode: 1,
  renderMode: 'default',
  orientation: 'auto',
  permissions: [],
  controls: [],
  extensions: [],
  splashEnabled: true,
  splashDuration: 1500,
  oneSignalAppId: '',
  offlineFallback: 'Offline',
  iconDataUrl: '',
  splashDataUrl: ''
};

for (const engine of ['native', 'capacitor', 'cordova']) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `jepong-png-compat-${engine}-`));
  const cfg = { ...baseConfig, engine };

  if (engine === 'native') {
    writeNative(cfg, root, false);
    assertAndroidSafeSplash(path.join(root, 'app/src/main/res/drawable-nodpi/app_splash.png'), 'native splash');
  } else if (engine === 'capacitor') {
    writeCapacitor(cfg, root);
    assertAndroidSafeSplash(path.join(root, 'branding/app_splash.png'), 'capacitor splash');
  } else {
    writeCordova(cfg, root);
    assertAndroidSafeSplash(path.join(root, 'branding/app_splash.png'), 'cordova branded splash');
    assertAndroidSafeSplash(path.join(root, 'res/screen/android/splash.png'), 'cordova bootstrap splash');
  }

  fs.rmSync(root, { recursive: true, force: true });
}

console.log('✓ Android splash PNGs avoid indexed/palette color type 3 across Native, Capacitor and Cordova');
