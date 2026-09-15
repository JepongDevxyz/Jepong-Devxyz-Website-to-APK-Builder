import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT=path.resolve(process.cwd());
const ENGINES=['native','gecko','capacitor','cordova'];
const expected={
  icon:crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'assets/default-icon.png'))).digest('hex'),
  splash:crypto.createHash('sha256').update(Buffer.from(fs.readFileSync(path.join(ROOT,'assets/default-splash.base64.txt'),'utf8').trim(),'base64')).digest('hex')
};
const value=name=>{const index=process.argv.indexOf(`--${name}`); return index<0?null:process.argv[index+1]??null;};
const requested={build:process.argv.includes('--build'),keep:process.argv.includes('--keep'),strictSigning:process.argv.includes('--strict-signing')};
const output=value('output');
const suppliedSdk=value('android-sdk');

function commandAvailable(command){
  return spawnSync(process.platform==='win32'?'where':'which',[command],{encoding:'utf8'}).status===0;
}

function findExecutable(sdk,name){
  const buildTools=sdk&&path.join(sdk,'build-tools');
  if(!buildTools||!fs.existsSync(buildTools)) return null;
  const executable=process.platform==='win32'?`${name}.bat`:name;
  return fs.readdirSync(buildTools)
    .map(version=>path.join(buildTools,version,executable))
    .filter(file=>fs.existsSync(file))
    .sort((left,right)=>right.localeCompare(left,undefined,{numeric:true}))[0]??null;
}

const androidSdk=suppliedSdk??process.env.ANDROID_HOME??process.env.ANDROID_SDK_ROOT??null;
const apksigner=findExecutable(androidSdk,'apksigner');
const tools={
  androidSdk:{available:Boolean(androidSdk&&fs.existsSync(androidSdk))},
  java:{available:commandAvailable('java')},
  gradle:{available:commandAvailable('gradle')},
  npm:{available:commandAvailable('npm')},
  apksigner:{available:Boolean(apksigner)}
};
const limitations=[];
if(!tools.androidSdk.available) limitations.push('Android SDK unavailable; Android builds and final generated-platform checks were skipped.');
if(!tools.apksigner.available) limitations.push('apksigner unavailable; APK signature verification was skipped.');

function config(engine){
  return {websiteUrl:'https://example.com',appName:`Jepong Branding Verify ${engine}`,packageName:`com.jepongdevxyz.brandingverify${engine}`,versionName:'1.0.0',versionCode:1,engine,renderMode:'default',orientation:'auto',permissions:[],controls:[],extensions:[],oneSignalAppId:'',offlineFallback:'Offline',iconDataUrl:'',splashDataUrl:'',splashEnabled:true,splashDuration:1500,apkSigner:false,sizeOptimization:engine==='gecko',abiTarget:engine==='gecko'?'arm64-v8a':'universal'};
}

function hash(file){ return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function verifyFiles(files){
  const mismatches=files.filter(([file,expectedHash])=>!fs.existsSync(file)||hash(file)!==expectedHash).map(([file])=>path.basename(file));
  return mismatches.length?{status:'failed',detail:`branding mismatch: ${mismatches.join(', ')}`}:{status:'verified'};
}
function finalFiles(project,engine){
  if(engine==='native'||engine==='gecko'){
    const app=path.join(project,'app','src','main');
    return [[path.join(app,'res','drawable-nodpi','app_icon.png'),expected.icon],[path.join(app,'assets','jepong_splash.img'),expected.splash]];
  }
  const app=engine==='capacitor'
    ? path.join(project,'android','app','src','main')
    : path.join(project,'platforms','android','app','src','main');
  return [[path.join(app,'res','drawable-nodpi','app_icon.png'),expected.icon],[path.join(app,'assets','jepong_splash.img'),expected.splash]];
}
function bootstrapFiles(project,engine){
  if(engine==='native'||engine==='gecko') return finalFiles(project,engine);
  const files=[[path.join(project,'branding','app_icon.png'),expected.icon],[path.join(project,'branding','app_splash.png'),expected.splash]];
  if(engine==='cordova') files.push([path.join(project,'res','icon.png'),expected.icon],[path.join(project,'res','screen','android','splash.png'),expected.splash]);
  return files;
}
function run(command,args,cwd){
  const result=spawnSync(command,args,{cwd,encoding:'utf8',env:{...process.env,ANDROID_HOME:androidSdk??'',ANDROID_SDK_ROOT:androidSdk??''}});
  return {ok:result.status===0,status:result.status??-1};
}
function findApks(root){
  const apks=[];
  const walk=dir=>{if(!fs.existsSync(dir)) return; for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const target=path.join(dir,entry.name); if(entry.isDirectory()) walk(target); else if(entry.name.endsWith('.apk')) apks.push(target);}};
  walk(root);
  return apks.sort();
}
function missingPrerequisites(engine){
  const names=['androidSdk','java'];
  if(engine==='native'||engine==='gecko'||engine==='cordova') names.push('gradle');
  if(engine==='capacitor'||engine==='cordova') names.push('npm');
  return names.filter(name=>!tools[name].available);
}
function build(result){
  const missing=missingPrerequisites(result.engine);
  if(missing.length){
    const detail=`${result.engine} build skipped: ${missing.join(', ')} unavailable.`;
    result.build={status:'skipped',detail};
    limitations.push(detail);
    return;
  }
  let command;
  if(result.engine==='native'||result.engine==='gecko') command=run('gradle',['--no-daemon',':app:assembleRelease','--stacktrace'],result.project);
  if(result.engine==='capacitor'){
    command=run('npm',['install','--no-audit','--no-fund'],result.project);
    if(command.ok) command=run('npx',['cap','add','android'],result.project);
    if(command.ok) command=run(process.execPath,['scripts/patch-android-platform.mjs','--build-id',result.buildId,'--engine','capacitor'],ROOT);
    if(command.ok) command=run(process.platform==='win32'?'gradlew.bat':'./gradlew',['--no-daemon','assembleRelease','--stacktrace'],path.join(result.project,'android'));
  }
  if(result.engine==='cordova'){
    command=run('npm',['install','--no-audit','--no-fund'],result.project);
    if(command.ok) command=run('npx',['cordova','platform','add','android@15.1.0'],result.project);
    if(command.ok) command=run('npx',['cordova','prepare','android'],result.project);
    if(command.ok) command=run(process.execPath,['scripts/patch-android-platform.mjs','--build-id',result.buildId,'--engine','cordova'],ROOT);
    if(command.ok) command=run('gradle',['--no-daemon','assembleRelease','--stacktrace'],path.join(result.project,'platforms','android'));
  }
  if(!command.ok){result.build={status:'failed',detail:`${result.engine} build command failed with exit status ${command.status}.`}; return;}
  result.build={status:'built'};
  result.branding.finalAndroid=verifyFiles(finalFiles(result.project,result.engine));
  const apkRoot=result.engine==='capacitor'?path.join(result.project,'android'):result.engine==='cordova'?path.join(result.project,'platforms','android'):result.project;
  result.apks=findApks(apkRoot).map(apk=>({path:apk,signature:tools.apksigner.available?(run(apksigner,['verify','--verbose','--print-certs',apk],ROOT).ok?'verified':'not-verified'):'skipped'}));
  if(!result.apks.length) limitations.push(`${result.engine} build completed without a discoverable APK.`);
  if(tools.apksigner.available&&result.apks.some(apk=>apk.signature==='not-verified')) limitations.push(`${result.engine} APK signature was not verified; the generated release APK may be unsigned.`);
}

