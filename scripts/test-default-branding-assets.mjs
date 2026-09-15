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
    sha256:'6ab9643daddf071d03f9f8ff62f6702e60d100a46343cfafcf554c3a0f6ecca5',
    width:1536,
    height:1536
  },
  splash:{
    sourcePath:path.join(ROOT,'assets/default-splash.png'),
    sha256:'c819f2aea8dddf1904046b79cd725c424aeb92ed34ba013c1a6a59fb86ad8087',
    width:864,
    height:1536
  }
};

function sha256(buffer){
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function pngSize(buffer,label){
  assert.deepEqual([...buffer.subarray(0,8)],[137,80,78,71,13,10,26,10],`${label}: default branding asset must be a real PNG`);
  assert.equal(buffer.toString('ascii',12,16),'IHDR',`${label}: PNG IHDR must be first`);
  assert.notEqual(buffer[25],3,`${label}: Android PNG must not be indexed color type 3`);
  return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};
}

for(const [kind,spec] of Object.entries(EXPECTED)){
  const source=fs.readFileSync(spec.sourcePath);
  assert.equal(sha256(source),spec.sha256,`${kind}: unexpected approved default asset`);
  const fallback=brandedAsset({},kind);
  const size=pngSize(fallback.buffer,kind);
  assert.equal(fallback.ext,'png',`${kind}: fallback extension must be PNG`);
  assert.equal(sha256(fallback.buffer),spec.sha256,`${kind}: brandedAsset fallback drifted`);
  assert.equal(size.width,spec.width,`${kind}: unexpected width`);
  assert.equal(size.height,spec.height,`${kind}: unexpected height`);
}

const baseConfig={websiteUrl:'https://example.com',appName:'Jepong Default Branding Test',packageName:'com.jepongdevxyz.defaultbranding',versionName:'1.0.0',versionCode:1,renderMode:'default',orientation:'auto',permissions:[],controls:[],extensions:[],splashEnabled:true,splashDuration:1500,apkSigner:true,oneSignalAppId:'',offlineFallback:'Offline',iconDataUrl:'',splashDataUrl:''};

function assertFileHash(file,expected,label){
  assert.ok(fs.existsSync(file),`${label}: missing ${file}`);
  assert.equal(sha256(fs.readFileSync(file)),expected,`${label}: default branding bytes changed`);
}

for(const engine of ['native','gecko','capacitor','cordova']){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),`jepong-default-${engine}-`));
  const cfg={...baseConfig,engine};
  if(engine==='native'||engine==='gecko'){
    writeNative(cfg,root,engine==='gecko');
    assertFileHash(path.join(root,'app/src/main/res/drawable-nodpi/app_icon.png'),EXPECTED.icon.sha256,`${engine} icon`);
    assertFileHash(path.join(root,'app/src/main/res/drawable-nodpi/app_splash.png'),EXPECTED.splash.sha256,`${engine} splash`);
  }else if(engine==='capacitor'){
    writeCapacitor(cfg,root);
    assertFileHash(path.join(root,'branding/app_icon.png'),EXPECTED.icon.sha256,'capacitor icon');
    assertFileHash(path.join(root,'branding/app_splash.png'),EXPECTED.splash.sha256,'capacitor splash');
  }else{
    writeCordova(cfg,root);
    for(const [file,hash,label] of [['branding/app_icon.png',EXPECTED.icon.sha256,'cordova branded icon'],['branding/app_splash.png',EXPECTED.splash.sha256,'cordova branded splash'],['res/icon.png',EXPECTED.icon.sha256,'cordova bootstrap icon'],['res/screen/android/splash.png',EXPECTED.splash.sha256,'cordova bootstrap splash']]) assertFileHash(path.join(root,file),hash,label);
    const xml=fs.readFileSync(path.join(root,'config.xml'),'utf8');
    assert.match(xml,/icon src="res\/icon\.png"/);
    assert.match(xml,/AndroidWindowSplashScreenAnimatedIcon" value="res\/screen\/android\/splash\.png"/);
  }
  fs.rmSync(root,{recursive:true,force:true});
}

console.log('✓ approved Jepong Devxyz icon + splash propagate to all four engines');
