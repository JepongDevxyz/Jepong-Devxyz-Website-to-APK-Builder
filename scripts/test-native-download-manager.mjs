import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  writeNative
} from './write-native.mjs';

import {
  CAPABILITY_STATUS,
  getCapability,
  getSelectableFeatureIds
} from '../capabilities.mjs';

const out=
  path.join(
    os.tmpdir(),
    'jepong-native-download-regression'
  );

fs.rmSync(
  out,
  {
    recursive:true,
    force:true
  }
);

writeNative(
  {
    websiteUrl:'https://example.com',
    appName:'Download Test',
    packageName:'com.jepongdevxyz.downloadtest',

    versionName:'1.0.0',
    versionCode:1,

    renderMode:'default',
    orientation:'auto',

    permissions:[],

    controls:[
      'downloadManager'
    ],

    extensions:[],

    oneSignalAppId:'',
    offlineFallback:'Offline',

    iconDataUrl:'',
    splashDataUrl:'',

    splashEnabled:false,
    splashDuration:0,

    apkSigner:false,

    sizeOptimization:false,
    abiTarget:'universal'
  },

  out,
  false
);

const main=
  fs.readFileSync(
    path.join(
      out,
      'app/src/main/java/com/jepongdevxyz/downloadtest/MainActivity.java'
    ),
    'utf8'
  );

for(const token of [
  'NATIVE_DOWNLOAD_MANAGER_ENABLED=true',
  'setDownloadListener',
  'startNativeDownload',
  'DownloadManager.Request',
  'URLUtil.guessFileName',
  'CookieManager.getInstance().getCookie',
  'Environment.DIRECTORY_DOWNLOADS',
  'VISIBILITY_VISIBLE_NOTIFY_COMPLETED',
  'manager.enqueue'
]){
  if(!main.includes(token)){
    throw new Error(
      `native download behavior missing: ${token}`
    );
  }
}

const capability=
  getCapability(
    'native',
    'controls',
    'downloadManager'
  );

if(
  capability.status!==
    CAPABILITY_STATUS.EXPERIMENTAL
){
  throw new Error(
    `native download capability status is ${capability.status}`
  );
}

if(
  !getSelectableFeatureIds(
    'native',
    'controls'
  ).includes(
    'downloadManager'
  )
){
  throw new Error(
    'native downloadManager is not selectable'
  );
}

fs.rmSync(
  out,
  {
    recursive:true,
    force:true
  }
);

console.log(
  '✓ native download manager regression'
);
