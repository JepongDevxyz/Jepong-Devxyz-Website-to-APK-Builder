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
  console.log('--- JepongBack trace ---');
  try{
    const {stdout=''}=await execFileAsync(
      'adb',
      ['logcat','-d','-t','1200'],
      {encoding:'utf8',timeout:15000,maxBuffer:16*1024*1024}
    );

    const trace=stdout
      .split('\n')
      .filter(line=>/JepongBack|OnBackInvoked|BackNavigation/i.test(line))
      .join('\n');

    console.log(trace || '<no Back-dispatch trace lines>');
  }catch(error){
    console.log(`<unable to read Back-dispatch trace: ${error?.message||error}>`);
  }

  process.exitCode=Number.isInteger(result.code) ? result.code : 1;
}else{
  console.log('✓ Native CI smoke wrapper completed');
}
