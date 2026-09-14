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
function assertPng(asset,label){assert.equal(asset.ext,'png',`${label}: expected PNG`);assert.ok(asset.buffer.length>1000,`${label}: unexpectedly small`);assert.deepEqual([...asset.buffer.subarray(0,8)],[137,80,78,71,13,10,26,10],`${label}: invalid PNG`);}
const icon=brandedAsset({},'icon'),splash=brandedAsset({},'splash');
assertPng(icon,'default icon');assertPng(splash,'default splash');
const iconHash=sha256(icon.buffer),splashHash=sha256(splash.buffer);
const baseConfig={websiteUrl:'https://example.com',appName:'Jepong Default Branding Test',packageName:'com.jepongdevxyz.defaultbranding',versionName:'1.0.0',versionCode:1,renderMode:'default',orientation:'auto',permissions:[],controls:[],extensions:[],splashEnabled:true,splashDuration:1500,apkSigner:true,oneSignalAppId:'',offlineFallback:'Offline',iconDataUrl:'',splashDataUrl:''};
function assertFileHash(file,expected,label){assert.ok(fs.existsSync(file),`${label}: missing ${file}`);assert.equal(sha256(fs.readFileSync(file)),expected,`${label}: branding bytes changed`);}
for(const engine of ['native','gecko','capacitor','cordova']){const root=fs.mkdtempSync(path.join(os.tmpdir(),`jepong-default-${engine}-`));const cfg={...baseConfig,engine};if(engine==='native'||engine==='gecko'){writeNative(cfg,root,engine==='gecko');assertFileHash(path.join(root,'app/src/main/res/drawable-nodpi/app_icon.png'),iconHash,`${engine} icon`);assertFileHash(path.join(root,'app/src/main/res/drawable-nodpi/app_splash.png'),splashHash,`${engine} splash`);}if(engine==='capacitor'){writeCapacitor(cfg,root);assertFileHash(path.join(root,'branding/app_icon.png'),iconHash,'capacitor icon');assertFileHash(path.join(root,'branding/app_splash.png'),splashHash,'capacitor splash');}if(engine==='cordova'){writeCordova(cfg,root);for(const [file,hash,label] of [['branding/app_icon.png',iconHash,'cordova branded icon'],['branding/app_splash.png',splashHash,'cordova branded splash'],['res/icon.png',iconHash,'cordova bootstrap icon'],['res/screen/android/splash.png',splashHash,'cordova bootstrap splash']])assertFileHash(path.join(root,file),hash,label);const xml=fs.readFileSync(path.join(root,'config.xml'),'utf8');assert.match(xml,/icon src="res\/icon\.png"/);assert.match(xml,/AndroidWindowSplashScreenAnimatedIcon" value="res\/screen\/android\/splash\.png"/);}fs.rmSync(root,{recursive:true,force:true});}
console.log('✓ approved Jepong Devxyz PNG icon + splash propagate to all four engines');