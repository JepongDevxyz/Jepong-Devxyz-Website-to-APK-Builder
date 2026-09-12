import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync=promisify(execFile);
const apk=process.argv[2];

if(!apk){
  throw new Error('APK path required');
}

function runNode(script,args=[]){
  return new Promise((resolve,reject)=>{
    const child=execFile(
      process.execPath,
      [script,...args],
      {encoding:'utf8',maxBuffer:16*1024*1024},
      (error,stdout='',stderr='')=>{
        if(stdout) process.stdout.write(stdout);
        if(stderr) process.stderr.write(stderr);
        if(error){
          resolve({ok:false,code:error.code??1,error});
          return;
        }
        resolve({ok:true,code:0,error:null});
      }
    );
    child.once('error',reject);
  });
}

async function adb(args,timeout=15000){
  const {stdout=''}=await execFileAsync(
    'adb',
    args,
    {encoding:'utf8',timeout,maxBuffer:16*1024*1024}
  );
  return stdout;
}

async function dumpFailureDiagnostics(){
  console.log('--- Native exit-window diagnostics ---');

  try{
    const focus=await adb([
      'shell','sh','-c',
      "dumpsys window | grep -E 'mCurrentFocus|mFocusedApp|topFocusedDisplayId' | head -40"
    ]);
    console.log(`[exit-window] focus\n${focus.trim()||'<none>'}`);
  }catch(error){
    console.log(`[exit-window] focus unavailable: ${error?.message||error}`);
  }

  try{
    const windows=await adb([
      'shell','sh','-c',
      "dumpsys window windows | grep -E -B3 -A18 'com\\.jepongdevxyz\\.nativecontrolsverify|Window #|mCurrentFocus' | tail -220"
    ]);
    console.log(`[exit-window] windows\n${windows.trim()||'<none>'}`);
  }catch(error){
    console.log(`[exit-window] windows unavailable: ${error?.message||error}`);
  }

  try{
    await adb([
      'shell','uiautomator','dump','/data/local/tmp/task3-post-failure.xml'
    ],10000);
    const ui=await adb([
      'shell','cat','/data/local/tmp/task3-post-failure.xml'
    ]);
    console.log(`[exit-window] ui\n${ui.slice(0,12000)}`);
  }catch(error){
    console.log(`[exit-window] UI hierarchy unavailable: ${error?.message||error}`);
  }

  console.log('--- JepongBack trace ---');
  try{
    const stdout=await adb(['logcat','-d','-t','1200']);

    const trace=stdout
      .split('\n')
      .filter(line=>/JepongBack|OnBackInvoked|BackNavigation|CoreBackPreview/i.test(line))
      .join('\n');

    console.log(trace || '<no Back-dispatch trace lines>');
  }catch(error){
    console.log(`<unable to read Back-dispatch trace: ${error?.message||error}>`);
  }
}

const guard=execFile(
  process.execPath,
  ['scripts/runtime/quickstep-anr-guard.mjs'],
  {encoding:'utf8',maxBuffer:4*1024*1024},
  (error,stdout='',stderr='')=>{
    if(stdout) process.stdout.write(stdout);
    if(stderr) process.stderr.write(stderr);
    if(error && error.signal!=='SIGTERM'){
      console.error(`[ci-smoke] ANR guard exited: ${error.message}`);
    }
  }
);

guard.once('error',error=>{
  console.error(`[ci-smoke] ANR guard failed to start: ${error.message}`);
});

let result;
try{
  result=await runNode(
    'scripts/runtime/native-controls-smoke.mjs',
    [apk]
  );
}finally{
  if(!guard.killed){
    guard.kill('SIGTERM');
  }
}

if(!result.ok){
  await dumpFailureDiagnostics();
  process.exitCode=Number.isInteger(result.code) ? result.code : 1;
}else{
  console.log('✓ Native CI smoke wrapper completed');
}
