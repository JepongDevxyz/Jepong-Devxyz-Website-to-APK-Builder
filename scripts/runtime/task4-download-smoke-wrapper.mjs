import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const geckoVerifier=`async function waitForSuccessfulDownload(timeout=60000){
  const expectedUrl='http://10.0.2.2:8765/download.txt';
  const expectedBody='task4-gecko-download';
  const started=Date.now();
  let last='';

  while(Date.now()-started<timeout){
    try{
      last=await run(
        'shell','content','query',
        '--uri','content://downloads/my_downloads'
      );
      const row=String(last)
        .split('\\n')
        .find(line=>line.includes(\`uri=\${expectedUrl}\`));

      if(row){
        const local=/local_filename=([^,\\r\\n]+)/.exec(row);
        const hint=/hint=file:\\/\\/([^,\\r\\n]+)/.exec(row);
        const localPath=(local?.[1]||hint?.[1]||'').trim();

        if(localPath){
          try{
            const body=await run('shell','cat',localPath);
            if(body===expectedBody){
              return row;
            }
          }catch(error){
            last=\`\${row} :: \${error?.message||error}\`;
          }
        }
      }
    }catch(error){
      last=error?.message||String(error);
    }
    await sleep(350);
  }

  throw new Error(
    \`Android DownloadManager did not produce the expected downloaded bytes; last=\${String(last).replace(/\\s+/g,' ').slice(0,1800)}\`
  );
}`;

const webviewVerifier=`async function waitForSuccessfulDownload(timeout=60000){
  const expectedUrl='http://10.0.2.2:8765/download.txt';
  const expectedBody=downloadBody;
  const started=Date.now();
  let last='';

  while(Date.now()-started<timeout){
    try{
      last=await adb(
        'shell','content','query',
        '--uri','content://downloads/my_downloads'
      );
      const row=String(last)
        .split('\\n')
        .find(line=>line.includes(\`uri=\${expectedUrl}\`));

      if(row){
        const local=/local_filename=([^,\\r\\n]+)/.exec(row);
        const hint=/hint=file:\\/\\/([^,\\r\\n]+)/.exec(row);
        const localPath=(local?.[1]||hint?.[1]||'').trim();

        if(localPath){
          try{
            const body=await adb('shell','cat',localPath);
            if(body===expectedBody){
              return row;
            }
          }catch(error){
            last=\`\${row} :: \${error?.message||error}\`;
          }
        }
      }
    }catch(error){
      last=error?.message||String(error);
    }
    await sleep(350);
  }

  throw new Error(
    \`\${engine} DownloadManager did not produce the expected downloaded bytes; last=\${String(last).replace(/\\s+/g,' ').slice(0,1800)}\`
  );
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
    return source.replace(re,`${webviewVerifier}\n\nasync function assertNoFatalCrash`);
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
