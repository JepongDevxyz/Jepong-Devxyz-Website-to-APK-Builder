import fs from 'node:fs';

const source=
  fs.readFileSync(
    'scripts/patch-android-platform.mjs',
    'utf8'
  );

const compact=
  source.replace(/\s+/g,'');

const required=[
  'voidattachCapacitorToolbar(',
  'voidattachCordovaToolbar(',
  'parent.removeView(web);',
  'shell.addView(',
  'parent.addView(shell'
];

const missing=
  required.filter(
    token=>!compact.includes(
      token.replace(/\s+/g,'')
    )
  );

if(missing.length){
  throw new Error(
    'Toolbar structural-layout fix missing: '+
    missing.join(', ')
  );
}

if(
  compact.includes(
    'addContentView(bar,params)'
  )
){
  throw new Error(
    'Toolbar still uses overlay addContentView()'
  );
}

if(
  compact.includes(
    'web.setPadding('
  )
){
  throw new Error(
    'Toolbar still uses WebView padding instead of structural layout'
  );
}

console.log(
  '✓ Capacitor/Cordova toolbar uses non-overlapping structural layout'
);
