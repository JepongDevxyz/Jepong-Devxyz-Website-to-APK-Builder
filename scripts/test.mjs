import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  CAPABILITY_STATUS,
  FEATURES,
  ENGINE_CAPABILITIES,
  getCapability,
  getSelectableFeatureIds,
  validateCapabilitySelection
} from '../capabilities.mjs';

const root=path.resolve(process.cwd());
const required=['index.html','app.js','styles.css','assets/default-icon.png','assets/default-splash.png','api/build-create.js','api/build-status.js','api/build-download.js','.github/workflows/build-apk.yml','scripts/build.mjs','scripts/patch-android-platform.mjs'];
for(const f of required) if(!fs.existsSync(path.join(root,f))) throw new Error(`Missing ${f}`);
const checks=['app.js','api/_common.js','api/_github.js','api/build-create.js','api/build-status.js','api/build-logs.js','api/build-download.js','scripts/build.mjs','scripts/common.mjs','scripts/write-native.mjs','scripts/write-capacitor.mjs','scripts/write-cordova.mjs','scripts/patch-android-platform.mjs'];
for(const f of checks){ const r=spawnSync(process.execPath,['--check',f],{cwd:root,encoding:'utf8'}); if(r.status!==0) throw new Error(`${f}: ${r.stderr}`); }
const y=spawnSync('python3',['-c',`import yaml; yaml.safe_load(open('.github/workflows/build-apk.yml')); print('yaml ok')`],{cwd:root,encoding:'utf8'}); if(y.status!==0)throw new Error(`workflow YAML: ${y.stderr}`);
const workflowText=fs.readFileSync(path.join(root,'.github/workflows/build-apk.yml'),'utf8');
for(const requiredSignerToken of [
  'apksigner',
  'zipalign',
  'APK_KEYSTORE_BASE64',
  'APK_KEYSTORE_PASSWORD',
  'APK_KEY_ALIAS',
  'APK_KEY_PASSWORD'
]){
  if(!workflowText.includes(requiredSignerToken)){
    throw new Error(`APK signer workflow missing ${requiredSignerToken}`);
  }
}


/* Canonical engine capability registry assertions */
{
  if(CAPABILITY_STATUS.VERIFIED!=='verified'){
    throw new Error('capability status verified missing');
  }

  for(const engine of ['native','gecko','capacitor','cordova']){
    if(!ENGINE_CAPABILITIES[engine]){
      throw new Error(`capability registry missing engine: ${engine}`);
    }

    for(const group of ['permissions','controls','extensions']){
      if(!ENGINE_CAPABILITIES[engine][group]){
        throw new Error(`${engine}: capability group missing ${group}`);
      }

      for(const feature of FEATURES[group]){
        if(!ENGINE_CAPABILITIES[engine][group][feature.id]){
          throw new Error(
            `${engine}: capability missing ${group}/${feature.id}`
          );
        }
      }
    }
  }

  for(const id of [
    'camera',
    'microphone',
    'notification',
    'location',
    'files'
  ]){
    if(!FEATURES.permissions.some(feature=>feature.id===id)){
      throw new Error(`permission definition missing: ${id}`);
    }
  }

  if(
    getCapability('gecko','permissions','camera').status!==
      CAPABILITY_STATUS.VERIFIED
  ){
    throw new Error('Gecko camera runtime verification missing');
  }

  if(
    getCapability('gecko','permissions','microphone').status!==
      CAPABILITY_STATUS.VERIFIED
  ){
    throw new Error('Gecko microphone runtime verification missing');
  }

  if(
    getCapability('gecko','permissions','location').status!==
      CAPABILITY_STATUS.VERIFIED
  ){
    throw new Error('Gecko location runtime verification missing');
  }

  if(
    getCapability('gecko','controls','externalLinks').status!==
      CAPABILITY_STATUS.VERIFIED
  ){
    throw new Error('Gecko external-links runtime verification missing');
  }

  if(
    getCapability('native','permissions','contacts').status===
      CAPABILITY_STATUS.VERIFIED
  ){
    throw new Error('Native Contacts falsely marked Verified');
  }

  if(
    getCapability('capacitor','permissions','calendar').status===
      CAPABILITY_STATUS.VERIFIED
  ){
    throw new Error('Capacitor Calendar falsely marked Verified');
  }

  if(
    getCapability('cordova','permissions','biometrics').status===
      CAPABILITY_STATUS.VERIFIED
  ){
    throw new Error('Cordova Biometrics falsely marked Verified');
  }

  if(
    getSelectableFeatureIds(
      'gecko',
      'permissions'
    ).includes('notification')
  ){
    throw new Error(
      'Gecko notification must stay non-selectable until verification'
    );
  }

  const errors=
    validateCapabilitySelection({
      engine:'native',
      permissions:['contacts'],
      controls:[],
      extensions:[]
    });

  if(errors.length===0){
    throw new Error(
      'non-verified Native Contacts selection was accepted'
    );
  }
}

