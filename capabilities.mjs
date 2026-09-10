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

function cap(
  status,
  implementation,
  compileVerified,
  runtimeVerified,
  reason
){
  return Object.freeze({
    status,
    implementation,
    compileVerified,
    runtimeVerified,
    reason
  });
}

const unsupported=(reason='Not implemented for this engine')=>
  cap(U,'none',false,false,reason);

function blankEngine(){
  const out={
    permissions:{},
    controls:{},
    extensions:{}
  };

  for(const group of Object.keys(FEATURES)){
    for(const feature of FEATURES[group]){
      out[group][feature.id]=
        unsupported();
    }
  }

  return out;
}

const native=blankEngine();
const gecko=blankEngine();
const capacitor=blankEngine();
const cordova=blankEngine();

/* -------------------------------------------------
   Native WebView
   Compile/generator foundations exist, but these
   remain Experimental until physical runtime tests.
-------------------------------------------------- */

native.permissions.camera=
  cap(
    E,
    'android-webview-media-permission',
    true,
    false,
    'WebView camera foundation exists but physical runtime verification is pending'
  );

native.permissions.microphone=
  cap(
    E,
    'android-webview-media-permission',
    true,
    false,
    'WebView microphone foundation exists but physical runtime verification is pending'
  );

native.permissions.location=
  cap(
    E,
    'android-webview-geolocation',
    true,
    false,
    'WebView geolocation foundation exists but physical runtime verification is pending'
  );

native.permissions.files=
  cap(
    E,
    'android-webview-file-chooser',
    true,
    false,
    'System file chooser is generated but physical runtime verification is pending'
  );

native.permissions.notification=
  cap(
    E,
    'native-android-notification-foundation',
    true,
    false,
    'Android notification permission wiring exists; complete Web Notification display behavior is still being added'
  );

for(const id of [
  'media',
  'contacts',
  'calendar',
  'biometrics',
  'bluetooth',
  'sensors'
]){
  native.permissions[id]=
    cap(
      E,
      'native-android-permission-foundation',
      true,
      false,
      'Android permission wiring exists; complete website-facing native effect is still being added'
    );
}

for(const id of [
  'pullRefresh',
  'hideScrollbars',
  'transparentNav',
  'pinchZoom',
  'disableCopy',
  'blockAdsRedirects'
]){
  native.controls[id]=
    cap(
      E,
      'native-webview-control',
      true,
      false,
      'Generated implementation exists but physical runtime verification is pending'
    );
}

native.controls.navigationToolbar=
  cap(
    E,
    'native-webview-navigation-toolbar',
    false,
    false,
    'Native navigation toolbar generator is implemented; Android CI and physical runtime verification are pending'
  );

/* -------------------------------------------------
   GeckoView
   Camera, microphone and location have already been
   physically tested. External-link routing was also
   physically observed.
-------------------------------------------------- */

gecko.permissions.camera=
  cap(
    V,
    'geckoview-permission-delegate',
    true,
    true,
    'Physical-device camera runtime test passed'
  );

gecko.permissions.microphone=
  cap(
    V,
    'geckoview-permission-delegate',
    true,
    true,
    'Physical-device microphone runtime test passed'
  );

gecko.permissions.location=
  cap(
    V,
    'geckoview-content-permission',
    true,
    true,
    'Physical-device Geolocation API runtime test passed'
  );

gecko.permissions.notification=
  cap(
    E,
    'geckoview-web-notification-delegate',
    false,
    false,
    'Implementation exists but current Android notification compile regression must be fixed and runtime-tested'
  );

gecko.permissions.files=
  cap(
    E,
    'geckoview-prompt-delegate-saf',
    true,
    false,
    'System file picker implementation compiles but physical runtime test is pending'
  );

for(const id of [
  'media',
  'contacts',
  'calendar',
  'biometrics',
  'bluetooth',
  'sensors'
]){
  gecko.permissions[id]=
    cap(
      E,
      'geckoview-android-permission-foundation',
      true,
      false,
      'Android permission foundation exists; complete website-facing native effect is still being added'
    );
}

gecko.controls.transparentNav=
  cap(
    E,
    'android-system-bars',
    true,
    false,
    'Generated implementation exists but dedicated runtime verification is pending'
  );

gecko.controls.navigationToolbar=
  cap(
    E,
    'geckoview-navigation-toolbar',
    true,
    false,
    'Toolbar renders on device but individual controls still require runtime verification'
  );

gecko.controls.externalLinks=
  cap(
    V,
    'geckoview-navigation-delegate',
    true,
    true,
    'Off-site user-clicked link was physically observed opening in the Android browser'
  );

gecko.controls.downloadManager=
  cap(
    E,
    'android-download-manager',
    true,
    false,
    'Download implementation compiles but physical runtime verification is pending'
  );