const nonce=crypto.randomBytes(6).toString('hex');
const strictFailures=[];
const report={requested,tools,engines:[],limitations,strictFailures};
for(const engine of ENGINES){
  const buildId=`four-engine-branding-signing-${engine}-${nonce}`;
  const configPath=path.join(ROOT,'builds',`${buildId}.json`);
  const project=path.join(ROOT,'work',buildId,'project');
  const result={engine,buildId,config:configPath,project,generated:false,branding:{bootstrap:{status:'not-checked'},finalAndroid:{status:'not-generated'},compiledSplash:{status:'not-checked'}},build:{status:requested.build?'not-run':'not-requested'},apks:[]};
  report.engines.push(result);
  fs.mkdirSync(path.dirname(configPath),{recursive:true});
  fs.writeFileSync(configPath,`${JSON.stringify(config(engine),null,2)}\n`);
  const prepared=run(process.execPath,['scripts/build.mjs','prepare','--build-id',buildId],ROOT);
  const generated=prepared.ok&&run(process.execPath,['scripts/build.mjs','generate','--build-id',buildId],ROOT);
  if(!generated?.ok){result.branding.bootstrap={status:'failed',detail:`${engine} fresh generation failed.`}; continue;}
  result.generated=true;
  result.branding.bootstrap=verifyFiles(bootstrapFiles(project,engine));
  if(engine==='native'||engine==='gecko') result.branding.finalAndroid=verifyFiles(finalFiles(project,engine));
  result.branding.compiledSplash={
    status:'relocated-compile-safe',
    detail:'Selected splash bytes are verified from assets/jepong_splash.img; app_splash is intentionally not hash-verified as a compiled drawable.'
  };
  if(requested.build) build(result);
  else if(engine==='capacitor'||engine==='cordova') limitations.push(`${engine} final Android output not generated because --build was not requested.`);
}
if(!requested.keep) for(const result of report.engines){fs.rmSync(result.config,{force:true}); fs.rmSync(path.dirname(result.project),{recursive:true,force:true});}
if(requested.strictSigning){
  if(!requested.build) strictFailures.push('--strict-signing requires --build.');
  for(const result of report.engines){
    if(result.build.status==='skipped') strictFailures.push(`${result.engine} build was skipped: ${result.build.detail}`);
    if(result.build.status==='built'&&!result.apks.length) strictFailures.push(`${result.engine} build completed without a discoverable APK.`);
    if(result.apks.some(apk=>apk.signature!=='verified')) strictFailures.push(`${result.engine} APK signature verification did not pass.`);
  }
}
const serialized=`${JSON.stringify(report,null,2)}\n`;
if(output) fs.writeFileSync(path.resolve(ROOT,output),serialized); else process.stdout.write(serialized);
if(report.engines.some(result=>result.build.status==='failed'||result.branding.bootstrap.status==='failed'||result.branding.finalAndroid.status==='failed')||strictFailures.length) process.exitCode=1;
