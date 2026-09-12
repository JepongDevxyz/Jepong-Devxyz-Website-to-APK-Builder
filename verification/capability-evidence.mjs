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
  'Existing accepted Gecko external-link physical-device verification retained; fresh Android API 35 regression also passed'
);

for(const id of ['adguard','ghostery','privacyBadger','darkReader','ublock']){
  acceptExistingPhysicalVerification(
    'extensions',
    id,
    'Existing accepted Gecko WebExtension physical-device verification retained; future batches must keep regression evidence green'
  );
}

Object.assign(CAPABILITY_EVIDENCE.gecko.permissions.notification,{
  generator:true,
  build:true,
  emulator:false,
  physical:false,
  emulatorRequired:true,
  physicalRequired:false,
  reason:'Gecko Web Notification delegate generation and representative APK build passed, but no secure-context Web Notification runtime proof exists; Web Notifications are distinct from Web Push'
});

Object.assign(CAPABILITY_EVIDENCE.gecko.permissions.files,{
  generator:true,
  build:true,
  emulator:true,
  physical:false,
  emulatorRequired:true,
  physicalRequired:true,
  reason:'Android API 35 DocumentsUI picker launch and clean app return passed; physical-device proof remains required before promotion'
});

for(const id of ['transparentNav','navigationToolbar','downloadManager']){
  Object.assign(CAPABILITY_EVIDENCE.gecko.controls[id],{
    generator:true,
    build:true,
    emulator:true,
    physical:false,
    emulatorRequired:true,
    physicalRequired:false,
    reason:
      id==='transparentNav'
        ? 'Fresh Android API 35 runtime getter proof reported status=0 and navigation=0'
        : id==='navigationToolbar'
          ? 'Fresh Android API 35 runtime verified visible toolbar plus Back, Forward, Home and Refresh controls'
          : 'Fresh Android API 35 runtime verified DownloadManager SUCCESS, exact canonical Downloads path, 20-byte file and exact task4-gecko-download contents'
  });
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

for(const id of [
  'pullRefresh','hideScrollbars','transparentNav','pinchZoom','disableCopy',
  'blockAdsRedirects','navigationToolbar','externalLinks','downloadManager'
]){
  Object.assign(CAPABILITY_EVIDENCE.native.controls[id],{
    generator:true,
    build:true,
    emulator:true,
    physical:false,
    emulatorRequired:true,
    physicalRequired:false,
    reason:'Fresh Native generator assertions, real APK build, and Android API 35 emulator runtime verification passed; physical-device evidence is not required by policy for this control'
  });
}

for(const engine of ['capacitor','cordova']){
  Object.assign(CAPABILITY_EVIDENCE[engine].permissions.files,{
    generator:true,
    build:true,
    emulator:true,
    physical:false,
    emulatorRequired:true,
    physicalRequired:true,
    reason:`Fresh ${engine} APK build and Android API 35 DocumentsUI picker/return regression passed; physical-device verification remains required`
  });

  for(const id of ['navigationToolbar','externalLinks','downloadManager']){
    Object.assign(CAPABILITY_EVIDENCE[engine].controls[id],{
      generator:true,
      build:true,
      emulator:true,
      physical:false,
      emulatorRequired:true,
      physicalRequired:true,
      reason:`Fresh ${engine} real APK build and Android API 35 runtime regression passed; physical-device verification remains required before promotion`
    });
  }
}
