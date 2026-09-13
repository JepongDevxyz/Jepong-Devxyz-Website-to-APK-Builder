import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync(
  new URL('./patch-android-platform.mjs',import.meta.url),
  'utf8'
);

assert.match(
  source,
  /const allowCleartext=String\(cfg\.websiteUrl\|\|''\)\.trim\(\)\.toLowerCase\(\)\.startsWith\('http:\/\/'\);/,
  'Final Android manifest patch must derive cleartext allowance from an explicit http:// website URL'
);

assert.ok(
  !source.includes("tag=setAttr(tag,'android:usesCleartextTraffic','true');"),
  'Final Android manifest patch must not unconditionally enable cleartext traffic'
);

assert.ok(
  source.includes("tag=setAttr(tag,'android:usesCleartextTraffic',allowCleartext?'true':'false');"),
  'Final Android manifest patch must write true for HTTP and false for HTTPS/non-HTTP builds'
);

console.log('✓ Final Android cleartext policy is HTTP-only');
