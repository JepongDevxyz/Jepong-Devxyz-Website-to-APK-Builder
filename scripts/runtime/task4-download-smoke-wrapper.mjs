import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const geckoVerifier=`async function waitForSuccessfulDownload(timeout=60000){
  const expectedBody='task4-gecko-download';
  const expectedPath='/sdcard/Download/task4-download.txt';
  const expectedCanonicalPath='/storage/emulated/0/Download/task4-download.txt';
  const expectedBytes=Buffer.byteLength(expectedBody);
  const started=Date.now();
  let last='';

  while(Date.now()-started<timeout){
    try{
      const listing=await run('shell','ls','-l',expectedPath);
      const sizeOutput=await run('shell','wc','-c',expectedPath);
      const actualBody=await run('shell','cat',expectedPath);
      const canonical=(await run('shell','readlink','-f',expectedPath)).trim();
      const logs=await run('logcat','-d');
      const actualBytes=Number.parseInt(String(sizeOutput).trim().split(/\\s+/)[0],10);
      const downloadManagerSuccess=/DownloadManager[^\\n]*Finished with status SUCCESS/i.test(logs);
      const exactPath=canonical===expectedCanonicalPath;
      const exactBody=actualBody===expectedBody;
      const exactBytes=actualBytes===expectedBytes;

      last=JSON.stringify({
        listing:listing.trim(),
        canonical,
        actualBytes,
        downloadManagerSuccess,
        exactPath,
        exactBody,
        exactBytes
      });

      if(downloadManagerSuccess&&exactPath&&exactBody&&exactBytes){
        return JSON.stringify({
          path:canonical,
          bytes:actualBytes,
          body:actualBody,
          status:'SUCCESS'
        });
      }
    }catch(error){
      last=error?.message||String(error);
    }
    await sleep(350);
  }

  throw new Error(
    \`Android DownloadManager exact file verification failed for \${expectedPath}; last=\${String(last).replace(/\\s+/g,' ').slice(0,1800)}\`
  );
}`;

const webviewVerifier=`async function waitForSuccessfulDownload(timeout=60000){
  const expectedBody=downloadBody;
  const expectedPath=\`/sdcard/Download/task4-\${engine}-download.txt\`;
  const expectedCanonicalPath=\`/storage/emulated/0/Download/task4-\${engine}-download.txt\`;
  const expectedBytes=Buffer.byteLength(expectedBody);
  const started=Date.now();
  let last='';

  while(Date.now()-started<timeout){
    try{
      const listing=await adb('shell','ls','-l',expectedPath);
      const sizeOutput=await adb('shell','wc','-c',expectedPath);
      const actualBody=await adb('shell','cat',expectedPath);
      const canonical=(await adb('shell','readlink','-f',expectedPath)).trim();
      const logs=await adb('logcat','-d');
      const actualBytes=Number.parseInt(String(sizeOutput).trim().split(/\\s+/)[0],10);
      const downloadManagerSuccess=/DownloadManager[^\\n]*Finished with status SUCCESS/i.test(logs);
      const exactPath=canonical===expectedCanonicalPath;
      const exactBody=actualBody===expectedBody;
      const exactBytes=actualBytes===expectedBytes;

      last=JSON.stringify({
        listing:listing.trim(),
        canonical,
        actualBytes,
        downloadManagerSuccess,
        exactPath,
        exactBody,
        exactBytes
      });

      if(downloadManagerSuccess&&exactPath&&exactBody&&exactBytes){
        return JSON.stringify({
          path:canonical,
          bytes:actualBytes,
          body:actualBody,
          status:'SUCCESS'
        });
      }
    }catch(error){
      last=error?.message||String(error);
    }
    await sleep(350);
  }

  throw new Error(
    \`\${engine} DownloadManager exact file verification failed for \${expectedPath}; last=\${String(last).replace(/\\s+/g,' ').slice(0,1800)}\`
  );
}`;

const webviewStartupWatcher=`async function startupLifecycleLogcat(label){
  try{
    const logs=await adb('logcat','-d','-t','5000');
    const relevant=String(logs)
      .split('\\n')
      .filter(line=>
        line.includes(pkg) ||
        /JepongCordovaStartup|AndroidRuntime|FATAL EXCEPTION|ActivityTaskManager|ActivityManager|Cordova|MainActivity|InflateException|IllegalStateException|NullPointerException|ClassNotFoundException|NoClassDefFoundError|VerifyError|SecurityException|Process .* has died/i.test(line)
      )
      .slice(-900)
      .join('\\n');
    console.log(\`[\${engine}-smoke] startup-lifecycle-logcat \${label}\\n\${relevant||'<no relevant startup logs>'}\`);
  }catch(error){
    console.log(\`[\${engine}-smoke] startup-lifecycle-logcat unavailable: \${error?.message||error}\`);
  }
}

async function waitForInitialRequest(pathname,minCount=1,timeout=60000){
  const started=Date.now();
  let missingChecks=0;

  while(Date.now()-started<timeout){
    const seen=requests.get(pathname)||0;
    if(seen>=minCount) return seen;

    let pid='';
    try{
      pid=(await adb('shell','pidof',pkg)).trim();
    }catch{}

    if(pid){
      missingChecks=0;
    }else{
      missingChecks++;
      if(missingChecks>=2){
        await startupLifecycleLogcat(\`process-exit pathname=\${pathname}\`);
        throw new Error(\`\${engine} process exited before initial request \${pathname}; observed=\${seen}\`);
      }
    }

    await sleep(250);
  }

  await startupLifecycleLogcat(\`timeout pathname=\${pathname}\`);
  throw new Error(
    \`\${engine} timed out waiting for initial request \${pathname}; observed=\${requests.get(pathname)||0}\`
  );
}`;

