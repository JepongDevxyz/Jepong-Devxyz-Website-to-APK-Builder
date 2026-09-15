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
  const result=spawnSync('unzip',['-p',apk,entry],{encoding:null,maxBuffer:32*1024*1024});
  if(result.status!==0) throw new Error(`unable to read APK entry: ${entry}`);
  return result.stdout;
}
function digestEntry(entry){
  return crypto.createHash('sha256').update(bytesFor(entry)).digest('hex');
}
function unique(items){ return [...new Set(items)]; }

try{
  const entries=zipEntries();

  // Android/AAPT2 may rewrite resource qualifier directories in the packaged
  // APK (for example drawable-nodpi -> drawable-nodpi-v4). Verify the actual
  // selected branding bytes instead of requiring one source-tree pathname.
  const iconCandidates=entries.filter(entry=>
    /^res\/drawable(?:-[^/]+)?\/app_icon\.(?:png|webp|jpe?g)$/i.test(entry) ||
    /^res\/mipmap(?:-[^/]+)?\/app_icon\.(?:png|webp|jpe?g)$/i.test(entry)
  );
  const splashCandidates=entries.filter(entry=>entry==='assets/jepong_splash.img');

  const iconMatching=iconCandidates.filter(entry=>digestEntry(entry)===expected.icon);
  const splashMatching=splashCandidates.filter(entry=>digestEntry(entry)===expected.splash);

  const report={
    status:iconMatching.length>=1&&splashMatching.length===1?'verified':'failed',
    apk:path.resolve(apk),
    engine,
    icon:{expectedSha256:expected.icon,presentEntries:unique(iconCandidates),matchingEntries:unique(iconMatching)},
    splash:{expectedSha256:expected.splash,presentEntries:unique(splashCandidates),matchingEntries:unique(splashMatching)},
    diagnosticEntries:entries.filter(entry=>/(app_icon|jepong_splash|launcher|drawable|mipmap)/i.test(entry)).slice(0,300)
  };

  if(report.status!=='verified'){
    const failures=[];
    if(iconCandidates.length===0) failures.push('icon path');
    else if(iconMatching.length===0) failures.push('icon bytes');
    if(splashCandidates.length!==1) failures.push('splash path');
    else if(splashMatching.length!==1) failures.push('splash bytes');
    console.error(`APK branding mismatch (${engine}): ${failures.join(', ')}`);
    process.stdout.write(`${JSON.stringify(report)}\n`);
    process.exitCode=1;
  }else{
    process.stdout.write(`${JSON.stringify(report)}\n`);
  }
}catch(error){
  console.error(error instanceof Error?error.message:String(error));
  process.exitCode=1;
}