const allPermissions=['camera','microphone','notification','location','media','contacts','calendar','biometrics','files','bluetooth','sensors'];
const nativeControls=['pullRefresh','hideScrollbars','transparentNav','pinchZoom','disableCopy','blockAdsRedirects'];
const geckoExtensions=['adguard','ghostery','privacyBadger','darkReader','ublock'];
const base={websiteUrl:'https://example.com',appName:'Jepong Devxyz',packageName:'com.jepongdevxyz.app',versionName:'1.0.0',versionCode:1,renderMode:'default',orientation:'auto',permissions:allPermissions,controls:[],extensions:[],oneSignalAppId:'11111111-1111-1111-1111-111111111111',offlineFallback:'Offline',iconDataUrl:'',splashDataUrl:'',splashEnabled:true,splashDuration:1500,apkSigner:true};
for(const engine of ['native','gecko','capacitor','cordova']){
  const id=`test-${engine}`; fs.mkdirSync(path.join(root,'builds'),{recursive:true}); const controls=engine==='native'?nativeControls:engine==='gecko'?['transparentNav','navigationToolbar','externalLinks','downloadManager']:['transparentNav','pinchZoom'];
  const extensions=engine==='gecko'?geckoExtensions:[];
  const sizeOptimization=engine==='gecko';
  const abiTarget=sizeOptimization?'arm64-v8a':'universal';
  fs.writeFileSync(
    path.join(root,'builds',`${id}.json`),
    JSON.stringify({
      ...base,
      engine,
      controls,
      extensions,
      sizeOptimization,
      abiTarget
    })
  );
  let r=spawnSync(process.execPath,['scripts/build.mjs','prepare','--build-id',id],{cwd:root,encoding:'utf8'}); if(r.status!==0) throw new Error(`${engine} prepare: ${r.stderr}`);
  r=spawnSync(process.execPath,['scripts/build.mjs','generate','--build-id',id],{cwd:root,encoding:'utf8'}); if(r.status!==0) throw new Error(`${engine} generate: ${r.stderr}`);
  const dir=path.join(root,'work',id,'project'); if(!fs.existsSync(dir)) throw new Error(`${engine}: no project`);
  if(engine==='gecko'){
    const gradle=
      fs.readFileSync(
        path.join(
          dir,
          'app/build.gradle.kts'
        ),
        'utf8'
      );

    if(
      !gradle.includes('abiFilters') ||
      !gradle.includes('arm64-v8a')
    ){
      throw new Error(
        'gecko: ARM64 ABI filter missing'
      );
    }
  }
  if(engine==='native'||engine==='gecko'){
    if(!fs.existsSync(path.join(dir,'app/src/main/AndroidManifest.xml'))) throw new Error(`${engine}: no manifest`);
    for(const a of ['app_icon.png','app_splash.png']) if(!fs.existsSync(path.join(dir,'app/src/main/res/drawable-nodpi',a))) throw new Error(`${engine}: missing ${a}`);
    const main=fs.readFileSync(path.join(dir,'app/src/main/java/com/jepongdevxyz/app/MainActivity.java'),'utf8'); if(!main.includes('app_splash'))throw new Error(`${engine}: splash not wired`);
    if(engine==='gecko'){
      if(!main.includes('setPromptDelegate'))throw new Error('gecko: extension prompt delegate not wired');
      for(const slug of ['adguard-adblocker','ghostery','privacy-badger17','darkreader','ublock-origin']){
        if(!main.includes(slug))throw new Error(`gecko: extension ${slug} not wired`);
      }
    }
  }
  if(engine==='capacitor'){
    if(!fs.existsSync(path.join(dir,'capacitor.config.json'))) throw new Error('capacitor config missing');
    fakePlatform(dir,'capacitor');
    r=spawnSync(process.execPath,['scripts/patch-android-platform.mjs','--build-id',id,'--engine','capacitor'],{cwd:root,encoding:'utf8'}); if(r.status!==0)throw new Error(`capacitor patch: ${r.stderr}`);
    assertPatched(dir,'android');
  }
  if(engine==='cordova'){
    if(!fs.existsSync(path.join(dir,'config.xml'))) throw new Error('cordova config missing');
    fakePlatform(dir,'cordova');
    r=spawnSync(process.execPath,['scripts/patch-android-platform.mjs','--build-id',id,'--engine','cordova'],{cwd:root,encoding:'utf8'}); if(r.status!==0)throw new Error(`cordova patch: ${r.stderr}`);
    assertPatched(dir,'platforms/android');
  }
}

