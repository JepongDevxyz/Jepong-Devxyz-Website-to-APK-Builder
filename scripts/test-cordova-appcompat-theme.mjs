import fs from 'node:fs';

const patcher=fs.readFileSync(new URL('./patch-android-platform.mjs',import.meta.url),'utf8');

if(!/engine\s*===\s*['"]cordova['"][\s\S]{0,240}android:theme[\s\S]{0,120}Theme\.AppCompat\.NoActionBar/.test(patcher)){
  throw new Error('Cordova MainActivity must be patched to Theme.AppCompat.NoActionBar');
}

if(!patcher.includes("tag=setAttr(tag,'android:theme','@style/Theme.AppCompat.NoActionBar')")){
  throw new Error('Cordova AppCompat theme patch must set the MainActivity android:theme explicitly');
}

console.log('✓ Cordova MainActivity uses an AppCompat theme');
