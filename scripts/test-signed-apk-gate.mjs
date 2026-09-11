import fs from 'node:fs';

const workflow=
  '.github/workflows/verify-signed-apks.yml';

if(!fs.existsSync(workflow)){
  throw new Error(
    'signed APK gate workflow missing'
  );
}

const text=
  fs.readFileSync(
    workflow,
    'utf8'
  );

const required=[
  'Verify Production-Signed APKs',

  'matrix:',
  'engine: [native, gecko, capacitor, cordova]',

  'APK_KEYSTORE_BASE64',
  'APK_KEYSTORE_PASSWORD',
  'APK_KEY_ALIAS',
  'APK_KEY_PASSWORD',

  'apkSigner:',

  'getSelectableFeatureIds(',

  'zipalign',
  'apksigner',
  'aapt2',

  '-c',
  '--print-certs',
  'dump badging',

  'Signer #1 certificate SHA-256 digest',

  'f5e197d89410cb681acc9cd803f277e06c05ac2fa843adb9603fc3b4fdb1c3a2',

  'sha256sum',

  'verification-manifest.json',

  'production-existing-keystore',

  'signed-verified-${{ matrix.engine }}-apk'
];

for(const token of required){
  if(!text.includes(token)){
    throw new Error(
      `signed APK gate missing: ${token}`
    );
  }
}

/*
  Support both:
    apkSigner: true

  and:
    apkSigner:
      true
*/
if(
  !/apkSigner:\s*true/.test(text)
){
  throw new Error(
    'signed APK gate missing: apkSigner true'
  );
}

/*
  Batch 6 must NEVER silently replace the existing
  production signer with a generated test key.
*/
for(const forbidden of [
  'keytool -genkeypair',
  'jepong-test-2026',
  'Jepong Devxyz Test'
]){
  if(text.includes(forbidden)){
    throw new Error(
      `signed gate contains replacement signer: ${forbidden}`
    );
  }
}

/*
  Must build and patch all four actual engine types.
*/
for(const token of [
  'ENGINE" = "native"',
  'ENGINE" = "gecko"',
  'ENGINE" = "capacitor"',
  'ENGINE" = "cordova"',

  'npx cap add android',
  'npx cordova',
  'android@15.1.0',

  '--engine capacitor',
  '--engine cordova',

  'assembleRelease'
]){
  if(!text.includes(token)){
    throw new Error(
      `signed gate engine build missing: ${token}`
    );
  }
}

console.log(
  '✓ Production-signed four-engine APK gate definition'
);
