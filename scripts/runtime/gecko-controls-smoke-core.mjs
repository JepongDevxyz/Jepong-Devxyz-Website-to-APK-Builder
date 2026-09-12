import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync=promisify(execFile);
const pkg='com.jepongdevxyz.geckocontrolsverify';
const activity=`${pkg}/.MainActivity`;
const requests=new Map();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const stage=name=>console.log(`[gecko-smoke] ${name}`);

async function run(...args){
  const timeout=
    args[0]==='install'
      ? 180000
      : args.includes('uiautomator')
        ? 15000
        : 45000;
  try{
    const {stdout=''}=await execFileAsync('adb',args,{
      encoding:'utf8',
      timeout,
      maxBuffer:24*1024*1024
    });
    return stdout;
  }catch(error){
    throw new Error(`ADB command failed or timed out: adb ${args.join(' ')} :: ${error?.message||error}`);
  }
}

if(process.argv.includes('--print-cases')){
  console.log([
    'Gecko controls emulator smoke:',
    '- deterministic local website loads through 10.0.2.2',
    '- Back/Forward/Home/Refresh/Share toolbar is visible',
    '- transparent status and navigation bars are asserted at runtime',
    '- Gecko navigation history is exercised',
    '- external user links route outside the app',
    '- file input launches Android DocumentsUI and returns cleanly',
    '- Android DownloadManager finishes SUCCESS to the exact Downloads path',
    '- downloaded bytes and exact file contents are verified',
    '- exit confirmation CANCEL and EXIT actions are both exercised',
    '- runtime is checked for app fatal exceptions'
  ].join('\n'));
  process.exit(0);
}

const apk=process.argv[2];
if(!apk){
  throw new Error('APK path required');
}

const stateScript=state=>
  `<script>addEventListener('pageshow',()=>fetch('/state/${state}?t='+Date.now(),{cache:'no-store'}).catch(()=>{}))</script>`;

const homePage=`<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;font-family:sans-serif;background:#fff}
.item{position:fixed;left:10vw;width:80vw;height:10vh;display:flex;align-items:center;justify-content:center;border:2px solid #222;font-size:22px;box-sizing:border-box;background:#f5f5f5;color:#111;text-decoration:none}
#next{top:12vh}#external{top:27vh}#fileLabel{top:42vh}#download{top:57vh}
#fileInput{position:absolute;inset:0;width:100%;height:100%;opacity:0}
</style>
</head>
<body>
<a class="item" id="next" href="/page2.html">NEXT_PAGE</a>
<a class="item" id="external" href="tel:12345">EXTERNAL_LINK</a>
<label class="item" id="fileLabel">FILE_PICKER<input id="fileInput" type="file"></label>
<a class="item" id="download" href="/download.txt">DOWNLOAD_FILE</a>
${stateScript('home')}
</body>
</html>`;

const page2=`<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body><h1>GECKO_PAGE_2</h1>${stateScript('page2')}</body></html>`;

const server=http.createServer((req,res)=>{
  const url=new URL(req.url||'/','http://task4.local');
  requests.set(url.pathname,(requests.get(url.pathname)||0)+1);

  if(url.pathname.startsWith('/state/')){
    res.writeHead(204,{'cache-control':'no-store'});
    res.end();
    return;
  }
  if(url.pathname==='/page2.html'){
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
    res.end(page2);
    return;
  }
  if(url.pathname==='/download.txt'){
    res.writeHead(200,{
      'content-type':'text/plain; charset=utf-8',
      'content-disposition':'attachment; filename="task4-download.txt"',
      'cache-control':'no-store'
    });
    res.end('task4-gecko-download');
    return;
  }
  res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
  res.end(homePage);
});

await new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(8765,'0.0.0.0',resolve);
});
stage('http-server-ready');

async function dumpUi(timeout=10000){
  const remote='/data/local/tmp/task4-gecko-window.xml';
  const started=Date.now();
  let lastError='no hierarchy returned';
  while(Date.now()-started<timeout){
    try{
      await run('shell','rm','-f',remote);
      await run('shell','uiautomator','dump',remote);
      const ui=await run('shell','cat',remote);
      if(ui.includes('<hierarchy')) return ui;
      lastError=`invalid UI dump: ${ui.slice(0,180)}`;
    }catch(error){
      lastError=error?.message||String(error);
    }
    await sleep(350);
  }
  throw new Error(`UI dump unavailable after retries: ${lastError}`);
}

