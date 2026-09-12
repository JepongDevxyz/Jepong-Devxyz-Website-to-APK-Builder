import fs from 'node:fs';
import { patchCordovaToolbarLayoutSource } from './patch-cordova-toolbar-layout.mjs';

const input=`void attachCordovaToolbar(WebView web,LinearLayout bar){
  LinearLayout shell=new LinearLayout(this);
  shell.addView(
    web,
    new LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      0,
      1f
    )
  );
}`;

const patched=patchCordovaToolbarLayoutSource(input,'cordova');
const compact=patched.replace(/\s+/g,'');

const required=[
  'FrameLayoutwebHost=newFrameLayout(this);',
  'webHost.addView(web,newFrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT,FrameLayout.LayoutParams.MATCH_PARENT));',
  'shell.addView(webHost,newLinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT,0,1f));'
];

for(const token of required){
  if(!compact.includes(token.replace(/\s+/g,''))){
    throw new Error(`Cordova toolbar layout contract missing: ${token}`);
  }
}

if(compact.includes('shell.addView(web,newLinearLayout.LayoutParams(')){
  throw new Error(
    'Cordova WebView must keep FrameLayout.LayoutParams for CordovaActivity insets handling'
  );
}

if(patchCordovaToolbarLayoutSource(input,'capacitor')!==input){
  throw new Error('Cordova toolbar layout patch must not mutate Capacitor');
}

const wrapper=fs.readFileSync(
  new URL('./patch-cross-engine-browser-ux.mjs',import.meta.url),
  'utf8'
);
if(!wrapper.includes("import { patchCordovaToolbarLayout } from './patch-cordova-toolbar-layout.mjs';")){
  throw new Error('Cross-engine patch pipeline must import Cordova toolbar layout patch');
}
if(!wrapper.includes('patchCordovaToolbarLayout(cfg,projectDir);')){
  throw new Error('Cross-engine patch pipeline must execute Cordova toolbar layout patch');
}

console.log('✓ Cordova toolbar preserves FrameLayout WebView layout params');
