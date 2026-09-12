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
    'jepong-native-external-links-regression'
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

    appName:'External Links Test',

    packageName:
      'com.jepongdevxyz.externallinkstest',

    versionName:'1.0.0',
    versionCode:1,

    renderMode:'default',
    orientation:'auto',

    permissions:[],

    controls:[
      'externalLinks'
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
      'app/src/main/java/com/jepongdevxyz/externallinkstest/MainActivity.java'
    ),
    'utf8'
  );

for(const token of [
  'NATIVE_EXTERNAL_LINKS_ENABLED=true',
  'r.hasGesture()',
  'shouldOpenExternally(u)',
  'openExternalUrl(u)',
  'Intent.ACTION_VIEW',
  'normalizeHost'
]){
  if(!main.includes(token)){
    throw new Error(
      `native external links behavior missing: ${token}`
    );
  }
}

const capability=
  getCapability(
    'native',
    'controls',
    'externalLinks'
  );

if(
  capability.status!==
    CAPABILITY_STATUS.VERIFIED
){
  throw new Error(
    `native external links capability status is ${capability.status}`
  );
}

if(
  !getSelectableFeatureIds(
    'native',
    'controls'
  ).includes(
    'externalLinks'
  )
){
  throw new Error(
    'native external links capability is not selectable'
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
  '✓ native external links regression'
);