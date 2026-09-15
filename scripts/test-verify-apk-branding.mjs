import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT=path.resolve(process.cwd());
const sandbox=fs.mkdtempSync(path.join(os.tmpdir(),'jepong-apk-branding-'));
const icon=fs.readFileSync(path.join(ROOT,'assets/default-icon.png'));
const splash=Buffer.from(fs.readFileSync(path.join(ROOT,'assets/default-splash.base64.txt'),'utf8').trim(),'base64');
function makeZip(name,files){
  const target=path.join(sandbox,`${name}.apk`), source=path.join(sandbox,`${name}.files`);
  for(const [entry,bytes] of Object.entries(files)){
    const file=path.join(source,entry); fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,bytes);
  }
  const result=spawnSync('zip',['-qr',target,'.'],{cwd:source,encoding:'utf8'});
  assert.equal(result.status,0,`fixture zip failed: ${result.stderr}`); return target;
}
function run(apk,engine='native'){return spawnSync(process.execPath,['scripts/verify-apk-branding.mjs',apk,engine],{cwd:ROOT,encoding:'utf8'});}
function validFiles(){return {'res/drawable-nodpi/app_icon.png':icon,'assets/jepong_splash.img':splash};}
for(const engine of ['native','gecko','capacitor','cordova']){
  const result=run(makeZip(`verified-${engine}`,validFiles()),engine);
  assert.equal(result.status,0,`${engine}: ${result.stderr}`); assert.equal(JSON.parse(result.stdout).status,'verified');
}
const wrongSplash=run(makeZip('wrong-splash',{...validFiles(),'assets/jepong_splash.img':Buffer.from('wrong-splash')}));
assert.notEqual(wrongSplash.status,0,'wrong splash bytes must fail'); assert.match(wrongSplash.stderr,/splash bytes/i);
const missingPath=run(makeZip('missing-path',{'res/drawable/app_icon.png':icon,'assets/jepong_splash.img':splash}));
assert.notEqual(missingPath.status,0,'unexpected icon path must fail'); assert.match(missingPath.stderr,/icon path/i);
const malformed=path.join(sandbox,'malformed.apk'); fs.writeFileSync(malformed,Buffer.from('not a zip archive'));
const malformedResult=run(malformed); assert.notEqual(malformedResult.status,0,'malformed archive must fail closed'); assert.match(malformedResult.stderr,/unable to read APK archive/i);
const wrongIcon=run(makeZip('wrong-icon',{...validFiles(),'res/drawable-nodpi/app_icon.png':Buffer.from('wrong-icon')}));
assert.notEqual(wrongIcon.status,0,'wrong icon bytes must fail'); assert.match(wrongIcon.stderr,/icon bytes/i);
fs.rmSync(sandbox,{recursive:true,force:true}); console.log('✓ final APK branding verifier contract');
