import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { brandedAsset } from './common.mjs';
import { writeNative } from './write-native.mjs';
import { writeCapacitor } from './write-capacitor.mjs';
import { writeCordova } from './write-cordova.mjs';

function assertAndroidSafeImage(file, ext, label) {
  assert.ok(fs.existsSync(file), `${label}: missing ${file}`);
  const buffer=fs.readFileSync(file);
  assert.ok(buffer.length>1000, `${label}: unexpectedly small`);

  if(ext==='png'){
    assert.deepEqual([...buffer.subarray(0,8)],[137,80,78,71,13,10,26,10],`${label}: expected PNG signature`);
    assert.equal(buffer.toString('ascii',12,16),'IHDR',`${label}: expected IHDR first chunk`);
    assert.notEqual(buffer[25],3,`${label}: Android splash PNG must not remain indexed/palette color type 3`);
  }else if(ext==='webp'){
    assert.equal(buffer.toString('ascii',0,4),'RIFF',`${label}: expected WebP RIFF header`);
    assert.equal(buffer.toString('ascii',8,12),'WEBP',`${label}: expected WebP signature`);
  }else{
    assert.ok(ext==='jpg',`${label}: unsupported Android branding format ${ext}`);
    assert.equal(buffer[0],0xff,`${label}: expected JPEG SOI`);
    assert.equal(buffer[1],0xd8,`${label}: expected JPEG SOI`);
  }
}

const splash=brandedAsset({},'splash');
const baseConfig={websiteUrl:'https://example.com',appName:'Android Branding Compatibility Test',packageName:'com.jepongdevxyz.pngcompat',versionName:'1.0.0',versionCode:1,renderMode:'default',orientation:'auto',permissions:[],controls:[],extensions:[],splashEnabled:true,splashDuration:1500,oneSignalAppId:'',offlineFallback:'Offline',iconDataUrl:'',splashDataUrl:''};

for(const engine of ['native','capacitor','cordova']){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),`jepong-branding-compat-${engine}-`));
  const cfg={...baseConfig,engine};

  if(engine==='native'){
    writeNative(cfg,root,false);
    assertAndroidSafeImage(path.join(root,`app/src/main/res/drawable-nodpi/app_splash.${splash.ext}`),splash.ext,'native splash');
  }else if(engine==='capacitor'){
    writeCapacitor(cfg,root);
    assertAndroidSafeImage(path.join(root,`branding/app_splash.${splash.ext}`),splash.ext,'capacitor splash');
  }else{
    writeCordova(cfg,root);
    assertAndroidSafeImage(path.join(root,`branding/app_splash.${splash.ext}`),splash.ext,'cordova branded splash');
    assertAndroidSafeImage(path.join(root,`res/screen/android/splash.${splash.ext}`),splash.ext,'cordova bootstrap splash');
  }

  fs.rmSync(root,{recursive:true,force:true});
}

console.log('✓ Android splash resources use an Android-safe image format across Native, Capacitor and Cordova');