async function waitForDesc(description,timeout=10000){
  const started=Date.now();
  let last='';
  while(Date.now()-started<timeout){
    try{
      const ui=await dumpUi(Math.min(3500,Math.max(1000,timeout-(Date.now()-started))));
      last=ui;
      if(ui.includes(`content-desc="${description}"`)) return ui;
    }catch(error){
      last=error?.message||String(error);
    }
    await sleep(300);
  }
  throw new Error(`UI content description did not appear: ${description}; last=${String(last).slice(0,280)}`);
}

async function waitForAnyText(values,timeout=7000){
  const started=Date.now();
  let last='';
  while(Date.now()-started<timeout){
    try{
      const ui=await dumpUi(Math.min(3000,Math.max(900,timeout-(Date.now()-started))));
      last=ui;
      for(const value of values){
        if(ui.includes(`text="${value}"`)||ui.includes(`content-desc="${value}"`)) return {ui,value};
      }
    }catch(error){
      last=error?.message||String(error);
    }
    await sleep(250);
  }
  throw new Error(`None of the expected UI texts appeared: ${values.join(', ')}; last=${String(last).slice(0,280)}`);
}

function boundsForAttribute(ui,attribute,value){
  const nodes=String(ui).match(/<node\b[^>]*>/g)||[];
  const needle=`${attribute}="${value}"`;
  for(const node of nodes){
    if(!node.includes(needle)) continue;
    const bounds=/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(node);
    if(bounds) return bounds.slice(1,5).map(Number);
  }
  throw new Error(`Could not locate ${attribute}=${value} in UI hierarchy`);
}

async function tapDesc(description){
  const ui=await waitForDesc(description);
  const [x1,y1,x2,y2]=boundsForAttribute(ui,'content-desc',description);
  await run('shell','input','tap',String(Math.round((x1+x2)/2)),String(Math.round((y1+y2)/2)));
  await sleep(700);
}

async function tapText(text){
  const {ui,value}=await waitForAnyText([text]);
  const attribute=ui.includes(`text="${value}"`)?'text':'content-desc';
  const [x1,y1,x2,y2]=boundsForAttribute(ui,attribute,value);
  await run('shell','input','tap',String(Math.round((x1+x2)/2)),String(Math.round((y1+y2)/2)));
  await sleep(500);
}

async function screenSize(){
  const output=await run('shell','wm','size');
  const match=/Physical size:\s*(\d+)x(\d+)/.exec(output)||/(\d+)x(\d+)/.exec(output);
  if(!match) throw new Error(`Could not determine emulator screen size: ${output}`);
  return {width:Number(match[1]),height:Number(match[2])};
}

async function tapWeb(percentY){
  const {width,height}=await screenSize();
  await run('shell','input','tap',String(Math.round(width*0.5)),String(Math.round(height*percentY)));
  await sleep(700);
}

async function waitForRequest(pathname,minCount,timeout=45000){
  const started=Date.now();
  while(Date.now()-started<timeout){
    if((requests.get(pathname)||0)>=minCount) return;
    await sleep(120);
  }
  throw new Error(`HTTP request did not occur: ${pathname} x${minCount}; observed=${requests.get(pathname)||0}`);
}

async function foregroundDump(){
  return run('shell','dumpsys','activity','activities');
}

function resumedActivityLine(dump){
  return String(dump||'').split('\n').find(line=>
    /ResumedActivity|topResumedActivity/i.test(line)&&/ActivityRecord/i.test(line)
  )||'';
}

async function waitForResumed(predicate,timeout=10000){
  const started=Date.now();
  let last='';
  while(Date.now()-started<timeout){
    const dump=await foregroundDump();
    last=resumedActivityLine(dump);
    if(predicate(last,dump)) return {line:last,dump};
    await sleep(250);
  }
  throw new Error(`Expected resumed activity did not appear; last=${last||'<none>'}`);
}

async function waitForPackageNotResumed(timeout=10000){
  const started=Date.now();
  let last='';
  while(Date.now()-started<timeout){
    const dump=await foregroundDump();
    last=resumedActivityLine(dump);
    if(!last.includes(`${pkg}/.MainActivity`)) return {line:last,dump};
    await sleep(250);
  }
  throw new Error(`Gecko app remained resumed after EXIT; last=${last||'<none>'}`);
}

