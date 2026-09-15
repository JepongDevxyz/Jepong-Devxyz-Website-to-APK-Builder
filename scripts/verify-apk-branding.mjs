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
if(!fs.existsSync(apk)){ console.error(`APK not found: ${apk}`); process.exit(2); }

// Final paths produced by write-native/write-capacitor/write-cordova and the
// shared Android patch. The selected splash is relocated to app assets so
// AAPT2 never compiles the full branded image.
const EXPECTED_PATHS={
  native:{icon:['res/drawable-nodpi-v4/app_icon.png','res/drawable-nodpi/app_icon.png','res/drawable/app_icon.png'],splash:['assets/jepong_splash.img']},
  gecko:{icon:['res/drawable-nodpi-v4/app_icon.png','res/drawable-nodpi/app_icon.png','res/drawable/app_icon.png'],splash:['assets/jepong_splash.img']},
  capacitor:{icon:['res/drawable-nodpi-v4/app_icon.png','res/drawable-nodpi/app_icon.png','res/drawable/app_icon.png'],splash:['assets/jepong_splash.img']},
  cordova:{icon:['res/drawable-nodpi-v4/app_icon.png','res/drawable-nodpi/app_icon.png','res/drawable/app_icon.png'],splash:['assets/jepong_splash.img']}
};
const expected={
  icon:crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'assets/default-icon.png'))).digest('hex'),
  splash:crypto.createHash('sha256').update(Buffer.from(fs.readFileSync(path.join(ROOT,'assets/default-splash.base64.txt'),'utf8').trim(),'base64')).digest('hex')
};
function zipEntries(){
  const result=spawnSync('unzip',['-Z1',apk],{encoding:'utf8'});
  if(result.status!==0) throw new Error(`unable to read APK archive: ${result.stderr.trim()}`);
  return result.stdout.split(/\r?\n/).filter(Boolean);
}
function bytesFor(entry){
  const result=spawnSync('unzip',['-p',apk,entry],{encoding:null});
  if(result.status!==0) throw new Error(`unable to read APK entry: ${entry}`);
  return result.stdout;
}
function findExpected(entries,kind){
  const allowed=EXPECTED_PATHS[engine][kind];
  const present=allowed.filter(entry=>entries.includes(entry));
  const matching=present.filter(entry=>crypto.createHash('sha256').update(bytesFor(entry)).digest('hex')===expected[kind]);
  return {allowed,present,matching};
}
try{
  const entries=zipEntries();
  const icon=findExpected(entries,'icon');
  const splash=findExpected(entries,'splash');
  const report={status:icon.matching.length===1&&splash.matching.length===1?'verified':'failed',apk:path.resolve(apk),engine,
    icon:{expectedSha256:expected.icon,allowedEntries:icon.allowed,presentEntries:icon.present,matchingEntries:icon.matching},
    splash:{expectedSha256:expected.splash,allowedEntries:splash.allowed,presentEntries:splash.present,matchingEntries:splash.matching}};
  if(report.status!=='verified'){
    const failures=[];
    if(icon.present.length!==1) failures.push('icon path'); else if(icon.matching.length!==1) failures.push('icon bytes');
    if(splash.present.length!==1) failures.push('splash path'); else if(splash.matching.length!==1) failures.push('splash bytes');
    console.error(`APK branding mismatch (${engine}): ${failures.join(', ')}`);
    process.stdout.write(`${JSON.stringify(report)}\n`); process.exitCode=1;
  }else process.stdout.write(`${JSON.stringify(report)}\n`);
}catch(error){ console.error(error instanceof Error?error.message:String(error)); process.exitCode=1; }
