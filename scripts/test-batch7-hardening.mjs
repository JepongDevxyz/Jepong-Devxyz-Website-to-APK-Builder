import fs from 'node:fs';

const native =
  fs.readFileSync('scripts/write-native.mjs','utf8');

const platform =
  fs.readFileSync('scripts/patch-android-platform.mjs','utf8');

const missing=[];

for(const token of [
  'android:configChanges=',
  'loader.setVisibility(View.GONE)',
  'void showExtensionLoader()',
  'void hideExtensionLoader()',
  'void showWebsiteLoader()',
  'diagnostics.setVisibility(View.GONE)',
  'verifyController.list().accept',
  'hideExtensionLoader();',
  'showWebsiteLoader();',
  'metaData.enabled',
  'EnableSource.APP',
  'Retry extensions',
  'Continue without failed extensions'
]){
  if(!native.includes(token)){
    missing.push(`write-native: ${token}`);
  }
}

for(const token of [
  'requiredConfigChanges',
  'android:configChanges'
]){
  if(!platform.includes(token)){
    missing.push(`android-platform: ${token}`);
  }
}

if(missing.length){
  console.error(
    'Expected RED — hardening not implemented yet:\n' +
    missing.map(x=>` - ${x}`).join('\n')
  );
  process.exit(1);
}

console.log(
  '✓ Cross-engine lifecycle + Gecko startup hardening regression'
);
