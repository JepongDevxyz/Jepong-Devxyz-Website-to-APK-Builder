import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { brandedAsset } from './common.mjs';
import { writeNative } from './write-native.mjs';
import { writeCapacitor } from './write-capacitor.mjs';
import { writeCordova } from './write-cordova.mjs';
function sha256(buffer){return crypto.createHash('sha256').update(buffer).digest('hex');}
function assertBrand(asset,label){assert.ok(['png','jpg','webp'].includes(asset.ext),`${label}: unsupported format ${asset.ext}`);assert.ok(asset.buffer.length>1000,`${label}: unexpectedly small`);}
const icon=brandedAsset({},'icon'),splash=brandedAsset({},'splash');
assert.equal(icon.ext,'webp','default icon must use approved WebP artwork');
assert.equal(splash.ext,'webp','default splash must use approved WebP artwork');
assert.equal(sha256(icon.buffer),'b9e1b537525ecc1eb494e887372fc71d5d5e7aae511295ad7914200111487e03','default icon artwork hash mismatch');
assert.equal(sha256(splash.buffer),'20e40797911393f99be995b8e57a4f280ac3cf4d74a30508955109980459fa35','default splash artwork hash mismatch');
assertBrand(icon,'default icon');assertBrand(splash,'default splash');
const iconHash=sha256(icon.buffer),splashHash=sha256(splash.buffer);
const baseConfig={websiteUrl:'https://example.com',appName:'Jepong Default Branding Test',packageName:'com.jepongdevxyz.defaultbranding',versionName:'1.0.0',versionCode:1,renderMode:'default',orientation:'auto',permissions:[],controls:[],extensions:[],splashEnabled:true,splashDuration:1500,apkSigner:true,oneSignalAppId:'',offlineFallback:'Offline',iconDataUrl:'',splashDataUrl:''};
function assertFileHash(file,expected,label){assert.ok(fs.existsSync(file),`${label}: missing ${file}`);assert.equal(sha256(fs.readFileSync(file)),expected,`${label}: branding bytes changed`);}
for(const engine of ['native','gecko','capacitor','cordova']){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),`jepong-default-${engine}-`));
  const cfg={...baseConfig,engine};
  if(engine==='native'||engine==='gecko'){
    writeNative(cfg,root,engine==='gecko');
    assertFileHash(path.join(root,`app/src/main/res/drawable-nodpi/app_icon.${icon.ext}`),iconHash,`${engine} icon`);
    assertFileHash(path.join(root,`app/src/main/res/drawable-nodpi/app_splash.${splash.ext}`),splashHash,`${engine} splash`);
  }
  if(engine==='capacitor'){
    writeCapacitor(cfg,root);
    assertFileHash(path.join(root,`branding/app_icon.${icon.ext}`),iconHash,'capacitor icon');
    assertFileHash(path.join(root,`branding/app_splash.${splash.ext}`),splashHash,'capacitor splash');
  }
  if(engine==='cordova'){
    writeCordova(cfg,root);
    for(const [file,hash,label] of [[`branding/app_icon.${icon.ext}`,iconHash,'cordova branded icon'],[`branding/app_splash.${splash.ext}`,splashHash,'cordova branded splash'],[`res/icon.${icon.ext}`,iconHash,'cordova bootstrap icon'],[`res/screen/android/splash.${splash.ext}`,splashHash,'cordova bootstrap splash']])assertFileHash(path.join(root,file),hash,label);
    const xml=fs.readFileSync(path.join(root,'config.xml'),'utf8');
    assert.ok(xml.includes(`icon src="res/icon.${icon.ext}"`));
    assert.ok(xml.includes(`AndroidWindowSplashScreenAnimatedIcon" value="res/screen/android/splash.${splash.ext}"`));
  }
  fs.rmSync(root,{recursive:true,force:true});
}
console.log('✓ approved Jepong Devxyz icon + splash propagate to all four engines');
