import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=path.resolve(process.cwd());

const builds=[
  {
    id:'test-browser-ux-native',
    engine:'native',
    packageName:'com.jepongdevxyz.uxnative'
  },
  {
    id:'test-browser-ux-gecko',
    engine:'gecko',
    packageName:'com.jepongdevxyz.uxgecko'
  }
];

function config(item){
  return {
    websiteUrl:'https://example.com',
    appName:'Browser UX Test',
    packageName:item.packageName,
    versionName:'1.0.0',
    versionCode:1,
    engine:item.engine,
    renderMode:'default',
    orientation:'auto',

    permissions:[],

    controls:[
      'navigationToolbar',
      'transparentNav'
    ],

    extensions:[],

    oneSignalAppId:'',
    offlineFallback:'Offline',

    iconDataUrl:'',
    splashDataUrl:'',

    splashEnabled:false,
    splashDuration:0,

    apkSigner:false,
    sizeOptimization:false,
    abiTarget:'universal'
  };
}

function cleanup(){
  for(const item of builds){
    fs.rmSync(
      path.join(root,'work',item.id),
      {
        recursive:true,
        force:true
      }
    );

    fs.rmSync(
      path.join(
        root,
        'builds',
        `${item.id}.json`
      ),
      {
        force:true
      }
    );
  }
}

cleanup();
process.on('exit',cleanup);

for(const item of builds){

  fs.mkdirSync(
    path.join(root,'builds'),
    {
      recursive:true
    }
  );

  fs.writeFileSync(
    path.join(
      root,
      'builds',
      `${item.id}.json`
    ),
    JSON.stringify(
      config(item),
      null,
      2
    )
  );

  const run=
    spawnSync(
      process.execPath,
      [
        'scripts/build.mjs',
        'generate',
        '--build-id',
        item.id
      ],
      {
        cwd:root,
        encoding:'utf8'
      }
    );

  if(run.status!==0){
    throw new Error(
      `${item.engine} generation failed:\n`+
      run.stderr
    );
  }

  const main=
    fs.readFileSync(
      path.join(
        root,
        'work',
        item.id,
        'project',
        'app/src/main/java',
        ...item.packageName.split('.'),
        'MainActivity.java'
      ),
      'utf8'
    );

  const required=[
    'applySystemSafeArea',
    'setDecorFitsSystemWindows(false)',
    'navigationProgress',
    'showNavigationProgress',
    'finishNavigationProgress',
    'Powered by Jepong Devxyz',
    'showExitConfirmation',
    'handleAppBack',
    'registerOnBackInvokedCallback',
    'Color.rgb(0,229,255)',
    'setScaleY(1.8f)'
  ];

  const compactMain=
    main.replace(/\s+/g,'');

  for(const token of required){
    const compactToken=
      token.replace(/\s+/g,'');

    if(
      !compactMain.includes(
        compactToken
      )
    ){
      throw new Error(
        `${item.engine} browser UX missing: ${token}`
      );
    }
  }

  if(
    item.engine==='gecko'
  ){
    for(const token of [
      'recoverableWebsiteTimeout',
      'Finishing website...',
      'Website loading timed out.',
      'loadingBar.getProgress()>=100'
    ]){
      if(
        !compactMain.includes(
          token.replace(/\s+/g,'')
        )
      ){
        throw new Error(
          `gecko auto recovery missing: ${token}`
        );
      }
    }
  }
}

console.log(
  '✓ Cross-engine safe-area/navigation-loading UX regression'
);
