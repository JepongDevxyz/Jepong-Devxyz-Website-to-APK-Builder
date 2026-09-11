import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

import {
  CAPABILITY_STATUS,
  getCapability,
  getSelectableFeatureIds
} from '../capabilities.mjs';

const root=path.resolve(process.cwd());
const id='test-cordova-controls';

const buildPath=
  path.join(root,'builds',`${id}.json`);

const project=
  path.join(root,'work',id,'project');

function cleanup(){
  fs.rmSync(
    path.join(root,'work',id),
    {
      recursive:true,
      force:true
    }
  );

  fs.rmSync(
    buildPath,
    {
      force:true
    }
  );
}

cleanup();
process.on('exit',cleanup);

fs.mkdirSync(
  path.dirname(buildPath),
  {
    recursive:true
  }
);

fs.writeFileSync(
  buildPath,
  JSON.stringify(
    {
      websiteUrl:'https://example.com',
      appName:'Cordova Controls',
      packageName:'com.jepongdevxyz.cordovacontrols',

      versionName:'1.0.0',
      versionCode:1,

      engine:'cordova',

      renderMode:'default',
      orientation:'auto',

      permissions:[
        'camera',
        'microphone',
        'location',
        'files'
      ],

      controls:[
        'transparentNav',
        'pinchZoom',
        'navigationToolbar',
        'externalLinks',
        'downloadManager'
      ],

      extensions:[],

      oneSignalAppId:'',
      offlineFallback:'Offline',

      iconDataUrl:'',
      splashDataUrl:'',

      splashEnabled:true,
      splashDuration:500,

      apkSigner:false
    },
    null,
    2
  )
);

const app=
  path.join(
    project,
    'platforms/android/app'
  );

const javaDir=
  path.join(
    app,
    'src/main/java/com/jepongdevxyz/cordovacontrols'
  );

fs.mkdirSync(
  javaDir,
  {
    recursive:true
  }
);

fs.mkdirSync(
  path.join(
    app,
    'src/main/res/values'
  ),
  {
    recursive:true
  }
);

fs.writeFileSync(
  path.join(
    app,
    'src/main/AndroidManifest.xml'
  ),
  `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application android:icon="@mipmap/ic_launcher">
    <activity android:name=".MainActivity" android:exported="true"/>
  </application>
  <uses-permission android:name="android.permission.INTERNET"/>
</manifest>`
);

fs.writeFileSync(
  path.join(
    app,
    'build.gradle'
  ),
  `android {
  namespace 'com.jepongdevxyz.cordovacontrols'
}

dependencies {
  implementation 'example:dep:1'
}
`
);

fs.writeFileSync(
  path.join(
    app,
    'src/main/res/values/styles.xml'
  ),
  '<resources></resources>'
);

fs.writeFileSync(
  path.join(
    javaDir,
    'MainActivity.java'
  ),
  'package com.jepongdevxyz.cordovacontrols; public class MainActivity {}'
);

const run=
  spawnSync(
    process.execPath,
    [
      'scripts/patch-android-platform.mjs',
      '--build-id',
      id,
      '--engine',
      'cordova'
    ],
    {
      cwd:root,
      encoding:'utf8'
    }
  );

if(run.status!==0){
  throw new Error(
    `Cordova patch failed:\n${run.stderr}`
  );
}

const main=
  fs.readFileSync(
    path.join(
      javaDir,
      'MainActivity.java'
    ),
    'utf8'
  );

const compact=
  main.replace(
    /\s+/g,
    ''
  );

const required=[
  'CORDOVA_NAVIGATION_TOOLBAR_ENABLED=true',
  'CORDOVA_EXTERNAL_LINKS_ENABLED=true',
  'CORDOVA_DOWNLOAD_MANAGER_ENABLED=true',

  'JepongSystemWebViewClient',
  'extendsSystemWebViewClient',
  'SystemWebViewEngine',
  'super.shouldOverrideUrlLoading',
  'request.hasGesture()',
  'shouldOpenExternally',

  'installCordovaNavigationToolbar',
  'Intent.ACTION_SEND',
  'web.canGoBack()',
  'web.canGoForward()',

  'setDownloadListener',
  'startCordovaDownload',

  'DownloadManager.Request',
  'URLUtil.guessFileName',
  'CookieManager.getInstance().getCookie',
  'Environment.DIRECTORY_DOWNLOADS',
  'VISIBILITY_VISIBLE_NOTIFY_COMPLETED',
  'manager.enqueue',

  'applySystemSafeArea',
  'navigationProgress',
  'showNavigationProgress',
  'finishNavigationProgress',
  'setDecorFitsSystemWindows(false)',
  'Powered by Jepong Devxyz',
  'showExitConfirmation',
  'handleAppBack',
  'registerOnBackInvokedCallback',
  'Color.rgb(0,229,255)',
  'setScaleY(1.8f)'
];

for(const token of required){

  const normalized=
    token.replace(
      /\s+/g,
      ''
    );

  if(
    !compact.includes(
      normalized
    )
  ){
    throw new Error(
      `cordova control missing: ${token}`
    );
  }
}

for(const control of [
  'navigationToolbar',
  'externalLinks',
  'downloadManager'
]){
  const capability=
    getCapability(
      'cordova',
      'controls',
      control
    );

  if(
    capability.status!==
      CAPABILITY_STATUS.EXPERIMENTAL
  ){
    throw new Error(
      `cordova ${control} capability missing`
    );
  }

  if(
    !getSelectableFeatureIds(
      'cordova',
      'controls'
    ).includes(control)
  ){
    throw new Error(
      `cordova ${control} is not selectable`
    );
  }
}

console.log(
  '✓ Cordova browser controls regression'
);
