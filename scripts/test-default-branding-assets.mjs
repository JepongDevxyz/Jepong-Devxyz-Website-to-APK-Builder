import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const iconPath=path.join(ROOT,'assets/default-icon.png');
const splashPath=path.join(ROOT,'assets/default-splash.png');

function sha256(buffer){
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function pngSize(buffer){
  const signature='89504e470d0a1a0a';
  assert.equal(buffer.subarray(0,8).toString('hex'),signature,'asset must be a real PNG');
  assert.equal(buffer.subarray(12,16).toString('ascii'),'IHDR','PNG IHDR chunk missing');
  return {
    width:buffer.readUInt32BE(16),
    height:buffer.readUInt32BE(20)
  };
}

const icon=fs.readFileSync(iconPath);
const splash=fs.readFileSync(splashPath);

assert.equal(
  sha256(icon),
  '0b783d4dc5638c5de08f36e6a8009ba87f8a2e07e952fe91f673c603742cfb20',
  'default icon is not the approved Jepong Devxyz JD artwork'
);
assert.equal(
  sha256(splash),
  'd3100f05f8aadb2c2973cd04a250a2794355295b48a48c5a4ae0fc52681710c4',
  'default splash is not the approved Powered by Jepong Devxyz artwork'
);

const iconSize=pngSize(icon);
const splashSize=pngSize(splash);
assert.ok(iconSize.width>=512 && iconSize.height>=512,'default icon must be at least 512x512');
assert.ok(splashSize.width>=540 && splashSize.height>=960,'default splash must be at least 540x960');
assert.ok(splashSize.height>splashSize.width,'default splash must remain portrait');

const common=fs.readFileSync(path.join(ROOT,'scripts/common.mjs'),'utf8');
const cordova=fs.readFileSync(path.join(ROOT,'scripts/write-cordova.mjs'),'utf8');
const app=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');

for(const token of ['assets',"default-icon.png","default-splash.png"]){
  assert.ok(common.includes(token),`shared brandedAsset fallback missing ${token}`);
}
assert.ok(cordova.includes("assets/default-icon.png"),'Cordova platform seed does not use the default icon');
assert.ok(cordova.includes("assets/default-splash.png"),'Cordova platform seed does not use the default splash');
assert.ok(app.includes("/assets/default-icon.png"),'builder preview does not use the default icon');
assert.ok(app.includes("/assets/default-splash.png"),'builder preview does not use the default splash');

console.log('✓ approved default branding assets and all-engine fallback contract');
