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

function acceptPhysical(engine,group,id,reason,{emulator=false,emulatorRequired=false}={}){
  Object.assign(CAPABILITY_EVIDENCE[engine][group][id],{
    generator:true,
    build:true,
    emulator,
    physical:true,
    emulatorRequired,
    physicalRequired:true,
    reason
  });
}

function acceptEmulator(engine,group,id,reason){
  Object.assign(CAPABILITY_EVIDENCE[engine][group][id],{
    generator:true,
    build:true,
    emulator:true,
    physical:false,
    emulatorRequired:true,
    physicalRequired:false,
    reason
  });
}

for(const id of ['camera','microphone','location']){
  acceptPhysical(
    'gecko','permissions',id,
    'Accepted Gecko physical-device verification retained; generator/build regressions remain required'
  );
}

acceptPhysical(
  'gecko','permissions','notification',
  'User-reported physical-device Web Notification runtime verification accepted after delegate generation/build verification; this is not Web Push evidence'
);

acceptPhysical(
  'gecko','permissions','files',
  'Android API 35 DocumentsUI picker regression plus user-reported physical-device file-picker verification passed',
  {emulator:true,emulatorRequired:true}
);

acceptPhysical(
  'gecko','controls','externalLinks',
  'Accepted Gecko external-link physical-device verification retained; Android API 35 regression also passed'
);

for(const id of ['adguard','ghostery','privacyBadger','darkReader','ublock']){
  acceptPhysical(
    'gecko','extensions',id,
    'Accepted Gecko WebExtension physical-device verification retained; generator/build regressions remain required'
  );
}

for(const id of ['transparentNav','navigationToolbar','downloadManager']){
  acceptEmulator(
    'gecko','controls',id,
    id==='transparentNav'
      ? 'Fresh Android API 35 runtime getter proof reported status=0 and navigation=0'
      : id==='navigationToolbar'
        ? 'Fresh Android API 35 runtime verified visible toolbar plus Back, Forward, Home and Refresh controls'
        : 'Fresh Android API 35 runtime verified DownloadManager SUCCESS, exact canonical Downloads path, 20-byte file and exact task4-gecko-download contents'
  );
}

for(const id of ['camera','microphone','location','files']){
  acceptPhysical(
    'native','permissions',id,
    'User-reported physical-device runtime verification passed after Native generator/runtime-source regression and representative signed APK build'
  );
}

for(const id of [
  'pullRefresh','hideScrollbars','transparentNav','pinchZoom','disableCopy',
  'blockAdsRedirects','navigationToolbar','externalLinks','downloadManager'
]){
  acceptEmulator(
    'native','controls',id,
    'Fresh Native generator assertions, real APK build, and Android API 35 emulator runtime verification passed; physical-device evidence is not required by policy for this control'
  );
}

for(const engine of ['capacitor','cordova']){
  for(const id of ['camera','microphone','location']){
    acceptPhysical(
      engine,'permissions',id,
      `User-reported ${engine} physical-device runtime verification passed after generator/build verification`
    );
  }

  acceptPhysical(
    engine,'permissions','files',
    `Fresh ${engine} APK build and Android API 35 DocumentsUI regression plus user-reported physical-device verification passed`,
    {emulator:true,emulatorRequired:true}
  );

  for(const id of ['transparentNav','pinchZoom']){
    acceptPhysical(
      engine,'controls',id,
      `User-reported ${engine} physical-device control verification passed after generated implementation/build verification`
    );
  }

  for(const id of ['navigationToolbar','externalLinks','downloadManager']){
    acceptPhysical(
      engine,'controls',id,
      `Fresh ${engine} real APK build and Android API 35 runtime regression plus user-reported physical-device verification passed`,
      {emulator:true,emulatorRequired:true}
    );
  }
}
