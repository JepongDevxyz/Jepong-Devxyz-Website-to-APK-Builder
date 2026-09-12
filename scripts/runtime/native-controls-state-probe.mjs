import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync=promisify(execFile);
const pkg='com.jepongdevxyz.nativecontrolsverify';
const activity=`${pkg}/.MainActivity`;
const apk=process.argv[2];
if(!apk) throw new Error('APK path required');

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const run=async(...args)=>{
  const timeout=args[0]==='install' ? 60000 : 30000;
  try{
    const {stdout=''}=await execFileAsync('adb',args,{encoding:'utf8',timeout});
    return stdout;
  }catch(error){
    throw new Error(`ADB command failed or timed out: adb ${args.join(' ')} :: ${error?.message||error}`);
  }
};

let homeRequests=0;
const page=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
html,body{margin:0;width:100%;height:100%;font-family:sans-serif;overflow:hidden}
a{position:fixed;left:10vw;top:20vh;width:80vw;height:42vh;display:flex;align-items:center;justify-content:center;border:3px solid #222;font-size:24px;box-sizing:border-box}
</style></head><body><a href="https://doubleclick.net/task3-blocked">BLOCKED_AD_REDIRECT</a></body></html>`;

const server=http.createServer((req,res)=>{
  const url=new URL(req.url||'/', 'http://task3.local');
  if(url.pathname==='/index.html' || url.pathname==='/') homeRequests++;
  res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'});
  res.end(page);
});

async function waitForHome(timeout=8000){
  const started=Date.now();
  while(Date.now()-started<timeout){
    if(homeRequests>0) return;
    await sleep(100);
  }
  throw new Error('Native state probe page did not load');
}

async function waitForControlState(timeout=8000){
  const started=Date.now();
  let last='';
  while(Date.now()-started<timeout){
    last=await run('logcat','-d','-s','JepongControls:D','*:S');
    if(last.includes('JepongControls')) return last;
    await sleep(250);
  }
  throw new Error(`Native control-state log missing; last=${last.slice(-500)}`);
}

async function screenSize(){
  const out=await run('shell','wm','size');
  const match=/Physical size:\s*(\d+)x(\d+)/.exec(out) || /(\d+)x(\d+)/.exec(out);
  if(!match) throw new Error(`Could not determine emulator screen size: ${out}`);
  return {width:Number(match[1]),height:Number(match[2])};
}

function resumedActivityLine(dump){
  return String(dump||'').split('\n').find(line=>/ResumedActivity|topResumedActivity/i.test(line) && /ActivityRecord/i.test(line))||'';
}

await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(8765,'0.0.0.0',resolve);});
console.log('[state-probe] server-ready');

try{
  await run('install','-r',apk);
  await run('logcat','-c');
  await run('shell','pm','clear',pkg);
  await run('shell','am','start','-W','-n',activity);
  await waitForHome();

  const controlLog=await waitForControlState();
  const expected=[
    'vertical=false',
    'horizontal=false',
    'builtInZoom=true',
    'displayZoom=false',
    'supportZoom=true',
    'longClickable=false',
    'navColor=0',
    'statusColor=0'
  ];
  for(const token of expected){
    if(!controlLog.includes(token)){
      throw new Error(`Native runtime control state missing ${token}; log=${controlLog.trim()}`);
    }
  }
  console.log(`[state-probe] control-state ${expected.join(' ')}`);

  const before=await run('shell','dumpsys','activity','activities');
  const beforeLine=resumedActivityLine(before);
  if(!beforeLine.includes(`${pkg}/.MainActivity`)){
    throw new Error(`Native app not foreground before blocked redirect probe: ${beforeLine}`);
  }

  const {width,height}=await screenSize();
  await run('shell','input','tap',String(Math.round(width*0.5)),String(Math.round(height*0.38)));
  await sleep(1000);

  const after=await run('shell','dumpsys','activity','activities');
  const afterLine=resumedActivityLine(after);
  console.log(`[state-probe] blocked-redirect-resumed ${afterLine.trim()||'<none>'}`);
  if(!afterLine.includes(`${pkg}/.MainActivity`)){
    throw new Error(`Blocked ad redirect escaped Native app: ${afterLine}`);
  }

  const crashes=await run('logcat','-d','-t','250');
  if(crashes.includes('FATAL EXCEPTION') && crashes.includes(pkg)){
    throw new Error('Native app crashed during direct control-state probe');
  }

  console.log('✓ native scrollbars/transparent-bars/zoom/disable-copy-state/blocked-redirect runtime probe');
} finally {
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise(resolve=>server.close(resolve));
}
