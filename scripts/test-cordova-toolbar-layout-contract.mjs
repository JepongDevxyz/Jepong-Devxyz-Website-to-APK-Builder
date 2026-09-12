import fs from 'node:fs';

const source=fs.readFileSync(
  'scripts/patch-android-platform.mjs',
  'utf8'
);
const compact=source.replace(/\s+/g,'');

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

if(
  compact.includes(
    'shell.addView(web,newLinearLayout.LayoutParams('
  )
){
  throw new Error(
    'Cordova WebView must keep FrameLayout.LayoutParams for CordovaActivity insets handling'
  );
}

console.log('✓ Cordova toolbar preserves FrameLayout WebView layout params');