/* Gecko Browser Controls UI assertions */
{
  const appText=
    fs.readFileSync(
      path.join(root,'app.js'),
      'utf8'
    );

  for(
    const token of [
      'navigationToolbar',
      'externalLinks',
      'downloadManager'
    ]
  ){
    if(!appText.includes(token)){
      throw new Error(
        `builder control missing: ${token}`
      );
    }
  }
}


/* Gecko runtime diagnostics assertions */
{
  const geckoMain=
    fs.readFileSync(
      path.join(
        root,
        'work',
        'test-gecko',
        'project',
        'app',
        'src',
        'main',
        'java',
        'com',
        'jepongdevxyz',
        'app',
        'MainActivity.java'
      ),
      'utf8'
    );

  const requiredGeckoRuntimeTokens=[
    'getSharedPreferences',
    'controller.list()',
    'metaData.enabled',
    'EnableSource.APP',
    'Retry extensions',
    'Continue without failed extensions',
    'Already installed',
    'setProgressDelegate',
    'onProgressChange',
    'Website loading timed out',
    'Retry website',
    'jepong_extensions',
    'extid_',
    'findInstalled',
    'prepareExtensions',
    'setNavigationDelegate',
    'TARGET_WINDOW_NEW',
    'buildNavigationToolbar',
    'goForward()',
    'reload()',
    'Share page',
    'shouldOpenExternally',
    'setPromptDelegate',
    'onFilePrompt',
    'ACTION_OPEN_DOCUMENT',
    'ACTION_OPEN_DOCUMENT_TREE',
    'FILE_PICKER_REQUEST',
    'setContentDelegate',
    'onExternalResponse',
    'DownloadManager',
    'VISIBILITY_VISIBLE_NOTIFY_COMPLETED',
    'enqueueDownload',
    'jepong_site_permissions',
    'RUNTIME_PERMISSION_REQUEST',
    'isAndroidPermissionSelected',
    'PERMISSION_GEOLOCATION',
    'PERMISSION_DESKTOP_NOTIFICATION',
    'PERMISSION_TRACKING',
    'ContentPermission.VALUE_DENY',
    'ContentPermission.VALUE_PROMPT',
    'Allow once',
    'Always allow',
    'Always block',
    'findMediaSource',
    'MediaSource.SOURCE_CAMERA',
    'MediaSource.SOURCE_MICROPHONE',
    'pendingAndroidPermissionCallback',
    'deviceBridgeCapabilitySummary',
    'Advanced bridge foundation only',
    'showSitePermissionsManager',
    'setWebNotificationDelegate',
    'WebNotificationDelegate',
    'onShowNotification',
    'onCloseNotification',
    'NotificationChannel',
    'jepong_web_notifications',
    'showWebNotification',
    'closeWebNotification',
    'notification.show()',
    'notification.dismiss()',
    'RUNTIME_NOTIFICATION_PERMISSION_REQUEST',
    'requestNotificationContentPermission'
  ];


  if(
    geckoMain.includes(
      "requestPermissions(missing.toArray(new String[0]),700)"
    )
  ){
    throw new Error(
      "gecko: selected permissions must not all be requested at startup"
    );
  }

  if(
    !geckoMain.includes(
      "requestPermissions("
    ) ||
    !geckoMain.includes(
      "RUNTIME_PERMISSION_REQUEST"
    )
  ){
    throw new Error(
      "gecko: on-demand Android runtime permission flow missing"
    );
  }

  for(
    const token
    of requiredGeckoRuntimeTokens
  ){
    if(!geckoMain.includes(token)){
      throw new Error(
        `gecko runtime feature missing: ${token}`
      );
    }
  }
}

