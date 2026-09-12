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
  try{
    const launchPid=(await adb('shell','pidof',pkg)).trim();
    console.log(\`[\${engine}-smoke] pid-after-launch \${launchPid||'<none>'}\`);
  }catch(error){
    console.log(\`[\${engine}-smoke] pid-after-launch <none>\`);
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
    let patched=source.replace(re,`${webviewVerifier}\n\nasync function assertNoFatalCrash`);
    const launchNeedle="  await adb('shell','am','start','-W','-n',activity);";
    if(!patched.includes(launchNeedle)){
      throw new Error('WebView launch diagnostics marker missing');
    }
    patched=patched.replace(launchNeedle,webviewLaunchDiagnostics);
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
