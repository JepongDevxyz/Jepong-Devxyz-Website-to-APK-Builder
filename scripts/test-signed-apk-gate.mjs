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

  'certificate SHA-256 digest:[[:space:]]*',

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
  apkSigner may be formatted across multiple lines.
*/
if(
  !/apkSigner:\s*true/.test(text)
){
  throw new Error(
    'signed APK gate missing: apkSigner true'
  );
}

/*
  Do not regress back to a particular apksigner
  presentation such as "Signer #1".
*/
if(
  text.includes(
    "s/^Signer #1 certificate SHA-256 digest: //p"
  )
){
  throw new Error(
    'signed APK gate uses brittle Signer #1 certificate parser'
  );
}

if(
  !text.includes(
    "s/^.*certificate SHA-256 digest:[[:space:]]*//p"
  )
){
  throw new Error(
    'signed APK gate lacks version-agnostic certificate parser'
  );
}

/*
  Batch 6 must NEVER create or silently substitute
  another signing key.
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
  All four actual engines must be represented.
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

/*
  Capacitor has a Gradle wrapper.
  Cordova Android 15.1.0 in this generated project
  is built by the provisioned system Gradle command.
*/
const cordovaStart=
  text.indexOf(
    '- name: Build Cordova release APK'
  );

const cordovaEnd=
  text.indexOf(
    '# LOCATE GENERATED APK',
    cordovaStart
  );

if(
  cordovaStart<0 ||
  cordovaEnd<0
){
  throw new Error(
    'Cordova signed build block missing'
  );
}

const cordovaBlock=
  text.slice(
    cordovaStart,
    cordovaEnd
  );

if(
  cordovaBlock.includes(
    'chmod +x gradlew'
  ) ||
  cordovaBlock.includes(
    './gradlew'
  )
){
  throw new Error(
    'Cordova signed build incorrectly assumes gradlew'
  );
}

if(
  !cordovaBlock.includes(
    'gradle'
  )
){
  throw new Error(
    'Cordova signed build missing system Gradle'
  );
}

console.log(
  '✓ Production-signed four-engine APK gate definition'
);