for(const id of [
  'adguard',
  'ghostery',
  'privacyBadger',
  'darkReader',
  'ublock'
]){
  gecko.extensions[id]=
    cap(
      E,
      'geckoview-webextension-controller',
      true,
      false,
      'Extension installation/diagnostics compile but physical runtime verification is pending'
    );
}

/* -------------------------------------------------
   Capacitor
-------------------------------------------------- */

for(const id of [
  'camera',
  'microphone',
  'location',
  'files'
]){
  capacitor.permissions[id]=
    cap(
      E,
      'capacitor-android-webview-foundation',
      true,
      false,
      'Android/WebView foundation exists but physical runtime verification is pending'
    );
}

capacitor.permissions.notification=
  cap(
    E,
    'capacitor-android-notification-foundation',
    true,
    false,
    'Android notification permission wiring exists; complete Web Notification display behavior is still being added'
  );

for(const id of [
  'media',
  'contacts',
  'calendar',
  'biometrics',
  'bluetooth',
  'sensors'
]){
  capacitor.permissions[id]=
    cap(
      E,
      'capacitor-android-permission-foundation',
      true,
      false,
      'Android permission wiring exists; complete website-facing native effect is still being added'
    );
}

for(const id of [
  'transparentNav',
  'pinchZoom'
]){
  capacitor.controls[id]=
    cap(
      E,
      'capacitor-android-control',
      true,
      false,
      'Generated implementation exists but physical runtime verification is pending'
    );
}

/* -------------------------------------------------
   Cordova
-------------------------------------------------- */

for(const id of [
  'camera',
  'microphone',
  'location',
  'files'
]){
  cordova.permissions[id]=
    cap(
      E,
      'cordova-android-webview-foundation',
      true,
      false,
      'Android/WebView foundation exists but physical runtime verification is pending'
    );
}

cordova.permissions.notification=
  cap(
    E,
    'cordova-android-notification-foundation',
    true,
    false,
    'Android notification permission wiring exists; complete Web Notification display behavior is still being added'
  );

for(const id of [
  'media',
  'contacts',
  'calendar',
  'biometrics',
  'bluetooth',
  'sensors'
]){
  cordova.permissions[id]=
    cap(
      E,
      'cordova-android-permission-foundation',
      true,
      false,
      'Android permission wiring exists; complete website-facing native effect is still being added'
    );
}

for(const id of [
  'transparentNav',
  'pinchZoom'
]){
  cordova.controls[id]=
    cap(
      E,
      'cordova-android-control',
      true,
      false,
      'Generated implementation exists but physical runtime verification is pending'
    );
}

/* Firefox WebExtensions are intentionally Gecko-only. */
for(const engine of [native,capacitor,cordova]){
  for(const feature of FEATURES.extensions){
    engine.extensions[feature.id]=
      unsupported(
        'Firefox WebExtension runtime is not available in this engine'
      );
  }
}

/* AdGuard DNS needs a VPN/DNS layer and is not implemented. */
for(const engine of [native,gecko,capacitor,cordova]){
  engine.controls.adguardDns=
    unsupported(
      'Requires a dedicated VPN/DNS layer that is not implemented'
    );
}

export const ENGINE_CAPABILITIES=
  Object.freeze({
    native:Object.freeze(native),
    gecko:Object.freeze(gecko),
    capacitor:Object.freeze(capacitor),
    cordova:Object.freeze(cordova)
  });

export function getCapability(
  engine,
  group,
  id
){
  return (
    ENGINE_CAPABILITIES?.[engine]?.[group]?.[id] ??
    unsupported(
      'Capability is not implemented for this engine'
    )
  );
}

export function getSelectableFeatureIds(
  engine,
  group
){
  const definitions=
    FEATURES[group] ?? [];

  return definitions
    .filter(
      feature=>
        getCapability(
          engine,
          group,
          feature.id
        ).status!==CAPABILITY_STATUS.UNSUPPORTED
    )
    .map(
      feature=>feature.id
    );
}

export function validateCapabilitySelection(
  config={}
){
  const errors=[];

  for(const group of [
    'permissions',
    'controls',
    'extensions'
  ]){
    const selected=
      Array.isArray(config[group])
        ? config[group]
        : [];

    const known=
      new Set(
        (FEATURES[group] ?? [])
          .map(feature=>feature.id)
      );

    for(const id of selected){
      if(!known.has(id)){
        errors.push(
          `Unknown ${group} capability: ${id}`
        );
        continue;
      }

      const capability=
        getCapability(
          config.engine,
          group,
          id
        );

      if(
        capability.status===
          CAPABILITY_STATUS.UNSUPPORTED
      ){
        errors.push(
          `${id} is ${capability.status} on ${config.engine}: ${capability.reason}`
        );
      }
    }
  }

  return errors;
}
