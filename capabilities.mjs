export const CAPABILITY_STATUS=Object.freeze({
  VERIFIED:'verified',
  EXPERIMENTAL:'experimental',
  UNSUPPORTED:'unsupported'
});

export const FEATURES=Object.freeze({
  permissions:Object.freeze([
    {id:'camera',label:'Camera'},
    {id:'microphone',label:'Microphone'},
    {id:'notification',label:'Notifications'},
    {id:'location',label:'Location'},
    {id:'media',label:'Photos & videos'},
    {id:'contacts',label:'Contacts'},
    {id:'calendar',label:'Calendar'},
    {id:'biometrics',label:'Biometrics'},
    {id:'files',label:'Files & documents'},
    {id:'bluetooth',label:'Bluetooth'},
    {id:'sensors',label:'Sensors'}
  ]),

  controls:Object.freeze([
    {id:'pullRefresh',label:'Pull-down refresh'},
    {id:'hideScrollbars',label:'Hide scrollbars'},
    {id:'transparentNav',label:'Transparent system bars'},
    {id:'pinchZoom',label:'Pinch to zoom'},
    {id:'disableCopy',label:'Disable text copy'},
    {id:'blockAdsRedirects',label:'Block ad redirects'},
    {id:'navigationToolbar',label:'Navigation toolbar'},
    {id:'externalLinks',label:'External link rules'},
    {id:'downloadManager',label:'Download manager'},
    {id:'adguardDns',label:'AdGuard DNS'}
  ]),

  extensions:Object.freeze([
    {id:'adguard',label:'AdGuard AdBlocker'},
    {id:'ghostery',label:'Ghostery'},
    {id:'privacyBadger',label:'Privacy Badger'},
    {id:'darkReader',label:'Dark Reader'},
    {id:'ublock',label:'uBlock Origin'}
  ])
});

const V=CAPABILITY_STATUS.VERIFIED;
const E=CAPABILITY_STATUS.EXPERIMENTAL;
const U=CAPABILITY_STATUS.UNSUPPORTED;

function cap(status,implementation,compileVerified,runtimeVerified,reason){
  return Object.freeze({status,implementation,compileVerified,runtimeVerified,reason});
}

const unsupported=(reason='Not implemented for this engine')=>
  cap(U,'none',false,false,reason);

function blankEngine(){
  const out={permissions:{},controls:{},extensions:{}};
  for(const group of Object.keys(FEATURES)){
    for(const feature of FEATURES[group]) out[group][feature.id]=unsupported();
  }
  return out;
}

const native=blankEngine();
const gecko=blankEngine();
const capacitor=blankEngine();
const cordova=blankEngine();

/* Native WebView */
for(const [id,implementation] of Object.entries({
  camera:'android-webview-media-permission',
  microphone:'android-webview-media-permission',
  location:'android-webview-geolocation',
  files:'android-webview-file-chooser'
})){
  native.permissions[id]=cap(
    V,
    implementation,
    true,
    true,
    'User-reported physical-device runtime verification passed after generator/build verification'
  );
}

native.permissions.notification=
  unsupported('Normal Web Notifications are not implemented for Native WebView yet');

for(const id of ['media','contacts','calendar','biometrics','bluetooth','sensors']){
  native.permissions[id]=unsupported(
    'Android permission declaration alone is not a website-facing API; a secure Native bridge is not implemented'
  );
}

for(const id of ['pullRefresh','hideScrollbars','transparentNav','pinchZoom','disableCopy','blockAdsRedirects']){
  native.controls[id]=cap(
    V,'native-webview-control',true,true,
    'Generated behavior, real APK build, and Android API 35 emulator runtime verification passed'
  );
}

native.controls.navigationToolbar=cap(
  V,'native-webview-navigation-toolbar',true,true,
  'Back, Next, Home, Reload and Share toolbar rendering plus navigation behavior passed Android API 35 emulator verification'
);
native.controls.externalLinks=cap(
  V,'native-webview-external-routing',true,true,
  'User-triggered external routing opened outside the Native app and deterministic app return passed Android API 35 emulator verification'
);
native.controls.downloadManager=cap(
  V,'android-download-manager',true,true,
  'Native DownloadManager listener requested the deterministic attachment during Android API 35 emulator verification'
);

/* GeckoView */
gecko.permissions.camera=cap(V,'geckoview-permission-delegate',true,true,'Physical-device camera runtime test passed');
gecko.permissions.microphone=cap(V,'geckoview-permission-delegate',true,true,'Physical-device microphone runtime test passed');
gecko.permissions.location=cap(V,'geckoview-content-permission',true,true,'Physical-device Geolocation API runtime test passed');
gecko.permissions.notification=cap(
  V,
  'geckoview-web-notification-delegate',
  true,
  true,
  'User-reported physical-device Web Notification runtime verification passed; this does not claim Web Push support'
);
gecko.permissions.files=cap(
  V,
  'geckoview-prompt-delegate-saf',
  true,
  true,
  'Android API 35 DocumentsUI regression and user-reported physical-device file-picker verification passed'
);

for(const id of ['media','contacts','calendar','biometrics','bluetooth','sensors']){
  gecko.permissions[id]=unsupported(
    'Android permission declaration alone is not a website-facing API; a secure Gecko bridge is not implemented'
  );
}

