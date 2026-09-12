import http from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const execFileAsync=promisify(execFile);
const [apk,pkg,engine]=process.argv.slice(2);

if(!apk || !pkg || !['capacitor','cordova'].includes(engine)){
  throw new Error(
    'Usage: node scripts/runtime/webview-engine-controls-smoke.mjs APK PACKAGE capacitor|cordova'
  );
}

const activity=`${pkg}/.MainActivity`;
const downloadName=`task4-${engine}-download.txt`;
const downloadBody=`task4-${engine}-download`;
const requests=new Map();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const stage=name=>console.log(`[${engine}-smoke] ${name}`);

async function adb(...args){
  const timeout=
    args[0]==='install'
      ? 120000
      : args.includes('uiautomator')
        ? 15000
        : 30000;
  try{
    const {stdout=''}=await execFileAsync(
      'adb',
      args,
      {encoding:'utf8',timeout,maxBuffer:24*1024*1024}
    );
    return stdout;
  }catch(error){
    throw new Error(
      `ADB failed: adb ${args.join(' ')} :: ${error?.message||error}`
    );
  }
}

function stateScript(name){
  return `<script>addEventListener('pageshow',()=>fetch('/state/${name}?t='+Date.now()).catch(()=>{}))</script>`;
}

const homePage=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;font-family:sans-serif}
a{position:fixed;left:10vw;width:80vw;height:11vh;display:flex;align-items:center;justify-content:center;border:2px solid #222;font-size:22px;box-sizing:border-box}
#next{top:12vh}#external{top:31vh}#download{top:50vh}
</style></head><body>
<a id="next" href="/page2.html">NEXT_PAGE</a>
<a id="external" href="tel:12345">EXTERNAL_LINK</a>
<a id="download" href="/download.txt">DOWNLOAD_FILE</a>
${stateScript('home')}</body></html>`;

const page2=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><h1>Second page</h1>${stateScript('page2')}</body></html>`;

const server=http.createServer((req,res)=>{
  const url=new URL(req.url||'/', 'http://task4.local');
  requests.set(url.pathname,(requests.get(url.pathname)||0)+1);

  if(url.pathname.startsWith('/state/')){
    res.writeHead(204,{'cache-control':'no-store'});
    res.end();
    return;
  }

  if(url.pathname==='/page2.html'){
    res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});
    res.end(page2);
    return;
  }

  if(url.pathname==='/download.txt'){
    res.writeHead(200,{
      'content-type':'text/plain',
      'content-disposition':`attachment; filename="${downloadName}"`,
      'cache-control':'no-store'
    });
    res.end(downloadBody);
    return;
  }

  res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});
  res.end(homePage);
});

await new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(8765,'0.0.0.0',resolve);
});
stage('http-server-ready');

async function dumpUi(timeout=10000){
  const file=`/data/local/tmp/task4-${engine}-window.xml`;
  const started=Date.now();
  let last='';

  while(Date.now()-started<timeout){
    try{
      await adb('shell','rm','-f',file);
      await adb('shell','uiautomator','dump',file);
      const ui=await adb('shell','cat',file);
      if(ui.includes('<hierarchy')) return ui;
      last=ui;
    }catch(error){
      last=error?.message||String(error);
    }
    await sleep(300);
  }

  throw new Error(`UI hierarchy unavailable: ${String(last).slice(0,300)}`);
}

async function waitForText(text,timeout=15000){
  const started=Date.now();
  let last='';
  while(Date.now()-started<timeout){
    try{
      const ui=await dumpUi(Math.min(5000,Math.max(1000,timeout-(Date.now()-started))));
      last=ui;
      if(ui.includes(`text="${text}"`) || ui.includes(`content-desc="${text}"`)){
        return ui;
      }
    }catch(error){
      last=error?.message||String(error);
    }
    await sleep(300);
  }
  throw new Error(`UI text did not appear: ${text}; last=${String(last).slice(0,400)}`);
}

function boundsFor(ui,text){
  const escaped=text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const patterns=[
    new RegExp(`<node[^>]*text="${escaped}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"[^>]*/?>`),
    new RegExp(`<node[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"[^>]*text="${escaped}"[^>]*/?>`),
    new RegExp(`<node[^>]*content-desc="${escaped}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"[^>]*/?>`),
    new RegExp(`<node[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"[^>]*content-desc="${escaped}"[^>]*/?>`)
  ];
  for(const pattern of patterns){
    const match=pattern.exec(ui);
    if(match) return match.slice(1,5).map(Number);
  }
  throw new Error(`Could not locate UI bounds: ${text}`);
}

async function tapText(text){
  const ui=await waitForText(text);
  const [x1,y1,x2,y2]=boundsFor(ui,text);
  await adb(
    'shell','input','tap',
    String(Math.round((x1+x2)/2)),
    String(Math.round((y1+y2)/2))
  );
  await sleep(600);
}

async function screenSize(){
  const out=await adb('shell','wm','size');
  const match=/Physical size:\s*(\d+)x(\d+)/.exec(out)||/(\d+)x(\d+)/.exec(out);
  if(!match) throw new Error(`Could not determine screen size: ${out}`);
  return {width:Number(match[1]),height:Number(match[2])};
}

