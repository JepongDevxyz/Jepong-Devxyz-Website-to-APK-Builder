import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  writeNative
} from './write-native.mjs';

const out=
  path.join(
    os.tmpdir(),
    'jepong-native-runtime-permissions'
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
    appName:'Runtime Permissions Test',
    packageName:'com.jepongdevxyz.runtimepermissionstest',

    versionName:'1.0.0',
    versionCode:1,

    renderMode:'default',
    orientation:'auto',

    permissions:[
      'camera',
      'microphone',
      'location'
    ],

    controls:[],
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
      'app/src/main/java/com/jepongdevxyz/runtimepermissionstest/MainActivity.java'
    ),
    'utf8'
  );

for(const token of [
  'PermissionRequest pendingWebPermissionRequest',
  'GeolocationPermissions.Callback pendingLocationCallback',
  'missingWebPermissions',
  'requestPermissions(missing.toArray(new String[0]),701)',
  'requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},702)',
  'handlePendingWebPermissionResult',
  'handlePendingLocationPermissionResult',
  'if(code==701)',
  'if(code==702)'
]){
  if(!main.includes(token)){
    throw new Error(
      `native runtime permission behavior missing: ${token}`
    );
  }
}

fs.rmSync(
  out,
  {
    recursive:true,
    force:true
  }
);

console.log(
  '✓ native runtime permissions regression'
);
