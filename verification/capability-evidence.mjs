import {
  FEATURES,
  ENGINE_CAPABILITIES,
  CAPABILITY_STATUS
} from '../capabilities.mjs';

function pendingRecord(reason='Awaiting verification'){
  return {
    generator:false,
    build:false,
    emulator:false,
    physical:false,
    emulatorRequired:true,
    physicalRequired:false,
    reason
  };
}

function buildRegistry(){
  const registry={};

  for(const [engine,groups] of Object.entries(ENGINE_CAPABILITIES)){
    registry[engine]={};

    for(const group of Object.keys(FEATURES)){
      registry[engine][group]={};

      for(const id of Object.keys(groups[group] ?? {})){
        const capability=groups[group][id];
        const record=pendingRecord();

        if(capability.status===CAPABILITY_STATUS.UNSUPPORTED){
          record.emulatorRequired=false;
          record.reason=`Unsupported: ${capability.reason}`;
        }

        registry[engine][group][id]=record;
      }
    }
  }

  return registry;
}

export const CAPABILITY_EVIDENCE=buildRegistry();

function acceptExistingPhysicalVerification(group,id,reason){
  const record=CAPABILITY_EVIDENCE.gecko[group][id];
  Object.assign(record,{
    generator:true,
    build:true,
    emulator:false,
    physical:true,
    emulatorRequired:false,
    physicalRequired:true,
    reason
  });
}

for(const id of ['camera','microphone','location']){
  acceptExistingPhysicalVerification(
    'permissions',
    id,
    'Existing accepted Gecko physical-device verification retained; future batches must keep regression evidence green'
  );
}

acceptExistingPhysicalVerification(
  'controls',
  'externalLinks',
  'Existing accepted Gecko external-link physical-device verification retained; future batches must keep regression evidence green'
);

for(const id of ['adguard','ghostery','privacyBadger','darkReader','ublock']){
  acceptExistingPhysicalVerification(
    'extensions',
    id,
    'Existing accepted Gecko WebExtension physical-device verification retained; future batches must keep regression evidence green'
  );
}

for(const id of ['camera','microphone','location','files']){
  Object.assign(CAPABILITY_EVIDENCE.native.permissions[id],{
    generator:true,
    build:true,
    emulator:false,
    physical:false,
    emulatorRequired:true,
    physicalRequired:true,
    reason:'Native generator/runtime-source regression and representative signed APK build passed; emulator launch and physical-device smoke evidence are still required'
  });
}
