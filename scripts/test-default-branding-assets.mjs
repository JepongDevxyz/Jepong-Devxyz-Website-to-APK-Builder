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
    encodedPath:path.join(ROOT,'assets/default-icon.base64.txt'),
    sha256:'c21203d52d12fce3bca167c2154939373b80b57660c30f4752b711b581e2328b'
  },
  splash:{
    encodedPath:path.join(ROOT,'assets/default-splash.base64.txt'),
    sha256:'f28357f1a05e2f0ad9e031ab215c7108b3b42060c1ef54478a5da712f54bce6f'
  }
};

function sha256(buffer){
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function assertWebp(buffer,label){
  assert.equal(buffer.subarray(0,4).toString('ascii'),'RIFF',`${label}: missing RIFF header`);
  assert.equal(buffer.subarray(8,12).toString('ascii'),'WEBP',`${label}: default branding asset must be WebP`);
}

for(const [kind,spec] of Object.entries(EXPECTED)){
  assert.ok(fs.existsSync(spec.encodedPath),`${kind}: missing encoded default payload`);
  const source=Buffer.from(fs.readFileSync(spec.encodedPath,'utf8').replace(/\s+/g,''),'base64');
  assertWebp(source,kind);
  assert.equal(sha256(source),spec.sha256,`${kind}: unexpected default payload`);

  const fallback=brandedAsset({},kind);
  assert.equal(fallback.ext,'webp',`${kind}: fallback extension must be WebP`);
  assertWebp(fallback.buffer,kind);
  assert.equal(sha256(fallback.buffer),spec.sha256,`${kind}: brandedAsset fallback drifted`);
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
  const buffer=fs.readFileSync(file);
  assertWebp(buffer,label);
  assert.equal(sha256(buffer),expected,`${label}: default branding bytes changed`);
}

for(const engine of ['native','gecko','capacitor','cordova']){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),`jepong-default-${engine}-`));
  const cfg={...baseConfig,engine};

  if(engine==='native' || engine==='gecko'){
    writeNative(cfg,root,engine==='gecko');
    assertFileHash(path.join(root,'app/src/main/res/drawable-nodpi/app_icon.webp'),EXPECTED.icon.sha256,`${engine} icon`);
    assertFileHash(path.join(root,'app/src/main/res/drawable-nodpi/app_splash.webp'),EXPECTED.splash.sha256,`${engine} splash`);
  }

  if(engine==='capacitor'){
    writeCapacitor(cfg,root);
    assertFileHash(path.join(root,'branding/app_icon.webp'),EXPECTED.icon.sha256,'capacitor icon');
    assertFileHash(path.join(root,'branding/app_splash.webp'),EXPECTED.splash.sha256,'capacitor splash');
  }

  if(engine==='cordova'){
    writeCordova(cfg,root);
    for(const [file,hash,label] of [
      ['branding/app_icon.webp',EXPECTED.icon.sha256,'cordova branded icon'],
      ['branding/app_splash.webp',EXPECTED.splash.sha256,'cordova branded splash'],
      ['res/icon.webp',EXPECTED.icon.sha256,'cordova bootstrap icon'],
      ['res/screen/android/splash.webp',EXPECTED.splash.sha256,'cordova bootstrap splash']
    ]){
      assertFileHash(path.join(root,file),hash,label);
    }

    const xml=fs.readFileSync(path.join(root,'config.xml'),'utf8');
    assert.match(xml,/icon src="res\/icon\.webp"/,'cordova config must reference WebP icon');
    assert.match(xml,/AndroidWindowSplashScreenAnimatedIcon" value="res\/screen\/android\/splash\.webp"/,'cordova config must reference WebP splash');
  }

  fs.rmSync(root,{recursive:true,force:true});
}

console.log('✓ Jepong Devxyz requested defaults propagate as exact WebP branding to all four engines');
