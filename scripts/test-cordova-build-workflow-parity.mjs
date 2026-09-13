import assert from 'node:assert/strict';
import fs from 'node:fs';

const live = fs.readFileSync('.github/workflows/build-apk.yml', 'utf8');
const verify = fs.readFileSync('.github/workflows/verify-engines.yml', 'utf8');

function stepBlock(source, startName, endName) {
  const start = source.indexOf(`- name: ${startName}`);
  assert.notEqual(start, -1, `${startName} step must exist`);
  const end = source.indexOf(`- name: ${endName}`, start);
  assert.notEqual(end, -1, `${endName} step must follow ${startName}`);
  return source.slice(start, end);
}

const liveCordova = stepBlock(live, 'Build Cordova APK', 'Locate final APK');
const verifyCordova = stepBlock(verify, 'Build Cordova APK', 'Locate final APK');
const expectedCommand = 'gradle --no-daemon assembleRelease --stacktrace';

assert.match(verifyCordova, new RegExp(expectedCommand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'permanent verifier must use system Gradle for Cordova');
assert.match(liveCordova, new RegExp(expectedCommand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'live Cordova build must use the same system Gradle command as verification');
assert.doesNotMatch(liveCordova, /chmod\s+\+x\s+gradlew/, 'live Cordova build must not assume a Gradle wrapper exists');
assert.doesNotMatch(liveCordova, /\.\/gradlew/, 'live Cordova build must not invoke a missing Gradle wrapper');

console.log('✓ live Cordova build uses verified system Gradle path');
