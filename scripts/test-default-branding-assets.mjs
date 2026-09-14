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
    path:path.join(ROOT,'assets/default-icon.webp'),
    sha256:'b54ed79a651f1a683ada02a011a1daf478b94a19867055e0271daa10fdd1b49e'
  },
  splash:{
    path:path.join(ROOT,'assets/default-splash.webp'),
    sha256:'eebb902f2dca467978f9d55e788fb2986c8ccad5207671f8db5e89ab645ad3bc'
  }
};

const PREVIEW={
  icon:{
    path:path.join(ROOT,'assets/default-icon.png'),
    sha256:'90c250ecfed072925643e1c1384d02a349574770533c8c17393b9c848f7c8983',
    width:256,
    height:256
  },
  splash:{
    path:path.join(ROOT,'assets/default-splash.png'),
    sha256:'66b6825639b8ed16c434b356ddbb36dfe4ea0d93d9cd4b696b1a6e1d481ef69c',
    width:270,
    height:480
  }
};

function sha256(buffer){
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function assertWebp(buffer,label){
  assert.equal(buffer.subarray(0,4).toString('ascii'),'RIFF',`${label}: missing RIFF header`);
  assert.equal(buffer.subarray(8,12).toString('ascii'),'WEBP',`${label}: missing WEBP signature`);
}

function pngSize(buffer){
  assert.deepEqual(
    [...buffer.subarray(0,8)],
    [137,80,78,71,13,10,26,10],
    'default preview asset must be a real PNG'
  );
  return { width:buffer.readUInt32BE(16), height:buffer.readUInt32BE(20) };
}

for(const [kind,spec] of Object.entries(EXPECTED)){
  const buffer=fs.readFileSync(spec.path);
  assertWebp(buffer,kind);
  assert.equal(sha256(buffer),spec.sha256,`${kind}: unexpected default asset`);

  const fallback=brandedAsset({},kind);
  assert.equal(fallback.ext,'webp',`${kind}: fallback extension must be WebP`);
  assert.equal(sha256(fallback.buffer),spec.sha256,`${kind}: brandedAsset fallback drifted`);
}

for(const [kind,spec] of Object.entries(PREVIEW)){
  const buffer=fs.readFileSync(spec.path);
  const size=pngSize(buffer);
  assert.equal(sha256(buffer),spec.sha256,`${kind}: unexpected website preview asset`);
  assert.equal(size.width,spec.width,`${kind}: unexpected preview width`);
  assert.equal(size.height,spec.height,`${kind}: unexpected preview height`);
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

console.log('✓ Jepong Devxyz default branding propagates to all four engines');
