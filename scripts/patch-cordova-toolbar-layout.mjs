import fs from 'node:fs';
import path from 'node:path';

const DIRECT_LINEAR_WEBVIEW=/shell\.addView\(\s*web,\s*new LinearLayout\.LayoutParams\(\s*LinearLayout\.LayoutParams\.MATCH_PARENT,\s*0,\s*1f\s*\)\s*\);/m;

const FRAME_HOST=`FrameLayout webHost=
      new FrameLayout(this);

    webHost.addView(
      web,
      new FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT
      )
    );

    shell.addView(
      webHost,
      new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        0,
        1f
      )
    );`;

export function patchCordovaToolbarLayoutSource(source,engine='cordova'){
  const input=String(source);
  if(engine!=='cordova') return input;
  if(input.includes('FrameLayout webHost=')) return input;
  if(!DIRECT_LINEAR_WEBVIEW.test(input)){
    throw new Error('Cordova direct LinearLayout WebView marker missing');
  }
  return input.replace(DIRECT_LINEAR_WEBVIEW,FRAME_HOST);
}

export function patchCordovaToolbarLayout(cfg,projectDir){
  if(!cfg || cfg.engine!=='cordova') return false;

  const activityPath=path.join(
    projectDir,
    'platforms/android/app/src/main/java',
    ...String(cfg.packageName||'').split('.'),
    'MainActivity.java'
  );

  if(!fs.existsSync(activityPath)){
    throw new Error(`Cordova MainActivity missing for toolbar layout patch: ${activityPath}`);
  }

  const source=fs.readFileSync(activityPath,'utf8');
  const patched=patchCordovaToolbarLayoutSource(source,'cordova');
  fs.writeFileSync(activityPath,patched);
  return true;
}