async function assertTransparentSystemBars(){
  const dump=await run('shell','dumpsys','window','windows');
  const appIndex=dump.indexOf(pkg);
  if(appIndex<0){
    throw new Error('Gecko app window not found while checking transparent system bars');
  }
  const block=dump.slice(Math.max(0,appIndex-5000),Math.min(dump.length,appIndex+16000));
  const statusTransparent=/mStatusBarColor=(?:0x)?0+\b/i.test(block);
  const navTransparent=/mNavigationBarColor=(?:0x)?0+\b/i.test(block);
  if(!statusTransparent||!navTransparent){
    throw new Error(`Gecko transparent system bar assertion failed: status=${statusTransparent} navigation=${navTransparent}; window=${block.replace(/\s+/g,' ').slice(0,2400)}`);
  }
  console.log('[gecko-smoke] transparent-bars mStatusBarColor=0 mNavigationBarColor=0');
}

async function waitForSuccessfulDownload(timeout=30000){
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
      const actualBytes=Number.parseInt(String(sizeOutput).trim().split(/\s+/)[0],10);
      const downloadManagerSuccess=/DownloadManager[^\n]*Finished with status SUCCESS/i.test(logs);
      const exactPath=canonical===expectedCanonicalPath;
      const exactBody=actualBody===expectedBody;
      const exactBytes=actualBytes===expectedBytes;
      last=JSON.stringify({listing:listing.trim(),canonical,actualBytes,downloadManagerSuccess,exactPath,exactBody,exactBytes});
      if(downloadManagerSuccess&&exactPath&&exactBody&&exactBytes){
        return {path:canonical,bytes:actualBytes,body:actualBody,status:'SUCCESS'};
      }
    }catch(error){
      last=error?.message||String(error);
    }
    await sleep(300);
  }
  throw new Error(`Android DownloadManager/file verification failed for ${expectedPath}; last=${String(last).replace(/\s+/g,' ').slice(0,1800)}`);
}

async function diagnostics(label){
  console.log(`--- Gecko diagnostics: ${label} ---`);
  try{
    const focus=await run('shell','sh','-c',"dumpsys window | grep -E 'mCurrentFocus|mFocusedApp|topFocusedDisplayId|mStatusBarColor|mNavigationBarColor' | head -120");
    console.log(`[gecko-smoke] focus ${focus.replace(/\s+/g,' ').trim()}`);
  }catch(error){
    console.log(`[gecko-smoke] focus unavailable: ${error?.message||error}`);
  }
  try{
    const files=await run('shell','sh','-c',"ls -la /sdcard/Download 2>&1 || true; if [ -f /sdcard/Download/task4-download.txt ]; then echo '--- bytes ---'; wc -c /sdcard/Download/task4-download.txt; echo '--- body ---'; cat /sdcard/Download/task4-download.txt; fi");
    console.log(`[gecko-smoke] downloads ${files.replace(/\s+/g,' ').trim()}`);
  }catch(error){
    console.log(`[gecko-smoke] downloads unavailable: ${error?.message||error}`);
  }
  try{
    const ui=await dumpUi(3000);
    console.log(`[gecko-smoke] ui ${ui.slice(0,7000).replace(/\s+/g,' ')}`);
  }catch(error){
    console.log(`[gecko-smoke] ui unavailable: ${error?.message||error}`);
  }
  try{
    const logs=await run('logcat','-d','-t','1600');
    const relevant=logs.split('\n').filter(line=>
      /Gecko|AndroidRuntime|MainActivity|Jepong|DownloadManager|DownloadProvider|DocumentsUI|ActivityTaskManager/i.test(line)
    ).slice(-320).join('\n');
    console.log(`[gecko-smoke] logcat\n${relevant||'<no relevant log lines>'}`);
  }catch(error){
    console.log(`[gecko-smoke] logcat unavailable: ${error?.message||error}`);
  }
}

