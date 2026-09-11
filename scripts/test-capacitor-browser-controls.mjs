import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

import {
  CAPABILITY_STATUS,
  getCapability,
  getSelectableFeatureIds
} from '../capabilities.mjs';

const root=path.resolve(process.cwd());
const id='test-capacitor-controls';

const buildPath=
  path.join(
    root,
    'builds',
    `${id}.json`
  );

const project=
  path.join(
    root,
    'work',
    id,
    'project'
  );

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
      appName:'Capacitor Controls',
      packageName:'com.jepongdevxyz.capcontrols',

      versionName:'1.0.0',
      versionCode:1,

      engine:'capacitor',

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
    'android',
    'app'
  );

const javaDir=
  path.join(
    app,
    'src/main/java/com/jepongdevxyz/capcontrols'
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
  namespace 'com.jepongdevxyz.capcontrols'

  defaultConfig {
    versionCode 1
    versionName "1.0"
  }
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
  'package com.jepongdevxyz.capcontrols; public class MainActivity {}'
);

const run=
  spawnSync(
    process.execPath,
    [
      'scripts/patch-android-platform.mjs',
      '--build-id',
      id,
      '--engine',
      'capacitor'
    ],
    {
      cwd:root,
      encoding:'utf8'
    }
  );

if(run.status!==0){
  throw new Error(
    `Capacitor patch failed:\n${run.stderr}`
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

/*
  Ignore formatting/newlines in generated Java.
  This prevents false failures from pretty formatting.
*/
const compact=
  main.replace(
    /\s+/g,
    ''
  );

const required=[
  'CAPACITOR_NAVIGATION_TOOLBAR_ENABLED=true',
  'CAPACITOR_EXTERNAL_LINKS_ENABLED=true',
  'CAPACITOR_DOWNLOAD_MANAGER_ENABLED=true',

  'JepongBridgeWebViewClient',
  'extendsBridgeWebViewClient',
  'request.hasGesture()',
  'super.shouldOverrideUrlLoading',

  'installCapacitorNavigationToolbar',
  'Intent.ACTION_SEND',

  'web.canGoBack()',
  'web.canGoForward()',

  'setDownloadListener',
  'startCapacitorDownload',

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

  const normalizedToken=
    token.replace(
      /\s+/g,
      ''
    );

  if(
    !compact.includes(
      normalizedToken
    )
  ){
    throw new Error(
      `capacitor control missing: ${token}`
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
      'capacitor',
      'controls',
      control
    );

  if(
    capability.status!==
      CAPABILITY_STATUS.EXPERIMENTAL
  ){
    throw new Error(
      `capacitor ${control} capability missing`
    );
  }

  if(
    !getSelectableFeatureIds(
      'capacitor',
      'controls'
    ).includes(control)
  ){
    throw new Error(
      `capacitor ${control} is not selectable`
    );
  }
}

console.log(
  '✓ Capacitor browser controls regression'
);