console.log('PASS: JS/YAML syntax, API modules, config validation, 4 engine generators, branding, and Capacitor/Cordova Android patch stage.');

function fakePlatform(dir,engine){
  const ar=engine==='capacitor'?path.join(dir,'android'):path.join(dir,'platforms/android');
  const app=path.join(ar,'app'); fs.mkdirSync(path.join(app,'src/main/java/com/jepongdevxyz/app'),{recursive:true}); fs.mkdirSync(path.join(app,'src/main/res/values'),{recursive:true});
  fs.writeFileSync(path.join(app,'src/main/AndroidManifest.xml'),`<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:icon="@mipmap/ic_launcher"><activity android:name=".MainActivity" android:exported="true"/></application><uses-permission android:name="android.permission.INTERNET"/></manifest>`);
  fs.writeFileSync(path.join(app,'build.gradle'),`android { namespace 'com.jepongdevxyz.app' }\ndependencies {\n implementation 'example:dep:1'\n}\n`);
  fs.writeFileSync(path.join(app,'src/main/res/values/styles.xml'),'<resources><style name="AppTheme.NoActionBarLaunch"></style></resources>');
  fs.writeFileSync(path.join(app,'src/main/java/com/jepongdevxyz/app/MainActivity.java'),'package com.jepongdevxyz.app; public class MainActivity {}');
}
function assertPatched(dir,sub){
  const app=path.join(dir,sub,'app');
  const manifest=fs.readFileSync(path.join(app,'src/main/AndroidManifest.xml'),'utf8');
  if(!manifest.includes('@drawable/app_icon')||!manifest.includes('.JepongApplication')||!manifest.includes('android.permission.CAMERA')) throw new Error(`${sub}: manifest patch incomplete`);
  const gradle=fs.readFileSync(path.join(app,'build.gradle'),'utf8'); if(!gradle.includes('com.onesignal:OneSignal:5.9.8'))throw new Error(`${sub}: OneSignal dependency missing`);
  for(const a of ['app_icon.png','app_splash.png']) if(!fs.existsSync(path.join(app,'src/main/res/drawable-nodpi',a)))throw new Error(`${sub}: missing ${a}`);
  const main=fs.readFileSync(path.join(app,'src/main/java/com/jepongdevxyz/app/MainActivity.java'),'utf8');
  if(!main.includes('app_splash'))throw new Error(`${sub}: full splash overlay missing`);
  if(!main.includes('requestSelectedPermissions'))throw new Error(`${sub}: runtime permissions not wired`);
  if(!main.includes('setBuiltInZoomControls(true)'))throw new Error(`${sub}: pinch zoom not wired`);
}
