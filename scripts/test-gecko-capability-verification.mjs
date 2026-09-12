import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { writeNative } from './write-native.mjs';
import { patchGeckoStartup } from './patch-gecko-startup.mjs';
import { patchCrossEngineBrowserUx } from './patch-cross-engine-browser-ux.mjs';
import { patchModernBackManifest } from './patch-modern-back-manifest.mjs';
import { getCapabilityEvidence } from '../verification/capability-verification.mjs';

const out=
  path.join(
    os.tmpdir(),
    'jepong-gecko-capability-verification'
  );

fs.rmSync(
  out,
  {
    recursive:true,
    force:true
  }
);

const cfg={
  websiteUrl:'https://example.com',
  appName:'Gecko Capability Test',
  packageName:'com.jepongdevxyz.geckocapabilitytest',
  versionName:'1.0.0',
  versionCode:1,
  engine:'gecko',
  renderMode:'default',
  orientation:'auto',
  permissions:[
    'notification',
    'files'
  ],
  controls:[
    'transparentNav',
    'navigationToolbar',
    'externalLinks',
    'downloadManager'
  ],
  extensions:[],
  oneSignalAppId:'',
  offlineFallback:'Offline',
  iconDataUrl:'',
  splashDataUrl:'',
  splashEnabled:false,
  splashDuration:0,
  apkSigner:false,
  sizeOptimization:false,
  abiTarget:'universal'
};

writeNative(
  cfg,
  out,
  true
);

patchGeckoStartup(
  cfg,
  out
);

patchCrossEngineBrowserUx(
  cfg,
  out
);

patchModernBackManifest(out);

const main=
  fs.readFileSync(
    path.join(
      out,
      'app/src/main/java/com/jepongdevxyz/geckocapabilitytest/MainActivity.java'
    ),
    'utf8'
  );

const manifest=
  fs.readFileSync(
    path.join(
      out,
      'app/src/main/AndroidManifest.xml'
    ),
    'utf8'
  );

for(const token of [
  'runtime.setWebNotificationDelegate(',
  'PERMISSION_DESKTOP_NOTIFICATION',
  'onFilePrompt(',
  'Intent.ACTION_OPEN_DOCUMENT',
  'setNavigationBarColor(',
  'Color.TRANSPARENT',
  'JepongRuntimeBars',
  'getStatusBarColor()',
  'getNavigationBarColor()',
  'buildNavigationToolbar()',
  'onCanGoBack(',
  'onCanGoForward(',
  'shouldOpenExternally(',
  'onExternalResponse(',
  'enqueueDownload(',
  'responseHeader(',
  'equalsIgnoreCase(name)',
  'responseHeader(response, "content-disposition")',
  'responseHeader(response, "content-type")',
  'showExitConfirmation()',
  'showPoweredByToast()',
  'installBackHandler()',
  'handleAppBack()'
]){
  if(!main.includes(token)){
    throw new Error(
      `Gecko capability behavior missing: ${token}`
    );
  }
}

if(
  !manifest.includes(
    'android:enableOnBackInvokedCallback="true"'
  )
){
  throw new Error(
    'Gecko manifest must enable modern Android Back callback handling'
  );
}

for(const [group,id] of [
  ['permissions','notification'],
  ['permissions','files'],
  ['controls','transparentNav'],
  ['controls','navigationToolbar'],
  ['controls','downloadManager']
]){
  const evidence=
    getCapabilityEvidence(
      'gecko',
      group,
      id
    );

  if(!evidence){
    throw new Error(
      `Missing Gecko capability evidence record: ${group}.${id}`
    );
  }
}

const dns=
  getCapabilityEvidence(
    'gecko',
    'controls',
    'adguardDns'
  );

if(
  !dns ||
  !String(dns.reason||'')
    .toLowerCase()
    .includes('vpn/dns')
){
  throw new Error(
    'Gecko adguardDns must remain unsupported with a VPN/DNS reason'
  );
}

fs.rmSync(
  out,
  {
    recursive:true,
    force:true
  }
);

console.log(
  '✓ Gecko capability generator verification'
);
