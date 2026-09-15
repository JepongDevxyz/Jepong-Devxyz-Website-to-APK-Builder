import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import zlib from 'node:zlib';

import { assertDecodablePng, brandedAsset } from './common.mjs';
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
    sha256:'1e433717972f2a1ef719a1b16f8e085b6f6a5033961703ec60a2a2acb4f25868',
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

function pngChunk(type,data){
  const chunk=Buffer.alloc(12+data.length);
  chunk.writeUInt32BE(data.length,0);
  chunk.write(type,4,4,'ascii');
  data.copy(chunk,8);
  return chunk;
}

function overExpandingPng(){
  const header=Buffer.alloc(13);
  header.writeUInt32BE(1,0);
  header.writeUInt32BE(1,4);
  header[8]=8;
  header[9]=6;
  const imageData=zlib.deflateSync(Buffer.alloc(8*1024*1024+1));
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk('IHDR',header),
    pngChunk('IDAT',imageData),
    pngChunk('IEND',Buffer.alloc(0))
  ]);
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

const customIconDataUrl='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const customSplashDataUrl='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGUExURQD/AP///2+9WFEAAAABYktHRAH/Ai3eAAAAB3RJTUUH6gkPBR4szipxtAAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=';
const customIcon=Buffer.from(customIconDataUrl.split(',')[1],'base64');
const customSplash=Buffer.from(customSplashDataUrl.split(',')[1],'base64');

assertDecodablePng(customIcon,'custom icon fixture');
assertDecodablePng(customSplash,'custom splash fixture');
assert.throws(
  ()=>brandedAsset({splashDataUrl:'data:image/png;base64,iVBORw0KGgo='},'splash'),
  /PNG/,
  'malformed custom splash uploads must be rejected before propagation'
);
assert.throws(
  ()=>assertDecodablePng(overExpandingPng(),'over-expanding PNG fixture'),
  /undecodable PNG image data/,
  'compressed PNG image data that exceeds the safe validation limit must be rejected'
);

function assertFileBytes(file,expected,label){
  assert.ok(fs.existsSync(file),`${label}: missing ${file}`);
  assert.deepEqual(fs.readFileSync(file),expected,`${label}: custom branding override was not propagated`);
}

function createFakeAndroidPlatform(project,engine,cfg){
  const androidRoot=engine==='capacitor'
    ? path.join(project,'android')
    : path.join(project,'platforms/android');
  const app=path.join(androidRoot,'app');
  const packagePath=cfg.packageName.split('.');
  const javaDir=path.join(app,'src/main/java',...packagePath);

  fs.mkdirSync(javaDir,{recursive:true});
  fs.mkdirSync(path.join(app,'src/main/res/values'),{recursive:true});
  fs.writeFileSync(
    path.join(app,'src/main/AndroidManifest.xml'),
    `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application android:icon="@mipmap/ic_launcher">
    <activity android:name=".MainActivity" android:exported="true"/>
  </application>
</manifest>`
  );
  fs.writeFileSync(
    path.join(app,'build.gradle'),
    `android {
  namespace '${cfg.packageName}'
  defaultConfig {
    versionCode ${cfg.versionCode}
    versionName "${cfg.versionName}"
  }
}
dependencies { implementation 'example:dep:1' }
`
  );
  fs.writeFileSync(
    path.join(app,'src/main/res/values/styles.xml'),
    '<resources><style name="AppTheme.NoActionBarLaunch"></style></resources>'
  );
  fs.writeFileSync(
    path.join(javaDir,'MainActivity.java'),
    `package ${cfg.packageName}; public class MainActivity {}`
  );
}

function assertFinalAndroidBranding(project,engine,cfg,icon,splash,label){
  const androidRoot=engine==='capacitor'
    ? path.join(project,'android')
    : path.join(project,'platforms/android');
  const app=path.join(androidRoot,'app');
  const drawable=path.join(app,'src/main/res/drawable-nodpi');
  const manifest=fs.readFileSync(path.join(app,'src/main/AndroidManifest.xml'),'utf8');
  const main=fs.readFileSync(
    path.join(app,'src/main/java',...cfg.packageName.split('.'),'MainActivity.java'),
    'utf8'
  );
  const splashActivity=fs.readFileSync(
    path.join(app,'src/main/java',...cfg.packageName.split('.'),'JepongSplashActivity.java'),
    'utf8'
  );
  const v31Styles=fs.readFileSync(
    path.join(app,'src/main/res/values-v31/jepong_splash.xml'),
    'utf8'
  );

  assertFileBytes(path.join(drawable,'app_icon.png'),icon,`${label}: final icon`);
  assertFileBytes(
    path.join(app,'src/main/assets/jepong_splash.img'),
    splash,
    `${label}: selected splash runtime asset`
  );
  const compiledSplash=fs.readFileSync(path.join(drawable,'app_splash.png'));
  assertDecodablePng(compiledSplash,`${label}: compile-safe splash`);
  assert.notDeepEqual(
    compiledSplash,
    splash,
    `${label}: selected splash must not be exposed to Android resource compilation`
  );
  assert.match(manifest,/android:icon="@drawable\/app_icon"/,`${label}: launcher icon must use app_icon`);
  assert.match(manifest,/android:roundIcon="@drawable\/app_icon"/,`${label}: round icon must use app_icon`);
  assert.match(manifest,/android:name="\.JepongSplashActivity"/,`${label}: splash launcher activity missing`);
  assert.match(
    splashActivity,
    /getAssets\(\)\.open\("jepong_splash\.img"\)/,
    `${label}: splash activity must load the selected asset at runtime`
  );
  assert.doesNotMatch(
    splashActivity,
    /R\.drawable\.app_splash/,
    `${label}: splash activity must not compile the selected splash drawable`
  );
  assert.match(v31Styles,/<item name="android:windowSplashScreenAnimatedIcon">@drawable\/app_icon<\/item>/,`${label}: Android 12 splash must avoid the selected splash drawable`);
  assert.match(main,/app_splash/,`${label}: MainActivity runtime splash trace missing`);
}

