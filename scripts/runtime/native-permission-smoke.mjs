import {spawnSync} from 'node:child_process';
import fs from 'node:fs';

const args=process.argv.slice(2);
const value=name=>{
  const i=args.indexOf(`--${name}`);
  return i>=0 ? args[i+1] : null;
};

const physicalCases=[
  ['camera','Open a page that calls getUserMedia({video:true}) and tap its “Request camera” control.','Android camera permission dialog appears; after Allow, getUserMedia returns a live video track and the app remains responsive.'],
  ['microphone','Open a page that calls getUserMedia({audio:true}) and tap its “Request microphone” control.','Android microphone permission dialog appears; after Allow, getUserMedia returns a live audio track and the app remains responsive.'],
  ['location','Open a page that calls navigator.geolocation.getCurrentPosition and tap “Request location”.','Android location permission dialog appears; after Allow, the page receives a real location result or a normal provider-unavailable error without an app crash.'],
  ['files','Open a page with <input type="file"> and tap the file input.','Android system file picker opens; choosing a file returns it to the page and the app remains responsive.'],
  ['notification','Not selectable on Native WebView until a website-facing Web Notifications implementation exists.','Capability remains Unsupported and cannot be selected.'],
  ['media','Not selectable on Native WebView until a secure website-facing media bridge exists.','Capability remains Unsupported and cannot be selected.'],
  ['contacts','Not selectable on Native WebView until a secure website-facing contacts bridge exists.','Capability remains Unsupported and cannot be selected.'],
  ['calendar','Not selectable on Native WebView until a secure website-facing calendar bridge exists.','Capability remains Unsupported and cannot be selected.'],
  ['biometrics','Not selectable on Native WebView until a secure website-facing biometric bridge exists.','Capability remains Unsupported and cannot be selected.'],
  ['bluetooth','Not selectable on Native WebView until a secure website-facing Bluetooth/Nearby bridge exists.','Capability remains Unsupported and cannot be selected.'],
  ['sensors','Not selectable on Native WebView until a secure website-facing sensor bridge exists.','Capability remains Unsupported and cannot be selected.']
];

function printCases(){
  for(const [id,action,pass] of physicalCases){
    console.log(`Native / ${id}`);
    console.log(`Action: ${action}`);
    console.log(`PASS: ${pass}`);
    console.log('');
  }
}

if(args.includes('--print-cases')){
  printCases();
  process.exit(0);
}

const apk=value('apk');
const pkg=value('package');
if(!apk || !pkg){
  console.error('Usage: node scripts/runtime/native-permission-smoke.mjs --apk <apk> --package <package>');
  console.error('Or:    node scripts/runtime/native-permission-smoke.mjs --print-cases');
  process.exit(2);
}
if(!fs.existsSync(apk)){
  console.error(`APK not found: ${apk}`);
  process.exit(2);
}

function adb(...cmd){
  const result=spawnSync('adb',cmd,{encoding:'utf8'});
  if(result.status!==0){
    throw new Error(`adb ${cmd.join(' ')} failed: ${(result.stderr||result.stdout||'').trim()}`);
  }
  return (result.stdout||'').trim();
}

const state=adb('get-state');
if(state!=='device') throw new Error(`ADB device/emulator not ready: ${state}`);

adb('install','-r',apk);
adb('shell','am','force-stop',pkg);
adb('shell','monkey','-p',pkg,'-c','android.intent.category.LAUNCHER','1');
spawnSync('sleep',['3']);

const activities=adb('shell','dumpsys','activity','activities');
if(!activities.includes(pkg)){
  throw new Error(`Native permission smoke failed: ${pkg} did not reach foreground/activity state`);
}

const crash=spawnSync(
  'adb',
  ['shell','logcat','-d','-t','200','AndroidRuntime:E','*:S'],
  {encoding:'utf8'}
);
const crashText=(crash.stdout||'');
if(crashText.includes(pkg) && /FATAL EXCEPTION|Process:/.test(crashText)){
  throw new Error(`Native permission smoke found an AndroidRuntime crash for ${pkg}`);
}

console.log('✓ native permission APK installed and launched without detected crash');
console.log('Physical-device cases still require explicit human PASS before promotion:');
printCases();
