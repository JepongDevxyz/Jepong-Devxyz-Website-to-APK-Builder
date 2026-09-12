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
if(!patchedCordova.includes('appView.loadUrl(HOME);')){
  throw new Error('Cordova startup must load HOME after runtime wiring');
}
if(patchedCordova.indexOf('appView.loadUrl(HOME);')<patchedCordova.indexOf('installCordovaNavigationToolbar')){
  throw new Error('Cordova HOME load must happen after toolbar/client wiring');
}

const integrator=fs.readFileSync(new URL('./patch-android-platform.mjs',import.meta.url),'utf8');
const importNeedle="import { patchWebViewStartup } from './patch-webview-startup.mjs';";
if(!integrator.includes(importNeedle)){
  throw new Error('Android platform patcher must import deterministic WebView startup patch');
}
const uxCall=integrator.indexOf('patchCrossEngineBrowserUx(cfg,project)');
const startupCall=integrator.indexOf('patchWebViewStartup(cfg,project)');
if(uxCall<0 || startupCall<0){
  throw new Error('Android platform patcher must execute deterministic WebView startup patch');
}
if(startupCall<uxCall){
  throw new Error('WebView startup patch must run after cross-engine browser UX wiring');
}

console.log('✓ deterministic Capacitor/Cordova startup patch');