function patchGeneratedAndroidBranding(engine,cfg,icon,splash,label){
  const id=`test-branding-final-${engine}`;
  const project=path.join(ROOT,'work',id,'project');
  const buildPath=path.join(ROOT,'builds',`${id}.json`);
  fs.rmSync(buildPath,{force:true});
  fs.rmSync(path.join(ROOT,'work',id),{recursive:true,force:true});
  fs.mkdirSync(path.dirname(buildPath),{recursive:true});
  fs.writeFileSync(buildPath,JSON.stringify(cfg,null,2));

  if(engine==='capacitor') writeCapacitor(cfg,project);
  if(engine==='cordova') writeCordova(cfg,project);
  createFakeAndroidPlatform(project,engine,cfg);

  const run=spawnSync(
    process.execPath,
    ['scripts/patch-android-platform.mjs','--build-id',id,'--engine',engine],
    {cwd:ROOT,encoding:'utf8'}
  );
  assert.equal(run.status,0,`${label}: Android patch failed: ${run.stderr}`);
  assertFinalAndroidBranding(project,engine,cfg,icon,splash,label);

  fs.rmSync(buildPath,{force:true});
  fs.rmSync(path.join(ROOT,'work',id),{recursive:true,force:true});
}

function assertNativeAndroidBranding(root,engine,label){
  const manifest=fs.readFileSync(
    path.join(root,'app/src/main/AndroidManifest.xml'),
    'utf8'
  );
  const activity=fs.readFileSync(
    path.join(
      root,
      'app/src/main/java/com/jepongdevxyz/defaultbranding/MainActivity.java'
    ),
    'utf8'
  );

  assert.match(
    manifest,
    /android:icon="@drawable\/app_icon"/,
    `${label}: ${engine} manifest must reference the selected app icon`
  );
  assert.match(
    manifest,
    /android:roundIcon="@drawable\/app_icon"/,
    `${label}: ${engine} manifest round icon must reference the selected app icon`
  );
  assert.match(
    activity,
    /R\.drawable\.app_splash/,
    `${label}: ${engine} MainActivity must preserve runtime splash wiring`
  );
}

for(const engine of ['native','gecko','capacitor','cordova']){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),`jepong-default-${engine}-`));
  const cfg={...baseConfig,engine};

  if(engine==='native' || engine==='gecko'){
    writeNative(cfg,root,engine==='gecko');
    assertFileHash(path.join(root,'app/src/main/res/drawable-nodpi/app_icon.png'),EXPECTED.icon.sha256,`${engine} icon`);
    assertFileHash(path.join(root,'app/src/main/res/drawable-nodpi/app_splash.png'),EXPECTED.splash.sha256,`${engine} splash`);
    assertNativeAndroidBranding(root,engine,'default branding');
  }

  if(engine==='capacitor'){
    writeCapacitor(cfg,root);
    assertFileHash(path.join(root,'branding/app_icon.png'),EXPECTED.icon.sha256,'capacitor icon');
    assertFileHash(path.join(root,'branding/app_splash.png'),EXPECTED.splash.sha256,'capacitor splash');
    patchGeneratedAndroidBranding(engine,cfg,iconSource,splashSource,'capacitor default branding');
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
    patchGeneratedAndroidBranding(engine,cfg,iconSource,splashSource,'cordova default branding');
  }

  fs.rmSync(root,{recursive:true,force:true});
}

for(const engine of ['native','gecko','capacitor','cordova']){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),`jepong-custom-${engine}-`));
  const cfg={...baseConfig,engine,iconDataUrl:customIconDataUrl,splashDataUrl:customSplashDataUrl};

  if(engine==='native' || engine==='gecko'){
    writeNative(cfg,root,engine==='gecko');
    assertFileBytes(path.join(root,'app/src/main/res/drawable-nodpi/app_icon.png'),customIcon,`${engine} custom icon`);
    assertFileBytes(path.join(root,'app/src/main/res/drawable-nodpi/app_splash.png'),customSplash,`${engine} custom splash`);
    assertNativeAndroidBranding(root,engine,'custom branding');
  }

  if(engine==='capacitor'){
    writeCapacitor(cfg,root);
    assertFileBytes(path.join(root,'branding/app_icon.png'),customIcon,'capacitor custom icon');
    assertFileBytes(path.join(root,'branding/app_splash.png'),customSplash,'capacitor custom splash');
    patchGeneratedAndroidBranding(engine,cfg,customIcon,customSplash,'capacitor custom branding');
  }

  if(engine==='cordova'){
    writeCordova(cfg,root);
    for(const [file,bytes,label] of [
      ['branding/app_icon.png',customIcon,'cordova custom branded icon'],
      ['branding/app_splash.png',customSplash,'cordova custom branded splash'],
      ['res/icon.png',customIcon,'cordova custom bootstrap icon'],
      ['res/screen/android/splash.png',customSplash,'cordova custom bootstrap splash']
    ]){
      assertFileBytes(path.join(root,file),bytes,label);
    }
    patchGeneratedAndroidBranding(engine,cfg,customIcon,customSplash,'cordova custom branding');
  }

  fs.rmSync(root,{recursive:true,force:true});
}

console.log('✓ Jepong Devxyz default branding propagates Android-safe PNGs to all four engines');
