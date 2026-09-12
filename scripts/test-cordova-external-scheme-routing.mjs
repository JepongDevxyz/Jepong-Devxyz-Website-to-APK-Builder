import fs from 'node:fs';
import {patchCordovaExternalSchemeSource} from './patch-cordova-external-schemes.mjs';

const generator=fs.readFileSync(
  new URL('./patch-android-platform.mjs',import.meta.url),
  'utf8'
);

const wrapper=fs.readFileSync(
  new URL('./patch-cross-engine-browser-ux.mjs',import.meta.url),
  'utf8'
);

if(!generator.includes('request.hasGesture()')){
  throw new Error('Cordova external app routing must remain user-gesture gated');
}

if(
  !wrapper.includes("import { patchCordovaExternalSchemes } from './patch-cordova-external-schemes.mjs';") ||
  !wrapper.includes('patchCordovaExternalSchemes(cfg,projectDir);')
){
  throw new Error('Cordova external-scheme patch must be wired into Android platform patching');
}

const oldRouting=`    /*
      Only explicit HTTP/HTTPS off-site links are handled
      here. Other schemes stay with Cordova's own routing.
    */
    if(
      !"http".equalsIgnoreCase(scheme) &&
      !"https".equalsIgnoreCase(scheme)
    ){
      return false;
    }

    return !isHomeHost(
      uri.getHost()
    );`;

const patched=patchCordovaExternalSchemeSource(
  `before\n${oldRouting}\nafter`
);

for(const scheme of ['tel','mailto','sms','geo']){
  const token=`"${scheme}".equalsIgnoreCase(scheme)`;
  if(!patched.includes(token)){
    throw new Error(`Cordova external routing must explicitly support ${scheme}: links`);
  }
}

if(!patched.includes('!"http".equalsIgnoreCase(scheme)')){
  throw new Error('Unknown custom schemes must still be rejected by default');
}

if(patched.includes('"intent".equalsIgnoreCase(scheme)')){
  throw new Error('Cordova external routing must not blanket-allow intent: links');
}

console.log('✓ Cordova user-gesture external app schemes are routed explicitly');
