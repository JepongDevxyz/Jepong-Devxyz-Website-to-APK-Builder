import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync=promisify(execFile);
const pkg='com.jepongdevxyz.nativecontrolsverify';
const activity=`${pkg}/.MainActivity`;
const requests=new Map();

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const stage=name=>console.log(`[smoke] ${name}`);
const run=async(...args)=>{
  const timeout=args[0]==='install' ? 60000 : args.includes('uiautomator') ? 10000 : 30000;
  try{
    const { stdout='' }=await execFileAsync('adb',args,{encoding:'utf8',timeout});
    return stdout;
  }catch(error){
    throw new Error(`ADB command failed or timed out: adb ${args.join(' ')} :: ${error?.message||error}`);
  }
};

if(process.argv.includes('--print-cases')){
  console.log(`Native controls emulator smoke:\n- deterministic local test page loads through 10.0.2.2\n- navigation toolbar is visible\n- page link plus native Back/Next/Home/Reload are exercised\n- pull-to-refresh causes a fresh home request\n- external links route outside the app through ACTION_VIEW\n- downloads request the deterministic attachment through Android DownloadManager\n- zoom-enabled generated state is covered by source assertion plus live WebView launch\n- Back at home requires explicit exit confirmation`);
  process.exit(0);
}

const apk=process.argv[2];
if(!apk) throw new Error('APK path required');

const stateScript=state=>`<script>addEventListener('pageshow',()=>fetch('/state/${state}?t='+Date.now()).catch(()=>{}))</script>`;
const homePage=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;font-family:sans-serif}
a{position:fixed;left:10vw;width:80vw;height:12vh;display:flex;align-items:center;justify-content:center;border:2px solid #222;font-size:24px;box-sizing:border-box}
#next{top:20vh}#external{top:40vh}#download{top:60vh}
</style></head><body><a id="next" href="/page2.html">NEXT_PAGE</a><a id="external" href="tel:12345">EXTERNAL_LINK</a><a id="download" href="/download.bin">DOWNLOAD_FILE</a>${stateScript('home')}</body></html>`;
const page2=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><h1>Second page</h1>${stateScript('page2')}</body></html>`;

const server=http.createServer((req,res)=>{
  const url=new URL(req.url||'/', 'http://task3.local');
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
  if(url.pathname==='/download.bin'){
    res.writeHead(200,{'content-type':'application/octet-stream','content-disposition':'attachment; filename="task3-download.bin"','cache-control':'no-store'});
    res.end('task3-download');
    return;
  }
  res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});
  res.end(homePage);
});

await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(8765,'0.0.0.0',resolve);});
stage('http-server-ready');

async function dumpUi(timeout=8000){
  const path='/data/local/tmp/task3-window.xml';
  const started=Date.now();
  let lastError='no hierarchy returned';
  while(Date.now()-started<timeout){
    try{
      await run('shell','rm','-f',path);
      await run('shell','uiautomator','dump',path);
      const ui=await run('shell','cat',path);
      if(ui.includes('<hierarchy')) return ui;
      lastError=`invalid UI dump: ${ui.slice(0,160)}`;
    }catch(error){lastError=error?.message||String(error);}
    await sleep(350);
  }
  throw new Error(`UI dump unavailable after retries: ${lastError}`);
}

async function waitForUi(text,timeout=5000){
  const started=Date.now();
  let last='';
  while(Date.now()-started<timeout){
    try{
      const ui=await dumpUi(Math.min(3000,Math.max(800,timeout-(Date.now()-started))));
      last=ui;
      if(ui.includes(`text="${text}"`) || ui.includes(text)) return ui;
    }catch(error){last=error?.message||String(error);}
    await sleep(250);
  }
  throw new Error(`UI text did not appear: ${text}; last=${String(last).slice(0,220)}`);
}

function boundsForText(ui,text){
  const escaped=text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const node=new RegExp(`<node[^>]*text="${escaped}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"[^>]*/?>`).exec(ui)
    || new RegExp(`<node[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"[^>]*text="${escaped}"[^>]*/?>`).exec(ui);
  if(!node) throw new Error(`Could not locate tappable UI text: ${text}`);
  return node.slice(1,5).map(Number);
}

async function tapText(text){
  const ui=await waitForUi(text);
  const [x1,y1,x2,y2]=boundsForText(ui,text);
  await run('shell','input','tap',String(Math.round((x1+x2)/2)),String(Math.round((y1+y2)/2)));
  await sleep(500);
}

async function screenSize(){
  const out=await run('shell','wm','size');
  const match=/Physical size:\s*(\d+)x(\d+)/.exec(out) || /(\d+)x(\d+)/.exec(out);
  if(!match) throw new Error(`Could not determine emulator screen size: ${out}`);
  return {width:Number(match[1]),height:Number(match[2])};
}

async function tapWeb(percentY){
  const {width,height}=await screenSize();
  await run('shell','input','tap',String(Math.round(width*0.5)),String(Math.round(height*percentY)));
  await sleep(500);
}

