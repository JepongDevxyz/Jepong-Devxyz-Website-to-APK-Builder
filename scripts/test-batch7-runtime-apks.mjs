import fs from 'node:fs';

const workflow =
  '.github/workflows/batch7-runtime-apks.yml';

const checklist =
  'docs/batch7-runtime-checklist.md';

if(!fs.existsSync(workflow)){
  throw new Error(
    'Batch 7 runtime workflow missing'
  );
}

if(!fs.existsSync(checklist)){
  throw new Error(
    'Batch 7 runtime checklist missing'
  );
}

const text =
  fs.readFileSync(
    workflow,
    'utf8'
  );

const required = [
  'name: Build Batch 7 Runtime APKs',

  'engine: [native, gecko, capacitor, cordova]',

  "https://whatpwacando.today/",

  'BUILD_ID: batch7-runtime-${{ matrix.engine }}',

  'com.jepongdevxyz.runtime${engine}',

  'com.jepongdevxyz.runtime${ENGINE}',

  'Jepong Runtime ${engine}',

  'getSelectableFeatureIds(',

  'APK_KEYSTORE_BASE64',
  'APK_KEYSTORE_PASSWORD',
  'APK_KEY_ALIAS',
  'APK_KEY_PASSWORD',

  'production-existing-keystore',

  'f5e197d89410cb681acc9cd803f277e06c05ac2fa843adb9603fc3b4fdb1c3a2',

  'runtimeVerified:',
  'false',

  "testUrl:",
  "runtimeChecklist:",

  'batch7-runtime-${{ matrix.engine }}-apk',

  'Jepong-Devxyz-${ENGINE}-runtime.apk'
];

for(const token of required){
  if(!text.includes(token)){
    throw new Error(
      `Batch 7 workflow missing: ${token}`
    );
  }
}

if(
  text.includes(
    "'https://example.com'"
  )
){
  throw new Error(
    'Batch 7 must not use example.com'
  );
}

/*
  Runtime build MUST use the existing production
  keystore only. Never generate a replacement key.
*/
for(const forbidden of [
  'keytool -genkeypair',
  'jepong-test-2026',
  'Jepong Devxyz Test'
]){
  if(text.includes(forbidden)){
    throw new Error(
      `Batch 7 contains replacement signer: ${forbidden}`
    );
  }
}

/*
  We must NOT claim runtime success merely because
  an APK compiled and was signed.
*/
if(
  !/runtimeVerified:\s*false/.test(text)
){
  throw new Error(
    'Batch 7 manifest must remain runtimeVerified false before device testing'
  );
}

const guide =
  fs.readFileSync(
    checklist,
    'utf8'
  );

for(const token of [
  '# Batch 7 Physical Runtime Checklist',

  'What PWA Can Do Today',

  'Native WebView',
  'GeckoView',
  'Capacitor',
  'Cordova',

  'PASS',
  'FAIL',
  'NOT TESTED',

  'Camera',
  'Microphone',
  'Location',
  'Files',

  'Navigation toolbar',
  'External links',
  'Download manager',

  'Notifications',
  'Firefox WebExtensions'
]){
  if(!guide.includes(token)){
    throw new Error(
      `Batch 7 checklist missing: ${token}`
    );
  }
}

console.log(
  '✓ Batch 7 runtime build definition and checklist'
);
