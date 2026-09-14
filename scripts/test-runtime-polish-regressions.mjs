import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { brandedAsset } from './common.mjs';
import { writeNative } from './write-native.mjs';
import { patchGeckoStartup } from './patch-gecko-startup.mjs';
import { patchCrossEngineBrowserUx } from './patch-cross-engine-browser-ux.mjs';

const cfg={
  websiteUrl:'https://pinoymovieshub.win',
  appName:'Pinoy Movies Hub',
  packageName:'com.jepongdevxyz.app',
  versionName:'1.0.3',
  versionCode:15,
  engine:'gecko',
  renderMode:'hardware',
  orientation:'auto',
  permissions:[],
  controls:['navigationToolbar','downloadManager'],
  extensions:['adguard','ghostery','privacyBadger','ublock'],
  splashEnabled:true,
  splashDuration:6000,
  apkSigner:true,
  sizeOptimization:true,
  abiTarget:'arm64-v8a',
  oneSignalAppId:'',
  offlineFallback:'Offline',
  iconDataUrl:'',
  splashDataUrl:''
};

const root=fs.mkdtempSync(path.join(os.tmpdir(),'jepong-runtime-polish-'));

try{
  writeNative(cfg,root,true);
  patchGeckoStartup(cfg,root);
  patchCrossEngineBrowserUx(cfg,root);

  const appRoot=path.join(root,'app');
  const manifest=fs.readFileSync(
    path.join(appRoot,'src/main/AndroidManifest.xml'),
    'utf8'
  );

  assert.match(
    manifest,
    /android:name="\.JepongSplashActivity"/,
    'Gecko must use the deterministic branded splash launcher too'
  );

  const splashStart=manifest.indexOf('android:name=".JepongSplashActivity"');
  const splashEnd=manifest.indexOf('</activity>',splashStart);
  const splashBlock=manifest.slice(splashStart,splashEnd);
  assert.match(splashBlock,/android\.intent\.action\.MAIN/);
  assert.match(splashBlock,/android\.intent\.category\.LAUNCHER/);

  const mainStart=manifest.indexOf('android:name=".MainActivity"');
  const mainEnd=manifest.indexOf('</activity>',mainStart);
  const mainBlock=manifest.slice(mainStart,mainEnd);
  assert.doesNotMatch(mainBlock,/android\.intent\.action\.MAIN/);
  assert.doesNotMatch(mainBlock,/android\.intent\.category\.LAUNCHER/);

  const splashJava=fs.readFileSync(
    path.join(
      appRoot,
      'src/main/java/com/jepongdevxyz/app/JepongSplashActivity.java'
    ),
    'utf8'
  );
  assert.match(splashJava,/SPLASH_DURATION_MS=6000L/);
  assert.match(splashJava,/getAssets\(\)\.open\("jepong_splash\.img"\)/);

  const expectedSplash=brandedAsset(cfg,'splash').buffer;
  const actualSplash=fs.readFileSync(
    path.join(appRoot,'src/main/assets/jepong_splash.img')
  );
  const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
  assert.equal(
    digest(actualSplash),
    digest(expectedSplash),
    'Gecko launcher must render the selected/default splash bytes'
  );

  const mainJava=fs.readFileSync(
    path.join(appRoot,'src/main/java/com/jepongdevxyz/app/MainActivity.java'),
    'utf8'
  );

  for(const token of [
    'void applyJepongSystemBars()',
    'android.graphics.Color.BLACK',
    'APPEARANCE_LIGHT_STATUS_BARS',
    'APPEARANCE_LIGHT_NAVIGATION_BARS',
    'void onResume()',
    'void onConfigurationChanged(',
    'applyJepongSystemBars();'
  ]){
    assert.ok(mainJava.includes(token),`missing rotation-safe system-bar contract: ${token}`);
  }

  assert.ok(
    mainJava.includes('boolean extensionSetupActive=false;'),
    'Gecko must track extension setup separately from website rendering'
  );
  assert.ok(
    mainJava.includes('void preloadWebsiteForExtensionSetup()'),
    'Gecko must preload the website while extensions are being prepared'
  );

  const prepareStart=mainJava.indexOf('void prepareExtensions(');
  const finishStart=mainJava.indexOf('void onExtensionsFinished()',prepareStart);
  const prepareBody=mainJava.slice(prepareStart,finishStart);
  assert.ok(
    prepareBody.includes('preloadWebsiteForExtensionSetup();'),
    'extension setup must start website loading in the background'
  );

  const finishEnd=mainJava.indexOf('void showExtensionLoader()',finishStart);
  const finishBody=mainJava.slice(finishStart,finishEnd);
  assert.doesNotMatch(
    finishBody,
    /loadWebsite\(\);/,
    'finishing extension setup must reveal the already-loading website instead of reloading it'
  );

  console.log('✓ runtime polish: Gecko splash, rotation-safe bars, and background website preload');
} finally {
  fs.rmSync(root,{recursive:true,force:true});
}