try{
  stage('install');
  await run('install','-r',apk);
  await run('logcat','-c');

  stage('launch');
  await run('shell','am','force-stop',pkg);
  await run('shell','am','start','-W','-n',activity);
  await waitForRequest('/index.html',1,60000);
  await waitForRequest('/state/home',1,60000);

  stage('toolbar-visible');
  let ui=await waitForDesc('Back',30000);
  for(const label of ['Back','Forward','Home','Refresh','Share']){
    if(!ui.includes(`content-desc="${label}"`)){
      throw new Error(`Gecko navigation toolbar missing at runtime: ${label}`);
    }
  }
  const foreground=await foregroundDump();
  if(!foreground.includes(pkg)) throw new Error('Gecko app did not reach foreground/activity stack');

  stage('transparent-system-bars');
  await assertTransparentSystemBars();

  stage('navigate-page2');
  const beforePage2=requests.get('/state/page2')||0;
  await tapWeb(0.17);
  await waitForRequest('/page2.html',1);
  await waitForRequest('/state/page2',beforePage2+1);

  stage('toolbar-back');
  const beforeBackHome=requests.get('/state/home')||0;
  await tapDesc('Back');
  await waitForRequest('/state/home',beforeBackHome+1);

  stage('toolbar-forward');
  const beforeForwardPage2=requests.get('/state/page2')||0;
  await tapDesc('Forward');
  await waitForRequest('/state/page2',beforeForwardPage2+1);

  stage('toolbar-home');
  const beforeHome=requests.get('/index.html')||0;
  await tapDesc('Home');
  await waitForRequest('/index.html',beforeHome+1);

  stage('toolbar-refresh');
  const beforeRefresh=requests.get('/index.html')||0;
  await tapDesc('Refresh');
  await waitForRequest('/index.html',beforeRefresh+1);

  stage('external-link');
  await tapWeb(0.32);
  const external=await waitForResumed(line=>Boolean(line)&&!line.includes(`${pkg}/.MainActivity`),10000);
  console.log(`[gecko-smoke] external-resumed ${external.line.trim()}`);

  stage('resume-after-external');
  await run('shell','am','start','-W','-n',activity);
  await waitForResumed(line=>line.includes(`${pkg}/.MainActivity`),10000);
  await waitForDesc('Back',10000);

  stage('file-picker');
  await tapWeb(0.47);
  const picker=await waitForResumed((line,dump)=>/documentsui/i.test(line)||/documentsui/i.test(dump),12000);
  console.log(`[gecko-smoke] file-picker-resumed ${picker.line.trim()||'<window stack evidence>'}`);

  stage('return-from-file-picker');
  await run('shell','input','keyevent','4');
  await waitForResumed(line=>line.includes(`${pkg}/.MainActivity`),10000);
  await waitForDesc('Back',10000);

  stage('download-manager');
  const beforeDownload=requests.get('/download.txt')||0;
  await tapWeb(0.62);
  await waitForRequest('/download.txt',beforeDownload+2,20000);
  const downloadProof=await waitForSuccessfulDownload(30000);
  console.log(`[gecko-smoke] download-proof ${JSON.stringify(downloadProof)}`);

  stage('reset-root-for-exit');
  const beforeRoot=requests.get('/index.html')||0;
  const beforeStateHome=requests.get('/state/home')||0;
  const clear=await run('shell','pm','clear',pkg);
  if(!clear.includes('Success')) throw new Error(`Unable to clear Gecko app state before exit test: ${clear}`);
  await run('shell','am','start','-W','-n',activity);
  await waitForRequest('/index.html',beforeRoot+1,60000);
  await waitForRequest('/state/home',beforeStateHome+1,60000);
  await waitForDesc('Back',20000);

  stage('exit-confirmation-cancel');
  await run('shell','input','keyevent','4');
  let cancel=await waitForAnyText(['CANCEL','Cancel'],10000);
  let exit=await waitForAnyText(['EXIT','Exit'],10000);
  let afterBack=await foregroundDump();
  if(!afterBack.includes(pkg)) throw new Error('Gecko home Back left the app before explicit exit confirmation');
  console.log(`[gecko-smoke] exit-dialog cancel=${cancel.value} exit=${exit.value}`);
  await tapText(cancel.value);
  await waitForResumed(line=>line.includes(`${pkg}/.MainActivity`),10000);

  stage('exit-confirmation-exit');
  await run('shell','input','keyevent','4');
  cancel=await waitForAnyText(['CANCEL','Cancel'],10000);
  exit=await waitForAnyText(['EXIT','Exit'],10000);
  afterBack=await foregroundDump();
  if(!afterBack.includes(pkg)) throw new Error('Gecko app left foreground before EXIT was pressed');
  await tapText(exit.value);
  const afterExit=await waitForPackageNotResumed(10000);
  console.log(`[gecko-smoke] exit-complete resumed=${afterExit.line.trim()||'<none>'}`);

  stage('crash-check');
  const logs=await run('logcat','-d','-t','2000');
  if(logs.includes('FATAL EXCEPTION')&&logs.includes(pkg)){
    throw new Error('Gecko app fatal exception detected during runtime smoke');
  }

  console.log('✓ Gecko strict deterministic navigation/system-bars/external/file/download/exit runtime smoke');
}catch(error){
  await diagnostics('failure');
  throw error;
}finally{
  stage('http-server-close-start');
  await new Promise(resolve=>server.close(resolve));
  stage('http-server-close-done');
}
