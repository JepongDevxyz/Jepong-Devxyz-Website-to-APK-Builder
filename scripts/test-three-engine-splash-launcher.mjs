import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  installAndroidSplashLauncher
} from './android-splash-launcher.mjs';

function makeAppRoot(){
  const root=fs.mkdtempSync(
    path.join(os.tmpdir(),'jepong-splash-contract-')
  );

  const appRoot=path.join(root,'app');
  const manifestPath=path.join(
    appRoot,
    'src/main/AndroidManifest.xml'
  );

  fs.mkdirSync(
    path.dirname(manifestPath),
    {recursive:true}
  );

  fs.writeFileSync(
    manifestPath,
    `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application android:theme="@style/AppTheme">
    <activity android:name=".MainActivity" android:exported="true">
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>
    </activity>
  </application>
</manifest>
`
  );

  return {root,appRoot,manifestPath};
}

function read(file){
  return fs.readFileSync(file,'utf8');
}

for(const engine of ['native','capacitor','cordova']){
  const fixture=makeAppRoot();

  installAndroidSplashLauncher({
    appRoot:fixture.appRoot,
    packageName:'com.jepongdevxyz.app',
    durationMs:6000,
    enabled:true
  });

  const manifest=read(fixture.manifestPath);

  assert.match(
    manifest,
    /android:name="\.JepongSplashActivity"/,
    `${engine}: dedicated splash activity missing`
  );

  const splashStart=manifest.indexOf(
    'android:name=".JepongSplashActivity"'
  );
  const splashEnd=manifest.indexOf(
    '</activity>',
    splashStart
  );
  const splashBlock=manifest.slice(
    splashStart,
    splashEnd
  );

  assert.match(
    splashBlock,
    /android\.intent\.action\.MAIN/,
    `${engine}: splash is not launcher action`
  );
  assert.match(
    splashBlock,
    /android\.intent\.category\.LAUNCHER/,
    `${engine}: splash is not launcher category`
  );

  const mainStart=manifest.indexOf(
    'android:name=".MainActivity"'
  );
  const mainEnd=manifest.indexOf(
    '</activity>',
    mainStart
  );
  const mainBlock=manifest.slice(
    mainStart,
    mainEnd
  );

  assert.doesNotMatch(
    mainBlock,
    /android\.intent\.action\.MAIN/,
    `${engine}: MainActivity still owns launcher action`
  );
  assert.doesNotMatch(
    mainBlock,
    /android\.intent\.category\.LAUNCHER/,
    `${engine}: MainActivity still owns launcher category`
  );

  const javaPath=path.join(
    fixture.appRoot,
    'src/main/java/com/jepongdevxyz/app/JepongSplashActivity.java'
  );

  const java=read(javaPath);

  for(const token of [
    'R.drawable.app_splash',
    'ImageView.ScaleType.CENTER_CROP',
    'MainActivity.class',
    'postDelayed',
    '6000',
    'finish()'
  ]){
    assert.ok(
      java.includes(token),
      `${engine}: splash Java missing ${token}`
    );
  }

  const styles=read(
    path.join(
      fixture.appRoot,
      'src/main/res/values/jepong_splash.xml'
    )
  );

  assert.match(
    styles,
    /JepongSplashTheme/,
    `${engine}: dedicated splash theme missing`
  );

  fs.rmSync(fixture.root,{recursive:true,force:true});
}

{
  const fixture=makeAppRoot();

  installAndroidSplashLauncher({
    appRoot:fixture.appRoot,
    packageName:'com.jepongdevxyz.app',
    durationMs:6000,
    enabled:false
  });

  const manifest=read(fixture.manifestPath);

  assert.doesNotMatch(
    manifest,
    /JepongSplashActivity/,
    'disabled splash must not install a launcher activity'
  );

  const mainStart=manifest.indexOf(
    'android:name=".MainActivity"'
  );
  const mainEnd=manifest.indexOf(
    '</activity>',
    mainStart
  );
  const mainBlock=manifest.slice(mainStart,mainEnd);

  assert.match(mainBlock,/android\.intent\.action\.MAIN/);
  assert.match(mainBlock,/android\.intent\.category\.LAUNCHER/);

  fs.rmSync(fixture.root,{recursive:true,force:true});
}

const nativeSource=read(
  new URL('./write-native.mjs',import.meta.url)
);
const patcherSource=read(
  new URL('./patch-android-platform.mjs',import.meta.url)
);

assert.match(
  nativeSource,
  /installAndroidSplashLauncher/,
  'Native generator is not wired to dedicated splash launcher'
);
assert.match(
  patcherSource,
  /installAndroidSplashLauncher/,
  'Capacitor/Cordova patcher is not wired to dedicated splash launcher'
);
assert.doesNotMatch(
  patcherSource,
  /ImageView brandSplash=/,
  'Capacitor/Cordova still use timing-sensitive in-activity splash overlay'
);

console.log(
  '✓ Native, Capacitor and Cordova deterministic splash launcher contract'
);
