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
const ROOT=path.resolve(process.cwd());
assert.equal(sha256(fs.readFileSync(path.join(ROOT,'assets/default-icon.png'))),'87cb6801cab11b209698ad3b944630a437b34f4d218107833624fcc4af417afb','approved icon source changed');
assert.equal(sha256(fs.readFileSync(path.join(ROOT,'assets/default-splash.png'))),'f6a8b13ae5111f7bb9ca410b9f450bbcf542f7f53f1986e1960579e05cdea4b3','approved splash source changed');
const icon=brandedAsset({},'icon'),splash=brandedAsset({},'splash');
for(const [asset,label] of [[icon,'icon'],[splash,'splash']]){
  assert.equal(asset.ext,'png',`${label}: Android default must be PNG`);
  assert.ok(asset.buffer.length>1000,`${label}: unexpectedly small`);
  assert.deepEqual([...asset.buffer.subarray(0,8)],[137,80,78,71,13,10,26,10],`${label}: invalid PNG`);
  assert.notEqual(asset.buffer[25],3,`${label}: Android resource must not remain indexed/palette PNG`);
}
const iconHash=sha256(icon.buffer),splashHash=sha256(splash.buffer);
const baseConfig={websiteUrl:'https://example.com',appName:'Jepong Default Branding Test',packageName:'com.jepongdevxyz.defaultbranding',versionName:'1.0.0',versionCode:1,renderMode:'default',orientation:'auto',permissions:[],controls:[],extensions:[],splashEnabled:true,splashDuration:1500,apkSigner:true,oneSignalAppId:'',offlineFallback:'Offline',iconDataUrl:'',splashDataUrl:''};
function assertFileHash(file,expected,label){assert.ok(fs.existsSync(file),`${label}: missing ${file}`);assert.equal(sha256(fs.readFileSync(file)),expected,`${label}: branding bytes changed`);}
for(const engine of ['native','gecko','capacitor','cordova']){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),`jepong-default-${engine}-`));
  const cfg={...baseConfig,engine};
  if(engine==='native'||engine==='gecko'){
    writeNative(cfg,root,engine==='gecko');
    assertFileHash(path.join(root,'app/src/main/res/drawable-nodpi/app_icon.png'),iconHash,`${engine} icon`);
    assertFileHash(path.join(root,'app/src/main/res/drawable-nodpi/app_splash.png'),splashHash,`${engine} splash`);
  }else if(engine==='capacitor'){
    writeCapacitor(cfg,root);
    assertFileHash(path.join(root,'branding/app_icon.png'),iconHash,'capacitor icon');
    assertFileHash(path.join(root,'branding/app_splash.png'),splashHash,'capacitor splash');
  }else{
    writeCordova(cfg,root);
    for(const [file,hash,label] of [['branding/app_icon.png',iconHash,'cordova branded icon'],['branding/app_splash.png',splashHash,'cordova branded splash'],['res/icon.png',iconHash,'cordova bootstrap icon'],['res/screen/android/splash.png',splashHash,'cordova bootstrap splash']])assertFileHash(path.join(root,file),hash,label);
    const xml=fs.readFileSync(path.join(root,'config.xml'),'utf8');
    assert.ok(xml.includes('icon src="res/icon.png"'));
    assert.ok(xml.includes('AndroidWindowSplashScreenAnimatedIcon" value="res/screen/android/splash.png"'));
  }
  fs.rmSync(root,{recursive:true,force:true});
}
console.log('✓ approved Jepong Devxyz icon + splash propagate to all four engines as Android-safe PNG');
