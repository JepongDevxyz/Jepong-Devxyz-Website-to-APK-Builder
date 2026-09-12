import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeNative } from './write-native.mjs';
import { getCapabilityEvidence } from '../verification/capability-verification.mjs';

const out=path.join(os.tmpdir(),'jepong-native-controls-verification');
fs.rmSync(out,{recursive:true,force:true});

const controls=['pullRefresh','hideScrollbars','transparentNav','pinchZoom','disableCopy','blockAdsRedirects','navigationToolbar','externalLinks','downloadManager'];
writeNative({websiteUrl:'https://example.com',appName:'Native Controls Test',packageName:'com.jepongdevxyz.nativecontrolstest',versionName:'1.0.0',versionCode:1,renderMode:'default',orientation:'auto',permissions:[],controls,extensions:[],oneSignalAppId:'',offlineFallback:'Offline',iconDataUrl:'',splashDataUrl:'',splashEnabled:false,splashDuration:0,sizeOptimization:false,abiTarget:'universal'},out,false);

const main=fs.readFileSync(path.join(out,'app/src/main/java/com/jepongdevxyz/nativecontrolstest/MainActivity.java'),'utf8');
const required=[
  'e.getY()-downY>180',
  'setVerticalScrollBarEnabled(false)',
  'setNavigationBarColor(Color.TRANSPARENT)',
  'setBuiltInZoomControls(true)',
  'setDisplayZoomControls(false)',
  'setOnLongClickListener(v->true)',
  'isBlocked(r.getUrl())',
  'buildNativeNavigationBar()',
  'shouldOpenExternally(u)',
  'openExternalUrl(u)',
  'setDownloadListener',
  'startNativeDownload(',
  'showExitConfirmation()',
  'setPositiveButton("Exit"',
  'setNegativeButton("Cancel"'
];
for(const token of required){
  if(!main.includes(token)) throw new Error(`native control behavior missing: ${token}`);
}
for(const id of controls){
  const evidence=getCapabilityEvidence('native','controls',id);
  if(!evidence?.generator) throw new Error(`native ${id} generator evidence not recorded`);
}
const dns=getCapabilityEvidence('native','controls','adguardDns');
if(!dns || !String(dns.reason||'').toLowerCase().includes('vpn/dns')) throw new Error('native adguardDns must remain unsupported with VPN/DNS reason');
fs.rmSync(out,{recursive:true,force:true});
console.log('✓ native controls generator verification');
