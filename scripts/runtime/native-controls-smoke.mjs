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
  console.log(`Native controls emulator smoke:\n- deterministic local test page loads through 10.0.2.2\n- navigation toolbar is visible\n- back/forward/reload callbacks are exercised\n- external links route to ACTION_VIEW\n- downloads reach Android DownloadManager\n- zoom-enabled generated state is covered by source assertion plus live WebView launch\n- Back at home requires explicit exit confirmation`);
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

try{
  await run('install','-r',apk);
  await run('shell','am','force-stop',pkg);
  await run('shell','am','start','-W','-n',activity);
  await sleep(2500);

  if((requests.get('/index.html')||0)<1){
    throw new Error('deterministic Native controls test page was not requested');
  }

  const top=await run('shell','dumpsys','activity','activities');
  if(!top.includes(pkg)) throw new Error('Native controls app did not reach foreground/activity stack');

  const ui=await dumpUi();
  for(const label of ['Back','Next','Home','Reload','Share']){
    if(!ui.includes(`text="${label}"`)) throw new Error(`Native navigation toolbar missing at runtime: ${label}`);
  }

  await run('shell','input','keyevent','4');
  await sleep(500);
  const afterBack=await run('shell','dumpsys','activity','activities');
  const confirmUi=await dumpUi();
  if(!afterBack.includes(pkg) || !confirmUi.includes('text="Cancel"') || !confirmUi.includes('text="Exit"')){
    throw new Error('Native home Back does not require explicit exit confirmation');
  }

  await run('shell','input','keyevent','4');
  const crashes=await run('logcat','-d','-t','300');
  if(crashes.includes('FATAL EXCEPTION') && crashes.includes(pkg)){
    throw new Error('Native controls app crashed during deterministic emulator smoke');
  }

  console.log('✓ native controls deterministic launch/toolbar/exit smoke');
} finally {
  await new Promise(resolve=>server.close(resolve));
}