async function tapWeb(percentY){
  const {width,height}=await screenSize();
  await adb(
    'shell','input','tap',
    String(Math.round(width*0.5)),
    String(Math.round(height*percentY))
  );
  await sleep(700);
}

async function waitForRequest(pathname,minCount,timeout=30000){
  const started=Date.now();
  while(Date.now()-started<timeout){
    if((requests.get(pathname)||0)>=minCount) return;
    await sleep(150);
  }
  throw new Error(
    `HTTP request missing: ${pathname} x${minCount}; observed=${requests.get(pathname)||0}`
  );
}

async function activities(){
  return adb('shell','dumpsys','activity','activities');
}

function resumedLine(dump){
  return String(dump||'')
    .split('\n')
    .find(line=>/ResumedActivity|topResumedActivity/i.test(line)&&/ActivityRecord/i.test(line))||'';
}

async function waitForResumed(predicate,timeout=12000){
  const started=Date.now();
  let last='';
  while(Date.now()-started<timeout){
    const dump=await activities();
    last=resumedLine(dump);
    if(predicate(last,dump)) return last;
    await sleep(250);
  }
  throw new Error(`Expected resumed activity missing; last=${last||'<none>'}`);
}

async function grantSelectedPermissions(){
  for(const permission of [
    'android.permission.CAMERA',
    'android.permission.RECORD_AUDIO',
    'android.permission.ACCESS_COARSE_LOCATION',
    'android.permission.ACCESS_FINE_LOCATION'
  ]){
    try{
      await adb('shell','pm','grant',pkg,permission);
    }catch(error){
      console.log(`[${engine}-smoke] grant skipped ${permission}: ${error?.message||error}`);
    }
  }
}

async function assertTransparentBars(){
  const dump=await adb('shell','dumpsys','activity','top');
  const status=[...dump.matchAll(/mStatusBarColor=(0x[0-9a-fA-F]+|-?\d+)/g)].map(match=>match[1]);
  const nav=[...dump.matchAll(/mNavigationBarColor=(0x[0-9a-fA-F]+|-?\d+)/g)].map(match=>match[1]);
  const transparent=value=>/^(?:0|0x0+)$/.test(String(value));

  console.log(`[${engine}-smoke] system-bars status=${status.join(',')||'<missing>'} nav=${nav.join(',')||'<missing>'}`);

  if(status.length===0 || nav.length===0){
    console.log(`[${engine}-smoke] transparent-bars-unobservable: API35 Activity dump omitted color fields; capability remains unverified`);
    return false;
  }

  if(!status.some(transparent) || !nav.some(transparent)){
    throw new Error(
      `${engine} runtime Activity state exposed non-transparent system bars`
    );
  }

  console.log(`[${engine}-smoke] transparent-bars-observed`);
  return true;
}

async function waitForSuccessfulDownload(timeout=30000){
  const expectedUrl='http://10.0.2.2:8765/download.txt';
  const expectedBytes=Buffer.byteLength(downloadBody);
  const expectedUri=`file:///storage/emulated/0/Download/${downloadName}`;
  const started=Date.now();
  let last='';

  while(Date.now()-started<timeout){
    try{
      last=await adb(
        'shell','content','query',
        '--uri','content://downloads/my_downloads'
      );
      const row=String(last)
        .split('\n')
        .find(line=>line.includes(`uri=${expectedUrl}`));

      if(row){
        const completed=
          row.includes('status=200') &&
          row.includes(`title=${downloadName}`) &&
          row.includes(`total_bytes=${expectedBytes}`) &&
          row.includes(`bytes_so_far=${expectedBytes}`) &&
          (
            row.includes(`local_uri=${expectedUri}`) ||
            row.includes(`hint=${expectedUri}`)
          );

        if(completed) return row;
      }
    }catch(error){
      last=error?.message||String(error);
    }
    await sleep(300);
  }

  throw new Error(
    `${engine} DownloadManager did not report successful completion for ${downloadName}; last=${String(last).replace(/\s+/g,' ').slice(0,1600)}`
  );
}

async function assertNoFatalCrash(){
  const logs=await adb('logcat','-d','-t','1200');
  const fatal=logs
    .split('\n')
    .filter(line=>/FATAL EXCEPTION|AndroidRuntime/i.test(line))
    .join('\n');

  if(fatal.includes(pkg)){
    throw new Error(`${engine} fatal runtime crash detected:\n${fatal.slice(-5000)}`);
  }
}

