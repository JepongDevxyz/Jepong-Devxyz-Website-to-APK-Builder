import fs from 'node:fs';
import { patchCordovaAppCompatThemeSource } from './patch-cordova-appcompat-theme.mjs';

const input=`<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application>
    <activity android:name="com.example.MainActivity" android:theme="@android:style/Theme.DeviceDefault.NoActionBar" />
  </application>
</manifest>`;

const patched=patchCordovaAppCompatThemeSource(input,'cordova');
if(!patched.includes('android:theme="@style/Theme.AppCompat.NoActionBar"')){
  throw new Error('Cordova MainActivity must be patched to Theme.AppCompat.NoActionBar');
}
if(patched.includes('@android:style/Theme.DeviceDefault.NoActionBar')){
  throw new Error('Cordova non-AppCompat activity theme must be replaced');
}

const capacitor=patchCordovaAppCompatThemeSource(input,'capacitor');
if(capacitor!==input){
  throw new Error('Cordova AppCompat theme patch must not mutate Capacitor manifests');
}

const wrapper=fs.readFileSync(new URL('./patch-cross-engine-browser-ux.mjs',import.meta.url),'utf8');
if(!wrapper.includes("import { patchCordovaAppCompatTheme } from './patch-cordova-appcompat-theme.mjs';")){
  throw new Error('Cross-engine patch pipeline must import Cordova AppCompat theme patch');
}
if(!wrapper.includes('patchCordovaAppCompatTheme(cfg,projectDir);')){
  throw new Error('Cross-engine patch pipeline must execute Cordova AppCompat theme patch');
}

console.log('✓ Cordova MainActivity uses an AppCompat theme without changing Capacitor');