gecko.controls.transparentNav=cap(
  V,'android-system-bars',true,true,
  'Fresh Android API 35 runtime getter proof reported status=0 and navigation=0 for transparent system bars'
);
gecko.controls.navigationToolbar=cap(
  V,'geckoview-navigation-toolbar',true,true,
  'Fresh Android API 35 runtime verified visible toolbar plus Back, Forward, Home and Refresh behavior'
);
gecko.controls.externalLinks=cap(
  V,'geckoview-navigation-delegate',true,true,
  'Off-site user-clicked link was physically observed opening in the Android browser and remains covered by API 35 regression'
);
gecko.controls.downloadManager=cap(
  V,'android-download-manager',true,true,
  'Fresh Android API 35 runtime verified DownloadManager SUCCESS plus exact public Downloads path, 20-byte file and task4-gecko-download contents'
);

for(const id of ['adguard','ghostery','privacyBadger','darkReader','ublock']){
  gecko.extensions[id]=cap(
    V,'geckoview-webextension-controller',true,true,
    'Physical-device extension runtime test passed'
  );
}

/* Capacitor */
for(const id of ['camera','microphone','location','files']){
  capacitor.permissions[id]=cap(
    V,
    'capacitor-bridge-webview-runtime',
    true,
    true,
    'User-reported physical-device runtime verification passed after Android generator/build verification'
  );
}
capacitor.permissions.notification=
  unsupported('Normal Web Notifications are not implemented for Capacitor yet');
for(const id of ['media','contacts','calendar','biometrics','bluetooth','sensors']){
  capacitor.permissions[id]=unsupported(
    'Android permission declaration alone is not a website-facing API; a secure Capacitor bridge is not implemented'
  );
}
for(const id of ['transparentNav','pinchZoom']){
  capacitor.controls[id]=cap(
    V,'capacitor-android-control',true,true,
    'User-reported physical-device runtime verification passed after generated implementation/build verification'
  );
}
capacitor.controls.navigationToolbar=cap(
  V,'capacitor-webview-navigation-toolbar',true,true,
  'Android API 35 regression and user-reported physical-device navigation-toolbar verification passed'
);
capacitor.controls.externalLinks=cap(
  V,'capacitor-bridge-webview-client-routing',true,true,
  'Android API 35 regression and user-reported physical-device external-link verification passed'
);
capacitor.controls.downloadManager=cap(
  V,'android-download-manager',true,true,
  'Android API 35 regression and user-reported physical-device download verification passed'
);

/* Cordova */
for(const id of ['camera','microphone','location','files']){
  cordova.permissions[id]=cap(
    V,
    'cordova-system-webview-runtime',
    true,
    true,
    'User-reported physical-device runtime verification passed after Android generator/build verification'
  );
}
cordova.permissions.notification=
  unsupported('Normal Web Notifications are not implemented for Cordova yet');
for(const id of ['media','contacts','calendar','biometrics','bluetooth','sensors']){
  cordova.permissions[id]=unsupported(
    'Android permission declaration alone is not a website-facing API; a secure Cordova bridge is not implemented'
  );
}
for(const id of ['transparentNav','pinchZoom']){
  cordova.controls[id]=cap(
    V,'cordova-android-control',true,true,
    'User-reported physical-device runtime verification passed after generated implementation/build verification'
  );
}
cordova.controls.navigationToolbar=cap(
  V,'cordova-system-webview-navigation-toolbar',true,true,
  'Android API 35 regression and user-reported physical-device navigation-toolbar verification passed'
);
cordova.controls.externalLinks=cap(
  V,'cordova-system-webview-client-routing',true,true,
  'Android API 35 regression and user-reported physical-device external-link verification passed'
);
cordova.controls.downloadManager=cap(
  V,'android-download-manager',true,true,
  'Android API 35 regression and user-reported physical-device download verification passed'
);

/* Firefox WebExtensions are intentionally Gecko-only. */
for(const engine of [native,capacitor,cordova]){
  for(const feature of FEATURES.extensions){
    engine.extensions[feature.id]=unsupported('Firefox WebExtension runtime is not available in this engine');
  }
}

/* AdGuard DNS needs a VPN/DNS layer and is not implemented. */
for(const engine of [native,gecko,capacitor,cordova]){
  engine.controls.adguardDns=unsupported('Requires a dedicated VPN/DNS layer that is not implemented');
}

export const ENGINE_CAPABILITIES=Object.freeze({
  native:Object.freeze(native),
  gecko:Object.freeze(gecko),
  capacitor:Object.freeze(capacitor),
  cordova:Object.freeze(cordova)
});

export function getCapability(engine,group,id){
  return ENGINE_CAPABILITIES?.[engine]?.[group]?.[id] ??
    unsupported('Capability is not implemented for this engine');
}

export function getSelectableFeatureIds(engine,group){
  const definitions=FEATURES[group] ?? [];
  return definitions
    .filter(feature=>getCapability(engine,group,feature.id).status!==CAPABILITY_STATUS.UNSUPPORTED)
    .map(feature=>feature.id);
}

export function validateCapabilitySelection(config={}){
  const errors=[];
  for(const group of ['permissions','controls','extensions']){
    const selected=Array.isArray(config[group]) ? config[group] : [];
    const known=new Set((FEATURES[group] ?? []).map(feature=>feature.id));
    for(const id of selected){
      if(!known.has(id)){
        errors.push(`Unknown ${group} capability: ${id}`);
        continue;
      }
      const capability=getCapability(config.engine,group,id);
      if(capability.status===CAPABILITY_STATUS.UNSUPPORTED){
        errors.push(`${id} is ${capability.status} on ${config.engine}: ${capability.reason}`);
      }
    }
  }
  return errors;
}
