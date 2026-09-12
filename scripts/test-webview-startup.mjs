import fs from 'node:fs';
import { patchWebViewStartupSource } from './patch-webview-startup.mjs';

const capacitor=`class MainActivity {
  void onCreate(){
      if(
        CAPACITOR_NAVIGATION_TOOLBAR_ENABLED
      ){
        installCapacitorNavigationToolbar(
          w
        );
      }else{
        applySystemSafeArea(
          w
        );
      }
  }
}`;

const patchedCapacitor=patchWebViewStartupSource(capacitor,'capacitor');
if(!patchedCapacitor.includes('w.loadUrl(HOME);')){
  throw new Error('Capacitor startup must load HOME after runtime wiring');
}
if(patchedCapacitor.indexOf('w.loadUrl(HOME);')<patchedCapacitor.indexOf('installCapacitorNavigationToolbar')){
  throw new Error('Capacitor HOME load must happen after toolbar/client wiring');
}

const cordova=`class MainActivity {
  void onCreate(){
    super.onCreate(
      savedInstanceState
    );

    commonSetup();

    requestSelectedPermissions();

    loadUrl(launchUrl);

      if(
        CORDOVA_NAVIGATION_TOOLBAR_ENABLED
      ){
        installCordovaNavigationToolbar(
          w
        );
      }else{
        applySystemSafeArea(
          w
        );
      }
  }
}`;

const patchedCordova=patchWebViewStartupSource(cordova,'cordova');
if(patchedCordova.includes('loadUrl(launchUrl);')){
  throw new Error('Cordova must not race runtime wiring with the default launchUrl load');
}
if(!patchedCordova.includes('init();')){
  throw new Error('Cordova must initialize appView before deferred runtime wiring');
}
if(!patchedCordova.includes('appView.loadUrl(HOME);')){
  throw new Error('Cordova startup must load HOME after runtime wiring');
}
if(patchedCordova.indexOf('init();')>patchedCordova.indexOf('appView.loadUrl(HOME);')){
  throw new Error('Cordova init must happen before deferred HOME load');
}
if(patchedCordova.indexOf('appView.loadUrl(HOME);')<patchedCordova.indexOf('installCordovaNavigationToolbar')){
  throw new Error('Cordova HOME load must happen after toolbar/client wiring');
}
for(const marker of [
  'onCreate-enter',
  'after-super',
  'before-permissions',
  'after-permissions',
  'before-init',
  'after-init appView=',
  'before-home appView=',
  'after-home'
]){
  if(!patchedCordova.includes(marker)){
    throw new Error(`Cordova startup observability missing: ${marker}`);
  }
}

const platformPatcher=fs.readFileSync(new URL('./patch-android-platform.mjs',import.meta.url),'utf8');
const uxWrapper=fs.readFileSync(new URL('./patch-cross-engine-browser-ux.mjs',import.meta.url),'utf8');
const runtimeSmoke=fs.readFileSync(new URL('./runtime/webview-engine-controls-smoke-core.mjs',import.meta.url),'utf8');

if(!platformPatcher.includes("import { patchCrossEngineBrowserUx } from './patch-cross-engine-browser-ux.mjs';")){
  throw new Error('Android platform patcher must import the browser UX wrapper');
}
if(!platformPatcher.includes('patchCrossEngineBrowserUx(cfg,project)')){
  throw new Error('Android platform patcher must execute the browser UX wrapper');
}
if(!uxWrapper.includes("import { patchWebViewStartup } from './patch-webview-startup.mjs';")){
  throw new Error('Browser UX wrapper must import deterministic WebView startup patch');
}
const coreCall=uxWrapper.indexOf('patchCoreBrowserUx(cfg,projectDir)');
const startupCall=uxWrapper.indexOf('patchWebViewStartup(cfg,projectDir)');
if(coreCall<0 || startupCall<0){
  throw new Error('Browser UX wrapper must execute deterministic WebView startup patch');
}
if(startupCall<coreCall){
  throw new Error('WebView startup patch must run after core browser UX wiring');
}
if(!runtimeSmoke.includes('[${engine}-smoke] am-start')){
  throw new Error('WebView runtime smoke must print the exact am start result');
}

console.log('✓ deterministic Capacitor/Cordova startup patch');
