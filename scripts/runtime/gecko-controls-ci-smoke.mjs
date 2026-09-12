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
      {
        encoding:'utf8',
        maxBuffer:24*1024*1024
      },
      (error,stdout='',stderr='')=>{
        if(stdout){
          process.stdout.write(stdout);
        }
        if(stderr){
          process.stderr.write(stderr);
        }
        if(error){
          resolve({
            ok:false,
            code:error.code??1,
            error
          });
          return;
        }
        resolve({
          ok:true,
          code:0,
          error:null
        });
      }
    );

    child.once('error',reject);
  });
}

async function adb(args,timeout=20000){
  const {stdout=''}=await execFileAsync(
    'adb',
    args,
    {
      encoding:'utf8',
      timeout,
      maxBuffer:24*1024*1024
    }
  );
  return stdout;
}

async function dumpFailureDiagnostics(){
  console.log('--- Gecko runtime diagnostics ---');

  try{
    const focus=await adb([
      'shell','sh','-c',
      "dumpsys window | grep -E 'mCurrentFocus|mFocusedApp|topFocusedDisplayId' | head -40"
    ]);
    console.log(
      `[gecko-ci] focus\n${focus.trim()||'<none>'}`
    );
  }catch(error){
    console.log(
      `[gecko-ci] focus unavailable: ${error?.message||error}`
    );
  }

  try{
    const activities=await adb([
      'shell','sh','-c',
      "dumpsys activity activities | grep -E -B4 -A12 'ResumedActivity|topResumedActivity|com\\.jepongdevxyz\\.geckocontrolsverify|DocumentsUI' | tail -240"
    ]);
    console.log(
      `[gecko-ci] activities\n${activities.trim()||'<none>'}`
    );
  }catch(error){
    console.log(
      `[gecko-ci] activities unavailable: ${error?.message||error}`
    );
  }

  try{
    await adb([
      'shell','uiautomator','dump',
      '/data/local/tmp/task4-gecko-post-failure.xml'
    ],15000);
    const ui=await adb([
      'shell','cat',
      '/data/local/tmp/task4-gecko-post-failure.xml'
    ]);
    console.log(
      `[gecko-ci] ui\n${ui.slice(0,14000)}`
    );
  }catch(error){
    console.log(
      `[gecko-ci] UI hierarchy unavailable: ${error?.message||error}`
    );
  }

  try{
    const logs=await adb([
      'logcat','-d','-t','1800'
    ]);
    const relevant=logs
      .split('\n')
      .filter(
        line=>
          /Gecko|AndroidRuntime|MainActivity|Jepong|DownloadManager|DocumentsUI|ActivityTaskManager|WindowManager/i.test(line)
      )
      .slice(-450)
      .join('\n');
    console.log(
      `[gecko-ci] logcat\n${relevant||'<no relevant log lines>'}`
    );
  }catch(error){
    console.log(
      `[gecko-ci] logcat unavailable: ${error?.message||error}`
    );
  }
}

const guard=execFile(
  process.execPath,
  ['scripts/runtime/quickstep-anr-guard.mjs'],
  {
    encoding:'utf8',
    maxBuffer:4*1024*1024
  },
  (error,stdout='',stderr='')=>{
    if(stdout){
      process.stdout.write(stdout);
    }
    if(stderr){
      process.stderr.write(stderr);
    }
    if(
      error &&
      error.signal!=='SIGTERM'
    ){
      console.error(
        `[gecko-ci] ANR guard exited: ${error.message}`
      );
    }
  }
);

guard.once('error',error=>{
  console.error(
    `[gecko-ci] ANR guard failed to start: ${error.message}`
  );
});

let result;

try{
  result=await runNode(
    'scripts/runtime/gecko-controls-smoke.mjs',
    [apk]
  );
}finally{
  if(!guard.killed){
    guard.kill('SIGTERM');
  }
}

if(!result.ok){
  await dumpFailureDiagnostics();
  process.exitCode=
    Number.isInteger(result.code)
      ? result.code
      : 1;
}else{
  console.log(
    '✓ Gecko CI smoke wrapper completed'
  );
}
