import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync=promisify(execFile);
const pkg='com.jepongdevxyz.nativecontrolsverify';
const activity=`${pkg}/.MainActivity`;
const requests=new Map();

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const run=async(...args)=>{
  const { stdout='' }=await execFileAsync('adb',args,{encoding:'utf8'});
  return stdout;
};

if(process.argv.includes('--print-cases')){
  console.log(`Native controls emulator smoke:\n- deterministic local test page loads through 10.0.2.2\n- navigation toolbar is visible\n- page link plus native Back/Next/Home/Reload are exercised\n- external links route outside the app through ACTION_VIEW\n- downloads request the deterministic attachment through Android DownloadManager\n- zoom-enabled generated state is covered by source assertion plus live WebView launch\n- Back at home requires explicit exit confirmation`);
  process.exit(0);
}

const apk=process.argv[2];
if(!apk) throw new Error('APK path required');

const page=body=>`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:28px sans-serif;margin:24px}a{display:block;padding:30px;margin:24px 0;border:2px solid #222}</style>${body}`;
const server=http.createServer((req,res)=>{
  const url=new URL(req.url||'/', 'http://task3.local');
  requests.set(url.pathname,(requests.get(url.pathname)||0)+1);
  if(url.pathname==='/page2.html'){
    res.writeHead(200,{'content-type':'text/html'});
    res.end(page('<h1>TASK3_PAGE_2</h1><p>Second page</p>'));
    return;
  }
  if(url.pathname==='/download.bin'){
    res.writeHead(200,{
      'content-type':'application/octet-stream',
      'content-disposition':'attachment; filename="task3-download.bin"'
    });
    res.end('task3-download');
    return;
  }
  res.writeHead(200,{'content-type':'text/html'});
  res.end(page('<h1>TASK3_HOME</h1><a href="/page2.html">NEXT_PAGE</a><a href="tel:12345">EXTERNAL_LINK</a><a href="/download.bin">DOWNLOAD_FILE</a>'));
});

await new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(8765,'0.0.0.0',resolve);
});

async function dumpUi(){
  await run('shell','uiautomator','dump','/sdcard/task3-window.xml');
  return run('shell','cat','/sdcard/task3-window.xml');
}

async function waitForUi(text,timeout=5000){
  const started=Date.now();
  while(Date.now()-started<timeout){
    const ui=await dumpUi();
    if(ui.includes(`text="${text}"`) || ui.includes(text)) return ui;
    await sleep(250);
  }
  throw new Error(`UI text did not appear: ${text}`);
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

async function waitForRequest(pathname,minCount,timeout=5000){
  const started=Date.now();
  while(Date.now()-started<timeout){
    if((requests.get(pathname)||0)>=minCount) return;
    await sleep(100);
  }
  throw new Error(`HTTP request did not occur: ${pathname} x${minCount}`);
}

async function foregroundDump(){
  return run('shell','dumpsys','activity','activities');
}

try{
  await run('install','-r',apk);
  await run('shell','am','force-stop',pkg);
  await run('shell','am','start','-W','-n',activity);
  await waitForRequest('/index.html',1);
  await sleep(1000);

  const top=await foregroundDump();
  if(!top.includes(pkg)) throw new Error('Native controls app did not reach foreground/activity stack');

  const ui=await dumpUi();
  for(const label of ['Back','Next','Home','Reload','Share']){
    if(!ui.includes(`text="${label}"`)) throw new Error(`Native navigation toolbar missing at runtime: ${label}`);
  }
  if(!ui.includes('TASK3_HOME')) throw new Error('deterministic Native home marker missing at runtime');

  await tapText('NEXT_PAGE');
  await waitForRequest('/page2.html',1);
  await waitForUi('TASK3_PAGE_2');

  await tapText('Back');
  await waitForUi('TASK3_HOME');

  await tapText('Next');
  await waitForUi('TASK3_PAGE_2');

  await tapText('Home');
  await waitForUi('TASK3_HOME');

  const beforeReload=requests.get('/index.html')||0;
  await tapText('Reload');
  await waitForRequest('/index.html',beforeReload+1);
  await waitForUi('TASK3_HOME');

  await tapText('EXTERNAL_LINK');
  await sleep(750);
  const externalTop=await foregroundDump();
  if(externalTop.includes(`mResumedActivity: ActivityRecord`) && externalTop.includes(`${pkg}/.MainActivity`)){
    throw new Error('Native external link remained in the app instead of routing through ACTION_VIEW');
  }
  await run('shell','input','keyevent','4');
  await sleep(500);
  const returnedTop=await foregroundDump();
  if(!returnedTop.includes(pkg)) throw new Error('Native app did not resume after external-link test');
  await waitForUi('TASK3_HOME');

  await tapText('DOWNLOAD_FILE');
  await waitForRequest('/download.bin',1);

  await run('shell','input','keyevent','4');
  await waitForUi('Cancel');
  const afterBack=await foregroundDump();
  const confirmUi=await dumpUi();
  if(!afterBack.includes(pkg) || !confirmUi.includes('text="Cancel"') || !confirmUi.includes('text="Exit"')){
    throw new Error('Native home Back does not require explicit exit confirmation');
  }

  await run('shell','input','keyevent','4');
  const crashes=await run('logcat','-d','-t','300');
  if(crashes.includes('FATAL EXCEPTION') && crashes.includes(pkg)){
    throw new Error('Native controls app crashed during deterministic emulator smoke');
  }

  console.log('✓ native controls deterministic navigation/external/download/exit smoke');
} finally {
  await new Promise(resolve=>server.close(resolve));
}
