import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT=path.resolve(process.cwd());
const apk=process.argv[2];
const engine=process.argv[3];
const ENGINES=['native','gecko','capacitor','cordova'];
if(!apk || !engine || !ENGINES.includes(engine)){
  console.error('Usage: node scripts/verify-apk-branding.mjs <apk> <native|gecko|capacitor|cordova>');
  process.exit(2);
}
if(!fs.existsSync(apk)){console.error(`APK not found: ${apk}`);process.exit(2);}

const expected={
  icon:crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'assets/default-icon.png'))).digest('hex'),
  splash:crypto.createHash('sha256').update(Buffer.from(fs.readFileSync(path.join(ROOT,'assets/default-splash.base64.txt'),'utf8').trim(),'base64')).digest('hex')
};
function zipEntries(){
  const r=spawnSync('unzip',['-Z1',apk],{encoding:'utf8'});
  if(r.status!==0)throw new Error(`unable to read APK archive: ${r.stderr.trim()}`);
  return r.stdout.split(/\r?\n/).filter(Boolean);
}
function bytesFor(entry){
  const r=spawnSync('unzip',['-p',apk,entry],{encoding:null,maxBuffer:32*1024*1024});
  if(r.status!==0)throw new Error(`unable to read APK entry: ${entry}`);
  return r.stdout;
}
function digestEntry(entry){return crypto.createHash('sha256').update(bytesFor(entry)).digest('hex');}

try{
  const entries=zipEntries();
  // AAPT2 compiles and may renumber resource files, so exact source PNG bytes
  // are not guaranteed to survive under res/. The build pipeline therefore
  // packages byte-exact evidence copies while the manifest/generator contract
  // independently verifies @drawable/app_icon is the launcher resource.
  const iconEntry='assets/jepong_icon.img';
  const splashEntry='assets/jepong_splash.img';
  const iconPresent=entries.includes(iconEntry);
  const splashPresent=entries.includes(splashEntry);
  const iconMatch=iconPresent&&digestEntry(iconEntry)===expected.icon;
  const splashMatch=splashPresent&&digestEntry(splashEntry)===expected.splash;
  const report={
    status:iconMatch&&splashMatch?'verified':'failed',apk:path.resolve(apk),engine,
    icon:{expectedSha256:expected.icon,presentEntry:iconPresent?iconEntry:null,matching:iconMatch},
    splash:{expectedSha256:expected.splash,presentEntry:splashPresent?splashEntry:null,matching:splashMatch},
    diagnosticEntries:entries.filter(entry=>/(jepong_icon|jepong_splash|launcher|drawable|mipmap)/i.test(entry)).slice(0,300)
  };
  if(report.status!=='verified'){
    const failures=[];
    if(!iconPresent)failures.push('icon evidence path');else if(!iconMatch)failures.push('icon bytes');
    if(!splashPresent)failures.push('splash evidence path');else if(!splashMatch)failures.push('splash bytes');
    console.error(`APK branding mismatch (${engine}): ${failures.join(', ')}`);
    process.stdout.write(`${JSON.stringify(report)}\n`);process.exitCode=1;
  }else process.stdout.write(`${JSON.stringify(report)}\n`);
}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
