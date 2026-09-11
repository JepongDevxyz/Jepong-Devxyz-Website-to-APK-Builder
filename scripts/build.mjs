import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, workDir, mkdir, ROOT } from './common.mjs';
import { writeNative } from './write-native.mjs';
import { writeCapacitor } from './write-capacitor.mjs';
import { writeCordova } from './write-cordova.mjs';
import { patchGeckoStartup } from './patch-gecko-startup.mjs';

const [,, cmd, ...args] = process.argv;
const value = name => { const i=args.indexOf(`--${name}`); return i>=0 ? args[i+1] : null; };
const buildId = value('build-id');
if (!buildId) throw new Error('--build-id required');
const cfg = loadConfig(buildId);
const allowed=['native','gecko','capacitor','cordova'];
if(!allowed.includes(cfg.engine)) throw new Error('Invalid engine');
if(cmd==='prepare') {
  new URL(cfg.websiteUrl);
  if(!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(cfg.packageName)) throw new Error('Invalid package');
  console.log(JSON.stringify({ok:true, buildId, engine:cfg.engine, appName:cfg.appName}, null, 2));
} else if(cmd==='generate') {
  const out=workDir(buildId); fs.rmSync(path.dirname(out),{recursive:true,force:true}); mkdir(out);
  if(cfg.engine==='native') writeNative(cfg,out,false);
  if(cfg.engine==='gecko') { writeNative(cfg,out,true); patchGeckoStartup(cfg,out); }
  if(cfg.engine==='capacitor') writeCapacitor(cfg,out);
  if(cfg.engine==='cordova') writeCordova(cfg,out);
  console.log(out);
} else if(cmd==='locate-apk') {
  const out=workDir(buildId); const candidates=[];
  function walk(dir){ if(!fs.existsSync(dir))return; for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name); if(e.isDirectory())walk(p); else if(e.name.endsWith('.apk'))candidates.push(p);} }
  walk(out);
  if(!candidates.length) throw new Error('No APK found');
  const best=candidates.find(p=>/release.*\.apk$/i.test(p))||candidates[0];
  const dest=path.join(ROOT,'work',buildId,`${cfg.appName.replace(/[^A-Za-z0-9._-]/g,'_')}-${cfg.engine}-${cfg.versionName}.apk`);
  fs.copyFileSync(best,dest); console.log(dest);
} else throw new Error(`Unknown command ${cmd}`);
