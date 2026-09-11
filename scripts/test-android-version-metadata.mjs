import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const patcher =
  fs.readFileSync(
    new URL(
      './patch-android-platform.mjs',
      import.meta.url
    ),
    'utf8'
  );

/*
  Capacitor must synchronize the builder's
  versionName/versionCode into the real
  Android Gradle project.
*/
assert.match(
  patcher,
  /patchAndroidVersionMetadata\(appRoot,\s*cfg\)/,
  'Capacitor patch flow must synchronize Android version metadata'
);

const {
  patchAndroidVersionMetadata
} = await import(
  './android-version-metadata.mjs'
);

const tmp =
  fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      'jepong-cap-version-'
    )
  );

try {

  const appRoot =
    path.join(
      tmp,
      'app'
    );

  fs.mkdirSync(
    appRoot,
    {
      recursive: true
    }
  );

  const gradle =
    path.join(
      appRoot,
      'build.gradle'
    );

  fs.writeFileSync(
    gradle,
`apply plugin: 'com.android.application'

android {
    namespace = "com.getcapacitor.myapp"

    defaultConfig {
        applicationId "com.example.app"
        minSdkVersion 23
        targetSdkVersion 36
        versionCode 1
        versionName "1.0"
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    }
}
`
  );

  patchAndroidVersionMetadata(
    appRoot,
    {
      versionCode: 27,
      versionName: '2.7.9'
    }
  );

  const result =
    fs.readFileSync(
      gradle,
      'utf8'
    );

  assert.match(
    result,
    /^\s*versionCode 27\s*$/m
  );

  assert.match(
    result,
    /^\s*versionName "2\.7\.9"\s*$/m
  );

  assert.match(
    result,
    /applicationId "com\.example\.app"/
  );

  assert.doesNotMatch(
    result,
    /^\s*versionName "1\.0"\s*$/m
  );

  const first =
    result;

  patchAndroidVersionMetadata(
    appRoot,
    {
      versionCode: 27,
      versionName: '2.7.9'
    }
  );

  const second =
    fs.readFileSync(
      gradle,
      'utf8'
    );

  assert.equal(
    second,
    first,
    'Version patch must be idempotent'
  );

  console.log(
    '✓ Capacitor Android version metadata sync'
  );

} finally {

  fs.rmSync(
    tmp,
    {
      recursive: true,
      force: true
    }
  );

}
