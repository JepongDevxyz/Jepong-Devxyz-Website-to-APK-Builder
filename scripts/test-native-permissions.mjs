import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {writeNative} from './write-native.mjs';
import {
  CAPABILITY_STATUS,
  getCapability,
  getSelectableFeatureIds
} from '../capabilities.mjs';
import {getCapabilityEvidence} from '../verification/capability-verification.mjs';

const out=path.join(os.tmpdir(),'jepong-native-permissions-verification');
fs.rmSync(out,{recursive:true,force:true});

const allPermissionIds=[
  'camera','microphone','notification','location','media','contacts',
  'calendar','biometrics','files','bluetooth','sensors'
];

writeNative({
  websiteUrl:'https://example.com',
  appName:'Native Permissions Verification',
  packageName:'com.jepongdevxyz.nativepermissions',
  versionName:'1.0.0',
  versionCode:1,
  engine:'native',
  renderMode:'default',
  orientation:'auto',
  permissions:allPermissionIds,
  controls:[],
  extensions:[],
  oneSignalAppId:'',
  offlineFallback:'Offline',
  iconDataUrl:'',
  splashDataUrl:'',
  splashEnabled:false,
  splashDuration:0,
  sizeOptimization:false,
  abiTarget:'universal'
},out,false);

const manifest=fs.readFileSync(
  path.join(out,'app/src/main/AndroidManifest.xml'),'utf8'
);
const main=fs.readFileSync(
  path.join(out,'app/src/main/java/com/jepongdevxyz/nativepermissions/MainActivity.java'),'utf8'
);

const manifestTokens=[
  'android.permission.CAMERA',
  'android.permission.RECORD_AUDIO',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.READ_CONTACTS',
  'android.permission.READ_CALENDAR',
  'android.permission.WRITE_CALENDAR',
  'android.permission.USE_BIOMETRIC',
  'android.permission.BLUETOOTH_SCAN',
  'android.permission.BLUETOOTH_CONNECT',
  'android.permission.BODY_SENSORS'
];
for(const token of manifestTokens){
  if(!manifest.includes(token)) throw new Error(`native permission manifest wiring missing: ${token}`);
}

const runtimeTokens=[
  'p.add(Manifest.permission.CAMERA)',
  'p.add(Manifest.permission.RECORD_AUDIO)',
  'p.add(Manifest.permission.ACCESS_FINE_LOCATION)',
  'p.add(Manifest.permission.ACCESS_COARSE_LOCATION)',
  'p.add(Manifest.permission.POST_NOTIFICATIONS)',
  'p.add(Manifest.permission.READ_MEDIA_IMAGES)',
  'p.add(Manifest.permission.READ_MEDIA_VIDEO)',
  'p.add(Manifest.permission.READ_CONTACTS)',
  'p.add(Manifest.permission.READ_CALENDAR)',
  'p.add(Manifest.permission.WRITE_CALENDAR)',
  'p.add(Manifest.permission.BLUETOOTH_SCAN)',
  'p.add(Manifest.permission.BLUETOOTH_CONNECT)',
  'p.add(Manifest.permission.BODY_SENSORS)',
  'requestPermissions(missing.toArray(new String[0]),701)',
  'requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},702)',
  'startActivityForResult(p.createIntent(),901)'
];
for(const token of runtimeTokens){
  if(!main.includes(token)) throw new Error(`native permission runtime wiring missing: ${token}`);
}

for(const id of ['media','contacts','calendar','biometrics','bluetooth','sensors','notification']){
  const capability=getCapability('native','permissions',id);
  if(capability.status!==CAPABILITY_STATUS.UNSUPPORTED){
    throw new Error(`native ${id} must stay Unsupported until a website-facing implementation exists`);
  }
  if(getSelectableFeatureIds('native','permissions').includes(id)){
    throw new Error(`native ${id} is unsupported but selectable`);
  }
}

for(const id of ['camera','microphone','location','files']){
  const evidence=getCapabilityEvidence('native','permissions',id);
  if(!evidence?.generator){
    throw new Error(`native ${id} generator evidence not recorded`);
  }
}

fs.rmSync(out,{recursive:true,force:true});
console.log('✓ native permission generator and capability-truth verification');