async function diagnostics(label){
  console.log(`--- ${engine} diagnostics: ${label} ---`);

  try{
    const focus=await adb(
      'shell','sh','-c',
      "dumpsys window | grep -E 'mCurrentFocus|mFocusedApp|topFocusedDisplayId' | head -40"
    );
    console.log(`[${engine}-smoke] focus ${focus.replace(/\s+/g,' ').trim()}`);
  }catch(error){
    console.log(`[${engine}-smoke] focus unavailable: ${error?.message||error}`);
  }

  try{
    const dump=await activities();
    console.log(`[${engine}-smoke] resumed ${resumedLine(dump).trim()||'<none>'}`);
  }catch(error){
    console.log(`[${engine}-smoke] activities unavailable: ${error?.message||error}`);
  }

  try{
    const ui=await dumpUi(3000);
    console.log(`[${engine}-smoke] ui ${ui.slice(0,7000).replace(/\s+/g,' ')}`);
  }catch(error){
    console.log(`[${engine}-smoke] ui unavailable: ${error?.message||error}`);
  }

  try{
    const logs=await adb('logcat','-d','-t','1600');
    const relevant=logs
      .split('\n')
      .filter(line=>
        /AndroidRuntime|ActivityTaskManager|Cordova|Capacitor|chromium|WebView|MainActivity|DownloadManager|Jepong/i.test(line)
      )
      .slice(-320)
      .join('\n');
    console.log(`[${engine}-smoke] logcat\n${relevant||'<no relevant log lines>'}`);
  }catch(error){
    console.log(`[${engine}-smoke] logcat unavailable: ${error?.message||error}`);
  }
}

try{
  stage('install');
  await adb('install','-r',apk);
  await grantSelectedPermissions();
  await adb('logcat','-c');

  stage('launch');
  await adb('shell','am','force-stop',pkg);
  await adb('shell','am','start','-W','-n',activity);
  await waitForRequest('/index.html',1,60000);
  await waitForRequest('/state/home',1,60000);

  stage('toolbar-visible');
  let ui=await waitForText('Back',20000);
  for(const label of ['Back','Next','Home','Reload','Share']){
    if(!ui.includes(`text="${label}"`) && !ui.includes(`content-desc="${label}"`)){
      throw new Error(`${engine} navigation toolbar missing: ${label}`);
    }
  }

  stage('transparent-bars');
  await assertTransparentBars();

  stage('navigate-page2');
  const beforePage2=requests.get('/state/page2')||0;
  await tapWeb(0.17);
  await waitForRequest('/page2.html',1);
  await waitForRequest('/state/page2',beforePage2+1);

  stage('toolbar-back');
  const beforeBack=requests.get('/state/home')||0;
  await tapText('Back');
  await waitForRequest('/state/home',beforeBack+1);

  stage('toolbar-next');
  const beforeNext=requests.get('/state/page2')||0;
  await tapText('Next');
  await waitForRequest('/state/page2',beforeNext+1);

  stage('toolbar-home');
  const beforeHome=requests.get('/index.html')||0;
  await tapText('Home');
  await waitForRequest('/index.html',beforeHome+1);

  stage('toolbar-reload');
  const beforeReload=requests.get('/index.html')||0;
  await tapText('Reload');
  await waitForRequest('/index.html',beforeReload+1);

  stage('external-link');
  await tapWeb(0.36);
  const external=await waitForResumed(
    line=>Boolean(line)&&!line.includes(`${pkg}/.MainActivity`)
  );
  console.log(`[${engine}-smoke] external-resumed ${external.trim()}`);

  stage('resume-after-external');
  await adb('shell','am','start','-W','-n',activity);
  await waitForResumed(line=>line.includes(`${pkg}/.MainActivity`));
  await waitForText('Back',10000);

  stage('download-manager');
  const beforeDownload=requests.get('/download.txt')||0;
  await tapWeb(0.55);
  await waitForRequest('/download.txt',beforeDownload+1,20000);
  const downloadRow=await waitForSuccessfulDownload(30000);
  console.log(`[${engine}-smoke] download-provider-success ${downloadRow.replace(/\s+/g,' ').trim()}`);

  stage('reset-root-for-exit');
  const beforeRoot=requests.get('/index.html')||0;
  const beforeState=requests.get('/state/home')||0;
  const cleared=await adb('shell','pm','clear',pkg);
  if(!cleared.includes('Success')){
    throw new Error(`${engine} pm clear failed: ${cleared}`);
  }
  await grantSelectedPermissions();
  await adb('shell','am','start','-W','-n',activity);
  await waitForRequest('/index.html',beforeRoot+1,60000);
  await waitForRequest('/state/home',beforeState+1,60000);
  await waitForText('Back',15000);

  stage('exit-confirmation-cancel');
  await adb('shell','input','keyevent','4');
  let confirm=await waitForText('CANCEL',8000);
  if(!confirm.includes('text="EXIT"')){
    throw new Error(`${engine} exit confirmation is missing EXIT action`);
  }
  await tapText('CANCEL');
  await waitForResumed(line=>line.includes(`${pkg}/.MainActivity`));

  stage('exit-confirmation-exit');
  await adb('shell','input','keyevent','4');
  await waitForText('EXIT',8000);
  await tapText('EXIT');
  await sleep(700);
  const afterExit=resumedLine(await activities());
  if(afterExit.includes(`${pkg}/.MainActivity`)){
    throw new Error(`${engine} EXIT left MainActivity resumed`);
  }

  await assertNoFatalCrash();
  console.log(`✓ ${engine} API35 controls runtime smoke`);
}catch(error){
  await diagnostics('failure');
  throw error;
}finally{
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise(resolve=>server.close(resolve));
}
