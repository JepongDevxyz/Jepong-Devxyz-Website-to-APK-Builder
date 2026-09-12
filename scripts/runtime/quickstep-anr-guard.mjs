import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync=promisify(execFile);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function adb(...args){
  try{
    const {stdout=''}=await execFileAsync(
      'adb',
      args,
      {encoding:'utf8',timeout:8000}
    );
    return stdout;
  }catch(error){
    return `guard-adb-error:${error?.message||error}`;
  }
}

const deadline=Date.now()+35000;

while(Date.now()<deadline){
  const windows=await adb(
    'shell',
    'dumpsys',
    'window',
    'windows'
  );

  const launcherAnr=
    /Application Not Responding:\s*com\.android\.launcher3/i.test(windows) ||
    /Quickstep isn't responding/i.test(windows);

  if(launcherAnr){
    console.log('[anr-guard] Quickstep/launcher ANR detected; force-stopping launcher overlay');
    await adb(
      'shell',
      'am',
      'force-stop',
      'com.android.launcher3'
    );
    await sleep(1200);
    console.log('[anr-guard] launcher ANR blocker dismissed');
    process.exit(0);
  }

  await sleep(700);
}

console.log('[anr-guard] no Quickstep/launcher ANR detected during guard window');
