import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { brandedAsset } from './common.mjs';
import { writeNative } from './write-native.mjs';
import { writeCapacitor } from './write-capacitor.mjs';
import { writeCordova } from './write-cordova.mjs';

const ROOT=path.resolve(process.cwd());

const EXPECTED={
  icon:{
    path:path.join(ROOT,'assets/default-icon.png'),
    sha256:'61d47cb6d913f404bd6287485762db115907a7b1221243c73780e4d6bae0fee2',
    width:256,
    height:256
  },
  splash:{
    path:path.join(ROOT,'assets/default-splash.png'),
    sha256:'c3117fe7dc6faa1a0dc338ac06b2f4018111f23215c2d89af78842da9ab3a805',
    width:270,
    height:480
  }
};

function sha256(buffer){
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function pngSize(buffer,label){
  assert.deepEqual(
    [...buffer.subarray(0,8)],
    [137,80,78,71,13,10,26,10],
    `${label}: default branding asset must be a real PNG`
  );
  return { width:buffer.readUInt32BE(16), height:buffer.readUInt32BE(20) };
}

const sourceIcon=fs.readFileSync(EXPECTED.icon.path);
const sourceSplash=fs.readFileSync(EXPECTED.splash.path);
assert.equal(sha256(sourceIcon),EXPECTED.icon.sha256,'icon: unexpected default source asset');
assert.equal(sha256(sourceSplash),EXPECTED.splash.sha256,'splash: unexpected default source asset');
assert.deepEqual(pngSize(sourceIcon,'icon'),{width:EXPECTED.icon.width,height:EXPECTED.icon.height});
assert.deepEqual(pngSize(sourceSplash,'splash'),{width:EXPECTED.splash.width,height:EXPECTED.splash.height});

const iconFallback=brandedAsset({},'icon');
const splashFallback=brandedAsset({},'splash');
assert.equal(iconFallback.ext,'png','icon: fallback extension must be PNG');
assert.equal(splashFallback.ext,'png','splash: fallback extension must be PNG');
assert.deepEqual(pngSize(iconFallback.buffer,'normalized icon'),{width:EXPECTED.icon.width,height:EXPECTED.icon.height});
assert.deepEqual(pngSize(splashFallback.buffer,'normalized splash'),{width:EXPECTED.splash.width,height:EXPECTED.splash.height});
assert.notEqual(iconFallback.buffer[25],3,'icon: Android output must not remain indexed/palette PNG');
assert.notEqual(splashFallback.buffer[25],3,'splash: Android output must not remain indexed/palette PNG');
const normalizedIconHash=sha256(iconFallback.buffer);
const normalizedSplashHash=sha256(splashFallback.buffer);

const baseConfig={
  websiteUrl:'https://example.com',
  appName:'Jepong Default Branding Test',
  packageName:'com.jepongdevxyz.defaultbranding',
  versionName:'1.0.0',
  versionCode:1,
  renderMode:'default',
  orientation:'auto',
  permissions:[],
  controls:[],
  extensions:[],
  splashEnabled:true,
  splashDuration:1500,
  oneSignalAppId:'',
  offlineFallback:'Offline',
  iconDataUrl:'',
  splashDataUrl:''
};

function assertFileHash(file,expected,label){
  assert.ok(fs.existsSync(file),`${label}: missing ${file}`);
  assert.equal(sha256(fs.readFileSync(file)),expected,`${label}: branding bytes changed`);
}

for(const engine of ['native','gecko','capacitor','cordova']){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),`jepong-default-${engine}-`));
  const cfg={...baseConfig,engine};

  if(engine==='native' || engine==='gecko'){
    writeNative(cfg,root,engine==='gecko');
    assertFileHash(path.join(root,'app/src/main/res/drawable-nodpi/app_icon.png'),normalizedIconHash,`${engine} icon`);
    assertFileHash(path.join(root,'app/src/main/res/drawable-nodpi/app_splash.png'),normalizedSplashHash,`${engine} splash`);
  }

  if(engine==='capacitor'){
    writeCapacitor(cfg,root);
    assertFileHash(path.join(root,'branding/app_icon.png'),normalizedIconHash,'capacitor icon');
    assertFileHash(path.join(root,'branding/app_splash.png'),normalizedSplashHash,'capacitor splash');
  }

  if(engine==='cordova'){
    writeCordova(cfg,root);
    for(const [file,hash,label] of [
      ['branding/app_icon.png',normalizedIconHash,'cordova branded icon'],
      ['branding/app_splash.png',normalizedSplashHash,'cordova branded splash'],
      ['res/icon.png',normalizedIconHash,'cordova bootstrap icon'],
      ['res/screen/android/splash.png',normalizedSplashHash,'cordova bootstrap splash']
    ]){
      assertFileHash(path.join(root,file),hash,label);
    }

    const xml=fs.readFileSync(path.join(root,'config.xml'),'utf8');
    assert.match(xml,/icon src="res\/icon\.png"/,'cordova config must reference PNG icon');
    assert.match(xml,/AndroidWindowSplashScreenAnimatedIcon" value="res\/screen\/android\/splash\.png"/,'cordova config must reference PNG splash');
  }

  fs.rmSync(root,{recursive:true,force:true});
}

console.log('✓ Jepong Devxyz Android-safe default icon + splash propagate to all four engines');
