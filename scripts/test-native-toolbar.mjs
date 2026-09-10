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
    'jepong-native-toolbar-regression'
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
    appName:'Toolbar Test',
    packageName:'com.jepongdevxyz.toolbartest',
    versionName:'1.0.0',
    versionCode:1,
    renderMode:'default',
    orientation:'auto',
    permissions:[],
    controls:[
      'navigationToolbar'
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
      'app/src/main/java/com/jepongdevxyz/toolbartest/MainActivity.java'
    ),
    'utf8'
  );

for(const token of [
  'NATIVE_NAVIGATION_TOOLBAR_ENABLED=true',
  'buildNativeNavigationBar',
  'Intent.ACTION_SEND',
  'web.canGoBack()',
  'web.canGoForward()'
]){
  if(!main.includes(token)){
    throw new Error(
      `native toolbar behavior missing: ${token}`
    );
  }
}

const capability=
  getCapability(
    'native',
    'controls',
    'navigationToolbar'
  );

if(
  capability.status!==
    CAPABILITY_STATUS.EXPERIMENTAL
){
  throw new Error(
    `native toolbar capability status is ${capability.status}`
  );
}

if(
  !getSelectableFeatureIds(
    'native',
    'controls'
  ).includes(
    'navigationToolbar'
  )
){
  throw new Error(
    'native toolbar capability is not selectable'
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
  '✓ native navigation toolbar regression'
);
