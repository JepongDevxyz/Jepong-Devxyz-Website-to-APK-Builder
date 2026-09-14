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

function assertAndroidSafePng(file, label) {
  assert.ok(fs.existsSync(file), `${label}: missing ${file}`);
  const colorType = pngColorType(fs.readFileSync(file), label);
  assert.ok(
    colorType === 2 || colorType === 6,
    `${label}: Android branding PNG must be true-color RGB/RGBA, got PNG color type ${colorType}`
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
    assertAndroidSafePng(path.join(root, 'app/src/main/res/drawable-nodpi/app_icon.png'), 'native icon');
    assertAndroidSafePng(path.join(root, 'app/src/main/res/drawable-nodpi/app_splash.png'), 'native splash');
  } else if (engine === 'capacitor') {
    writeCapacitor(cfg, root);
    assertAndroidSafePng(path.join(root, 'branding/app_icon.png'), 'capacitor icon');
    assertAndroidSafePng(path.join(root, 'branding/app_splash.png'), 'capacitor splash');
  } else {
    writeCordova(cfg, root);
    assertAndroidSafePng(path.join(root, 'branding/app_icon.png'), 'cordova icon');
    assertAndroidSafePng(path.join(root, 'branding/app_splash.png'), 'cordova splash');
    assertAndroidSafePng(path.join(root, 'res/icon.png'), 'cordova bootstrap icon');
    assertAndroidSafePng(path.join(root, 'res/screen/android/splash.png'), 'cordova bootstrap splash');
  }

  fs.rmSync(root, { recursive: true, force: true });
}

console.log('✓ Android branding PNGs are true-color RGB/RGBA across Native, Capacitor and Cordova');
