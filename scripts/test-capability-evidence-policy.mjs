import {
  CAPABILITY_STATUS,
  FEATURES,
  ENGINE_CAPABILITIES,
  getSelectableFeatureIds
} from '../capabilities.mjs';

import {
  getCapabilityEvidence,
  isCapabilityVerificationComplete
} from '../verification/capability-verification.mjs';

for(const [engine,groups] of Object.entries(ENGINE_CAPABILITIES)){
  for(const group of Object.keys(FEATURES)){
    const entries=groups[group] ?? {};
    const selectable=new Set(getSelectableFeatureIds(engine,group));

    for(const [id,capability] of Object.entries(entries)){
      const evidence=getCapabilityEvidence(engine,group,id);

      if(!evidence){
        throw new Error(`Capability missing evidence record: ${engine}/${group}/${id}`);
      }

      for(const key of [
        'generator',
        'build',
        'emulator',
        'physical',
        'physicalRequired',
        'emulatorRequired',
        'reason'
      ]){
        if(!(key in evidence)){
          throw new Error(`Evidence field ${key} missing: ${engine}/${group}/${id}`);
        }
      }

      if(capability.status===CAPABILITY_STATUS.VERIFIED){
        if(!isCapabilityVerificationComplete(engine,group,id)){
          throw new Error(`Verified capability has incomplete evidence: ${engine}/${group}/${id}`);
        }
      }

      if(capability.status===CAPABILITY_STATUS.UNSUPPORTED){
        if(selectable.has(id)){
          throw new Error(`Unsupported capability is selectable: ${engine}/${group}/${id}`);
        }
        if(!String(capability.reason ?? '').trim()){
          throw new Error(`Unsupported capability missing reason: ${engine}/${group}/${id}`);
        }
      }
    }
  }
}

console.log('✓ capability evidence policy');