const webviewLaunchDiagnostics=`  const launchResult=await adb('shell','am','start','-W','-n',activity);
  console.log(\`[\${engine}-smoke] am-start \${String(launchResult).replace(/\\s+/g,' ').trim()}\`);
  try{
    const resolved=await adb(
      'shell','cmd','package','resolve-activity','--brief',
      '-a','android.intent.action.MAIN',
      '-c','android.intent.category.LAUNCHER',
      pkg
    );
    console.log(\`[\${engine}-smoke] resolved-launcher \${String(resolved).replace(/\\s+/g,' ').trim()}\`);
  }catch(error){
    console.log(\`[\${engine}-smoke] resolved-launcher unavailable: \${error?.message||error}\`);
  }

  let launchPid='';
  for(let attempt=0;attempt<8;attempt++){
    try{
      launchPid=(await adb('shell','pidof',pkg)).trim();
    }catch{}
    if(launchPid) break;
    await sleep(400);
  }
  console.log(\`[\${engine}-smoke] pid-after-launch \${launchPid||'<none>'}\`);

  if(!launchPid){
    try{
      const earlyLogs=await adb('logcat','-d','-t','5000');
      const relevantEarly=String(earlyLogs)
        .split('\\n')
        .filter(line=>
          line.includes(pkg) ||
          /AndroidRuntime|ActivityTaskManager|ActivityManager|JepongCordovaStartup|Cordova|InflateException|Resources\\$NotFoundException|ClassNotFoundException|NoClassDefFoundError|VerifyError|SecurityException|Process .* has died/i.test(line)
        )
        .slice(-700)
        .join('\\n');
      console.log(\`[\${engine}-smoke] launch-failure-logcat\\n\${relevantEarly||'<no relevant launch logs>'}\`);
    }catch(error){
      console.log(\`[\${engine}-smoke] launch-failure-logcat unavailable: \${error?.message||error}\`);
    }

    try{
      const immediateActivities=await adb('shell','dumpsys','activity','activities');
      const relevantActivities=String(immediateActivities)
        .split('\\n')
        .filter(line=>line.includes(pkg)||/ResumedActivity|topResumedActivity|mFocusedApp/i.test(line))
        .slice(-120)
        .join(' ');
      console.log(\`[\${engine}-smoke] launch-failure-activities \${relevantActivities.replace(/\\s+/g,' ').trim()||'<none>'}\`);
    }catch(error){
      console.log(\`[\${engine}-smoke] launch-failure-activities unavailable: \${error?.message||error}\`);
    }

    throw new Error(\`\${engine} No app process after launch\`);
  }`;

function patchVerifier(source,kind){
  if(kind==='gecko'){
    const re=/async function waitForSuccessfulDownload\([^)]*\)\{[\s\S]*?\n\}\n\nasync function diagnostics/;
    if(!re.test(source)) throw new Error('Gecko download verifier marker missing');
    return source.replace(re,`${geckoVerifier}\n\nasync function diagnostics`);
  }

  if(kind==='webview'){
    const re=/async function waitForSuccessfulDownload\([^)]*\)\{[\s\S]*?\n\}\n\nasync function assertNoFatalCrash/;
    if(!re.test(source)) throw new Error('WebView download verifier marker missing');
    let patched=source.replace(re,`${webviewVerifier}\n\n${webviewStartupWatcher}\n\nasync function assertNoFatalCrash`);
    const launchNeedle="  await adb('shell','am','start','-W','-n',activity);";
    if(!patched.includes(launchNeedle)){
      throw new Error('WebView launch diagnostics marker missing');
    }
    patched=patched.replace(launchNeedle,webviewLaunchDiagnostics);

    const initialWaitNeedle="  await waitForRequest('/index.html',1,60000);\n  await waitForRequest('/state/home',1,60000);";
    if(!patched.includes(initialWaitNeedle)){
      throw new Error('WebView initial request wait marker missing');
    }
    patched=patched.replace(
      initialWaitNeedle,
      "  await waitForInitialRequest('/index.html',1,60000);\n  await waitForInitialRequest('/state/home',1,60000);"
    );
    return patched;
  }

  throw new Error(`Unknown smoke kind: ${kind}`);
}

export function runPatchedSmoke(kind,coreUrl){
  const source=fs.readFileSync(coreUrl,'utf8');
  const patched=patchVerifier(source,kind);
  const target=new URL(`./.task4-${kind}-smoke-${process.pid}.mjs`,import.meta.url);
  fs.writeFileSync(target,patched);

  try{
    const result=spawnSync(
      process.execPath,
      [fileURLToPath(target),...process.argv.slice(2)],
      {stdio:'inherit'}
    );
    if(result.error) throw result.error;
    process.exitCode=result.status??1;
  }finally{
    fs.rmSync(target,{force:true});
  }
}
