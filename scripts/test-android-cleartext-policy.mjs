import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {
  androidCleartextAllowed,
  patchAndroidCleartextPolicy
} from './patch-android-cleartext-policy.mjs';

assert.equal(androidCleartextAllowed('http://example.com'),true);
assert.equal(androidCleartextAllowed(' HTTP://10.0.2.2:8765/index.html '),true);
assert.equal(androidCleartextAllowed('https://example.com'),false);
assert.equal(androidCleartextAllowed('file:///android_asset/index.html'),false);

const root=fs.mkdtempSync(path.join(os.tmpdir(),'jepong-cleartext-'));

try{
  for(const testCase of [
    {engine:'capacitor',url:'http://10.0.2.2:8765/index.html',expected:'true'},
    {engine:'capacitor',url:'https://example.com',expected:'false'},
    {engine:'cordova',url:'http://10.0.2.2:8765/index.html',expected:'true'},
    {engine:'cordova',url:'https://example.com',expected:'false'}
  ]){
    const project=path.join(root,`${testCase.engine}-${testCase.expected}`);
    const androidRoot=
      testCase.engine==='capacitor'
        ? path.join(project,'android')
        : path.join(project,'platforms/android');
    const manifest=path.join(androidRoot,'app/src/main/AndroidManifest.xml');

    fs.mkdirSync(path.dirname(manifest),{recursive:true});
    fs.writeFileSync(
      manifest,
      '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:usesCleartextTraffic="true" /></manifest>'
    );

    patchAndroidCleartextPolicy(
      {engine:testCase.engine,websiteUrl:testCase.url},
      project
    );

    const output=fs.readFileSync(manifest,'utf8');
    assert.ok(
      output.includes(`android:usesCleartextTraffic="${testCase.expected}"`),
      `${testCase.engine} ${testCase.url} must produce cleartext=${testCase.expected}`
    );
  }

  const integration=fs.readFileSync(
    new URL('./patch-cross-engine-browser-ux.mjs',import.meta.url),
    'utf8'
  );

  assert.ok(
    integration.includes('patchAndroidCleartextPolicy(cfg,projectDir);'),
    'Final cross-engine Android patch pipeline must apply the cleartext policy after platform generation'
  );
}finally{
  fs.rmSync(root,{recursive:true,force:true});
}

console.log('✓ Final Android cleartext policy is HTTP-only');
