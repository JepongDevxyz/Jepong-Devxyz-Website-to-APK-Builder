import path from 'node:path';
import { write, mkdir, escXml, brandedAsset } from './common.mjs';

export function writeCordova(cfg, out) {
  mkdir(out);
  write(path.join(out,'package.json'), JSON.stringify({ name:'jepong-generated-cordova',version:'1.0.0',private:true,devDependencies:{cordova:'13.0.0'} }, null, 2));
  const orientation = cfg.orientation === 'portrait' ? 'portrait' : cfg.orientation === 'landscape' ? 'landscape' : 'default';
  const splashDelay=cfg.splashEnabled===false?0:Math.max(0,Math.min(15000,Number(cfg.splashDuration)||1500));
  const allowCleartext=/^http:\/\//i.test(String(cfg.websiteUrl||''));
  const androidNamespace=allowCleartext?' xmlns:android="http://schemas.android.com/apk/res/android"':'';
  const cleartextPolicy=allowCleartext?`
  <platform name="android">
    <edit-config file="app/src/main/AndroidManifest.xml" mode="merge" target="/manifest/application">
      <application android:usesCleartextTraffic="true" />
    </edit-config>
  </platform>`:'';

  const icon=brandedAsset(cfg,'icon');
  const splash=brandedAsset(cfg,'splash');
  const cordovaIcon=`res/icon.${icon.ext}`;
  const cordovaSplash=`res/screen/android/splash.${splash.ext}`;

  // Feed Cordova the same selected branding that the native patch stage receives.
  // This keeps the bootstrap resources, final launcher icon and deterministic splash in sync.
  write(path.join(out,cordovaIcon),icon.buffer);
  write(path.join(out,cordovaSplash),splash.buffer);
  write(path.join(out,`branding/app_icon.${icon.ext}`),icon.buffer);
  write(path.join(out,`branding/app_splash.${splash.ext}`),splash.buffer);

  write(path.join(out,'config.xml'), `<?xml version="1.0" encoding="utf-8"?>
<widget id="${escXml(cfg.packageName)}" version="${escXml(cfg.versionName)}" android-versionCode="${Number(cfg.versionCode)}" xmlns="http://www.w3.org/ns/widgets" xmlns:cdv="http://cordova.apache.org/ns/1.0"${androidNamespace}>
  <name>${escXml(cfg.appName)}</name>
  <content src="${escXml(cfg.websiteUrl)}"/>
  <access origin="*"/>
  <allow-navigation href="http://*/*"/>
  <allow-navigation href="https://*/*"/>
  <icon src="${cordovaIcon}" />
  <preference name="Orientation" value="${orientation}"/>
  <preference name="AndroidLaunchMode" value="singleTask"/>
  <preference name="AndroidXEnabled" value="true"/>
  <preference name="android-targetSdkVersion" value="36"/>
  <preference name="android-compileSdkVersion" value="36"/>
  <preference name="android-buildToolsVersion" value="36.0.0"/>
  <preference name="GradleVersion" value="8.14.2"/>
  <preference name="AndroidGradlePluginVersion" value="8.10.1"/>
  <preference name="SplashScreenDelay" value="${splashDelay}"/>
  <preference name="AutoHideSplashScreen" value="true"/>
  <preference name="SplashScreenBackgroundColor" value="#111827"/>
  <preference name="AndroidWindowSplashScreenAnimatedIcon" value="${cordovaSplash}"/>${cleartextPolicy}
</widget>`);
  write(path.join(out,'www/index.html'), `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escXml(cfg.appName)}</title><style>body{background:#111827;color:white;font-family:system-ui}</style><p>Loading…</p>`);
  write(path.join(out,'jepong-config.json'), JSON.stringify(cfg,null,2));
}