async function waitForRequest(pathname,minCount,timeout=7000){
  const started=Date.now();
  while(Date.now()-started<timeout){
    if((requests.get(pathname)||0)>=minCount) return;
    await sleep(100);
  }
  throw new Error(`HTTP request did not occur: ${pathname} x${minCount}; observed=${requests.get(pathname)||0}`);
}

async function foregroundDump(){return run('shell','dumpsys','activity','activities');}
function resumedActivityLine(dump){return String(dump||'').split('\n').find(line=>/ResumedActivity|topResumedActivity/i.test(line) && /ActivityRecord/i.test(line))||'';}

try{
  stage('install');
  await run('install','-r',apk);
  stage('launch');
  await run('shell','am','force-stop',pkg);
  await run('shell','am','start','-W','-n',activity);
  await waitForRequest('/index.html',1);
  await waitForRequest('/state/home',1);

  stage('initial-foreground-and-toolbar');
  const top=await foregroundDump();
  if(!top.includes(pkg)) throw new Error('Native controls app did not reach foreground/activity stack');
  const ui=await waitForUi('Back',10000);
  for(const label of ['Back','Next','Home','Reload','Share']) if(!ui.includes(`text="${label}"`)) throw new Error(`Native navigation toolbar missing at runtime: ${label}`);

  stage('navigate-page2');
  const beforePage2=requests.get('/state/page2')||0;
  await tapWeb(0.26);
  await waitForRequest('/page2.html',1);
  await waitForRequest('/state/page2',beforePage2+1);

  stage('toolbar-back');
  const beforeBackHome=requests.get('/state/home')||0;
  await tapText('Back');
  await waitForRequest('/state/home',beforeBackHome+1);

  stage('toolbar-next');
  const beforeNextPage2=requests.get('/state/page2')||0;
  await tapText('Next');
  await waitForRequest('/state/page2',beforeNextPage2+1);

  stage('toolbar-home');
  const beforeHome=requests.get('/index.html')||0;
  await tapText('Home');
  await waitForRequest('/index.html',beforeHome+1);

  stage('toolbar-reload');
  const beforeReload=requests.get('/index.html')||0;
  await tapText('Reload');
  await waitForRequest('/index.html',beforeReload+1);

  stage('pull-refresh');
  const beforePull=requests.get('/index.html')||0;
  const {width,height}=await screenSize();
  await run('shell','input','swipe',String(Math.round(width*0.5)),String(Math.round(height*0.28)),String(Math.round(width*0.5)),String(Math.round(height*0.68)),'600');
  await waitForRequest('/index.html',beforePull+1);

  stage('external-link');
  await tapWeb(0.46);
  await sleep(750);
  const externalResumed=resumedActivityLine(await foregroundDump());
  console.log(`[smoke] external-resumed ${externalResumed.trim()||'<none>'}`);
  if(!externalResumed) throw new Error('Could not determine resumed activity during external-link test');
  if(externalResumed.includes(`${pkg}/.MainActivity`)) throw new Error('Native external link remained in the app instead of routing through ACTION_VIEW');

  stage('resume-after-external-link');
  await run('shell','am','start','-W','-n',activity);
  await sleep(500);
  const returnedResumed=resumedActivityLine(await foregroundDump());
  console.log(`[smoke] external-returned ${returnedResumed.trim()||'<none>'}`);
  if(!returnedResumed.includes(`${pkg}/.MainActivity`)) throw new Error('Native app did not resume after deterministic return from external-link test');
  await waitForUi('Back',5000);

  stage('download');
  const beforeDownload=requests.get('/download.bin')||0;
  await tapWeb(0.66);
  await waitForRequest('/download.bin',beforeDownload+1);

  stage('reset-root-for-exit-confirmation');
  const beforeExitRoot=requests.get('/index.html')||0;
  const beforeExitHome=requests.get('/state/home')||0;
  await run('shell','am','force-stop',pkg);
  await run('shell','am','start','-W','-n',activity);
  await waitForRequest('/index.html',beforeExitRoot+1);
  await waitForRequest('/state/home',beforeExitHome+1);
  await waitForUi('Back',5000);

  stage('exit-confirmation');
  await run('shell','input','keyevent','4');
  const confirmUi=await waitForUi('Cancel',5000);
  const afterBack=await foregroundDump();
  if(!afterBack.includes(pkg) || !confirmUi.includes('text="Cancel"') || !confirmUi.includes('text="Exit"')){
    throw new Error('Native home Back does not require explicit exit confirmation from clean root history');
  }

  await run('shell','input','keyevent','4');
  stage('crash-check');
  const crashes=await run('logcat','-d','-t','300');
  if(crashes.includes('FATAL EXCEPTION') && crashes.includes(pkg)) throw new Error('Native controls app crashed during deterministic emulator smoke');
  console.log('✓ native controls deterministic navigation/pull/external/download/exit smoke');
} finally {
  stage('http-server-close-start');
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise(resolve=>server.close(resolve));
  stage('http-server-close-done');
}
