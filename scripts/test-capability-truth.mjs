import fs from 'node:fs';

import {
  CAPABILITY_STATUS,
  FEATURES,
  ENGINE_CAPABILITIES,
  getCapability,
  getSelectableFeatureIds
} from '../capabilities.mjs';

import {
  isCapabilityVerificationComplete
} from '../verification/capability-verification.mjs';

const {VERIFIED,EXPERIMENTAL,UNSUPPORTED}=CAPABILITY_STATUS;
const engines=['native','gecko','capacitor','cordova'];

const bridgeOnlyPermissions=[
  'media','contacts','calendar','biometrics','bluetooth','sensors'
];

for(const engine of engines){
  const selectable=getSelectableFeatureIds(engine,'permissions');
  for(const id of bridgeOnlyPermissions){
    const capability=getCapability(engine,'permissions',id);
    if(capability.status!==UNSUPPORTED){
      throw new Error(`${engine} ${id} must be unsupported`);
    }
    if(selectable.includes(id)){
      throw new Error(`${engine} ${id} must not be selectable`);
    }
  }
}

for(const engine of ['native','capacitor','cordova']){
  const capability=getCapability(engine,'permissions','notification');
  if(capability.status!==UNSUPPORTED){
    throw new Error(`${engine} notification must be unsupported`);
  }
  if(getSelectableFeatureIds(engine,'permissions').includes('notification')){
    throw new Error(`${engine} notification must not be selectable`);
  }
}

{
  const notification=getCapability('gecko','permissions','notification');
  if(notification.status!==EXPERIMENTAL){
    throw new Error('gecko notification must remain Experimental');
  }
  if(!notification.compileVerified){
    throw new Error('gecko notification compile verification is stale');
  }
  if(notification.runtimeVerified){
    throw new Error('gecko notification cannot be runtime Verified yet');
  }
}

for(const engine of engines){
  for(const group of ['permissions','controls','extensions']){
    const selectable=new Set(getSelectableFeatureIds(engine,group));

    for(const feature of FEATURES[group]){
      const capability=ENGINE_CAPABILITIES[engine][group][feature.id];

      if(capability.status!==UNSUPPORTED && !capability.compileVerified){
        throw new Error(`${engine} ${group}/${feature.id} is selectable but not compile-verified`);
      }

      if(capability.status===VERIFIED){
        if(!capability.compileVerified || !capability.runtimeVerified){
          throw new Error(`${engine} ${group}/${feature.id} has invalid Verified metadata`);
        }
        if(!isCapabilityVerificationComplete(engine,group,feature.id)){
          throw new Error(`${engine} ${group}/${feature.id} is Verified without complete independent evidence`);
        }
      }

      if(capability.status===UNSUPPORTED){
        if(selectable.has(feature.id)){
          throw new Error(`${engine} ${group}/${feature.id} unsupported but selectable`);
        }
        if(!String(capability.reason ?? '').trim()){
          throw new Error(`${engine} ${group}/${feature.id} unsupported without reason`);
        }
      }
    }
  }
}

const workflow=fs.readFileSync('.github/workflows/verify-engines.yml','utf8');

if(workflow.includes(`PERMISSIONS='["camera","microphone","notification","location","media","contacts","calendar","biometrics","files","bluetooth","sensors"]'`)){
  throw new Error('CI still enables foundation-only permissions');
}

const expected={
  native:{
    permissions:'["camera","microphone","location","files"]',
    controls:'["pullRefresh","hideScrollbars","transparentNav","pinchZoom","disableCopy","blockAdsRedirects","navigationToolbar","externalLinks","downloadManager"]',
    extensions:'[]'
  },
  gecko:{
    permissions:'["camera","microphone","notification","location","files"]',
    controls:'["transparentNav","navigationToolbar","externalLinks","downloadManager"]',
    extensions:'["adguard","ghostery","privacyBadger","darkReader","ublock"]'
  },
  capacitor:{
    permissions:'["camera","microphone","location","files"]',
    controls:'["transparentNav","pinchZoom","navigationToolbar","externalLinks","downloadManager"]',
    extensions:'[]'
  },
  cordova:{
    permissions:'["camera","microphone","location","files"]',
    controls:'["transparentNav","pinchZoom","navigationToolbar","externalLinks","downloadManager"]',
    extensions:'[]'
  }
};

for(const [engine,config] of Object.entries(expected)){
  const re=new RegExp(`\\n\\s*${engine}\\)\\n([\\s\\S]*?)\\n\\s*;;`);
  const match=workflow.match(re);
  if(!match) throw new Error(`CI case missing: ${engine}`);
  const block=match[1];

  for(const [key,value] of Object.entries(config)){
    const variable=key==='permissions'?'PERMISSIONS':key==='controls'?'CONTROLS':'EXTENSIONS';
    if(!block.includes(`${variable}='${value}'`)){
      throw new Error(`${engine} CI ${variable} is not exhaustive/truthful`);
    }
  }
}

for(const id of ['adguard','ghostery','privacyBadger','darkReader','ublock']){
  const capability=getCapability('gecko','extensions',id);
  if(capability.status!==VERIFIED){
    throw new Error(`gecko extension ${id} must be Verified`);
  }
  if(!capability.compileVerified || !capability.runtimeVerified){
    throw new Error(`gecko extension ${id} verification metadata is stale`);
  }
  if(!isCapabilityVerificationComplete('gecko','extensions',id)){
    throw new Error(`gecko extension ${id} independent verification evidence is incomplete`);
  }
}

console.log('✓ Truthful capability matrix, evidence gate and exhaustive CI');
