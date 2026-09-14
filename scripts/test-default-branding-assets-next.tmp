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
    sourcePath:path.join(ROOT,'assets/default-icon.png'),
    sha256:'61d47cb6d913f404bd6287485762db115907a7b1221243c73780e4d6bae0fee2',
    width:256,
    height:256
  },
  splash:{
    encodedPath:path.join(ROOT,'assets/default-splash.base64.txt'),
    sha256:'971bc365446b61f3aa46113ad2e17939fe2347999aae0288873dee0030f33bac',
    width:72,
    height:128
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

const iconSource=fs.readFileSync(EXPECTED.icon.sourcePath);
assert.equal(sha256(iconSource),EXPECTED.icon.sha256,'icon: unexpected default asset');

const encodedSplash=fs.readFileSync(EXPECTED.splash.encodedPath,'utf8').trim();
const splashSource=Buffer.from(encodedSplash,'base64');
assert.equal(sha256(splashSource),EXPECTED.splash.sha256,'splash: unexpected decoded default payload');

for(const [kind,spec] of Object.entries(EXPECTED)){
  const fallback=brandedAsset({},kind);
  const size=pngSize(fallback.buffer,kind);
  assert.equal(fallback.ext,'png',`${kind}: fallback extension must be PNG`);
  assert.equal(sha256(fallback.buffer),spec.sha256,`${kind}: brandedAsset fallback drifted`);
  assert.equal(size.width,spec.width,`${kind}: unexpected width`);
  assert.equal(size.height,spec.height,`${kind}: unexpected height`);
}

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
  assert.equal(sha256(fs.readFileSync(file)),expected,`${label}: default branding bytes changed`);
}

for(const engine of ['native','gecko','capacitor','cordova']){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),`jepong-default-${engine}-`));
  const cfg={...baseConfig,engine};

  if(engine==='native' || engine==='gecko'){
    writeNative(cfg,root,engine==='gecko');
    assertFileHash(path.join(root,'app/src/main/res/drawable-nodpi/app_icon.png'),EXPECTED.icon.sha256,`${engine} icon`);
    assertFileHash(path.join(root,'app/src/main/res/drawable-nodpi/app_splash.png'),EXPECTED.splash.sha256,`${engine} splash`);
  }

  if(engine==='capacitor'){
    writeCapacitor(cfg,root);
    assertFileHash(path.join(root,'branding/app_icon.png'),EXPECTED.icon.sha256,'capacitor icon');
    assertFileHash(path.join(root,'branding/app_splash.png'),EXPECTED.splash.sha256,'capacitor splash');
  }

  if(engine==='cordova'){
    writeCordova(cfg,root);
    for(const [file,hash,label] of [
      ['branding/app_icon.png',EXPECTED.icon.sha256,'cordova branded icon'],
      ['branding/app_splash.png',EXPECTED.splash.sha256,'cordova branded splash'],
      ['res/icon.png',EXPECTED.icon.sha256,'cordova bootstrap icon'],
      ['res/screen/android/splash.png',EXPECTED.splash.sha256,'cordova bootstrap splash']
    ]){
      assertFileHash(path.join(root,file),hash,label);
    }

    const xml=fs.readFileSync(path.join(root,'config.xml'),'utf8');
    assert.match(xml,/icon src="res\/icon\.png"/,'cordova config must reference PNG icon');
    assert.match(xml,/AndroidWindowSplashScreenAnimatedIcon" value="res\/screen\/android\/splash\.png"/,'cordova config must reference PNG splash');
  }

  fs.rmSync(root,{recursive:true,force:true});
}

console.log('✓ Jepong Devxyz default branding propagates Android-safe PNGs to all four engines');
