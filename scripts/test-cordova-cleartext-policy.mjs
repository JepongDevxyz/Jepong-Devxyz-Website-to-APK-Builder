import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { writeCordova } from './write-cordova.mjs';

function generateConfig(websiteUrl){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jepong-cordova-cleartext-'));
  try{
    writeCordova({
      websiteUrl,
      appName:'Cordova Cleartext Policy Test',
      packageName:'com.jepongdevxyz.cleartexttest',
      versionName:'1.0.0',
      versionCode:1,
      orientation:'auto',
      splashEnabled:false,
      splashDuration:0,
      iconDataUrl:'',
      splashDataUrl:''
    },dir);
    return fs.readFileSync(path.join(dir,'config.xml'),'utf8');
  }finally{
    fs.rmSync(dir,{recursive:true,force:true});
  }
}

const httpConfig=generateConfig('http://10.0.2.2:8765/index.html');
assert.ok(
  httpConfig.includes('xmlns:android="http://schemas.android.com/apk/res/android"'),
  'HTTP Cordova config must declare Android XML namespace'
);
assert.ok(
  httpConfig.includes('<platform name="android">'),
  'HTTP Cordova config must include Android platform policy'
);
assert.ok(
  httpConfig.includes('target="/manifest/application"'),
  'HTTP Cordova config must merge policy into Android application manifest node'
);
assert.ok(
  httpConfig.includes('android:usesCleartextTraffic="true"'),
  'HTTP Cordova config must explicitly allow cleartext traffic for its configured HTTP HOME URL'
);

const httpsConfig=generateConfig('https://example.com/index.html');
assert.ok(
  !httpsConfig.includes('android:usesCleartextTraffic="true"'),
  'HTTPS Cordova config must not enable cleartext traffic'
);

console.log('✓ Cordova cleartext policy is scoped to HTTP HOME URLs');
