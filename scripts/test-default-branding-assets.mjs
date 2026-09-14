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
    sha256:'6ab9643daddf071d03f9f8ff62f6702e60d100a46343cfafcf554c3a0f6ecca5',
    width:1536,
    height:1536
  },
  splash:{
    path:path.join(ROOT,'assets/default-splash.png'),
    sha256:'c819f2aea8dddf1904046b79cd725c424aeb92ed34ba013c1a6a59fb86ad8087',
    width:864,
    height:1536
  }
};

function sha256(buffer){
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function pngSize(buffer){
  assert.deepEqual(
    [...buffer.subarray(0,8)],
    [137,80,78,71,13,10,26,10],
    'default branding asset must be a real PNG'
  );

  return {
    width:buffer.readUInt32BE(16),
    height:buffer.readUInt32BE(20)
  };
}

for(const [kind,spec] of Object.entries(EXPECTED)){
  const buffer=fs.readFileSync(spec.path);
  const size=pngSize(buffer);

  assert.equal(sha256(buffer),spec.sha256,`${kind}: unexpected default asset`);
  assert.equal(size.width,spec.width,`${kind}: unexpected width`);
  assert.equal(size.height,spec.height,`${kind}: unexpected height`);

  const fallback=brandedAsset({},kind);
  assert.equal(fallback.ext,'png',`${kind}: fallback extension must remain PNG`);
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
  assert.equal(sha256(fs.readFileSync(file)),expected,`${label}: default branding bytes changed`);
}

for(const engine of ['native','gecko','capacitor','cordova']){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),`jepong-default-${engine}-`));
  const cfg={...baseConfig,engine};

  if(engine==='native' || engine==='gecko'){
    writeNative(cfg,root,engine==='gecko');
    assertFileHash(
      path.join(root,'app/src/main/res/drawable-nodpi/app_icon.png'),
      EXPECTED.icon.sha256,
      `${engine} icon`
    );
    assertFileHash(
      path.join(root,'app/src/main/res/drawable-nodpi/app_splash.png'),
      EXPECTED.splash.sha256,
      `${engine} splash`
    );
  }

  if(engine==='capacitor'){
    writeCapacitor(cfg,root);
    assertFileHash(
      path.join(root,'branding/app_icon.png'),
      EXPECTED.icon.sha256,
      'capacitor icon'
    );
    assertFileHash(
      path.join(root,'branding/app_splash.png'),
      EXPECTED.splash.sha256,
      'capacitor splash'
    );
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
  }

  fs.rmSync(root,{recursive:true,force:true});
}

console.log('✓ Jepong Devxyz default icon/splash propagate to all four engines');
