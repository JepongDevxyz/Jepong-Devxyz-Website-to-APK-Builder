import fs from 'node:fs';
import path from 'node:path';

function mkdir(dir){
  fs.mkdirSync(dir,{recursive:true});
}

function normalizedDuration(value){
  return Math.max(
    0,
    Math.min(
      15000,
      Number(value)||1500
    )
  );
}

function javaPackagePath(packageName){
  return String(packageName||'')
    .split('.')
    .filter(Boolean);
}

function resolveAppRoot(cfg,projectDir){
  switch(cfg?.engine){
    case 'native':
    case 'gecko':
      return path.join(projectDir,'app');
    case 'capacitor':
      return path.join(projectDir,'android','app');
    case 'cordova':
      return path.join(projectDir,'platforms','android','app');
    default:
      return null;
  }
}

function removeLauncherIntentFromMainActivity(xml){
  const activityRe=/<activity\b[^>]*android:name="[^"]*MainActivity"[^>]*>[\s\S]*?<\/activity>/;
  const match=xml.match(activityRe);

  if(!match){
    throw new Error('MainActivity manifest block missing for splash launcher');
  }

  const mainBlock=match[0];
  const stripped=mainBlock.replace(
    /\s*<intent-filter\b[^>]*>[\s\S]*?<\/intent-filter>/g,
    block=>{
      const isLauncher=
        block.includes('android.intent.action.MAIN') &&
        block.includes('android.intent.category.LAUNCHER');

      return isLauncher ? '' : block;
    }
  );

  if(stripped===mainBlock){
    throw new Error('MainActivity launcher intent-filter missing');
  }

  return xml.replace(mainBlock,stripped);
}

function launcherActivityXml(orientation){
  return `
        <activity
            android:name=".JepongSplashActivity"
            android:exported="true"
            android:screenOrientation="${orientation}"
            android:theme="@style/JepongSplashTheme">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>`;
}

function patchManifest({manifestPath,orientation}){
  let xml=fs.readFileSync(manifestPath,'utf8');

  xml=xml.replace(
    /\s*<activity\b[^>]*android:name="\.JepongSplashActivity"[^>]*>[\s\S]*?<\/activity>/g,
    ''
  );

  xml=removeLauncherIntentFromMainActivity(xml);

  const mainIndex=xml.search(
    /<activity\b[^>]*android:name="[^"]*MainActivity"/
  );

  if(mainIndex<0){
    throw new Error('Unable to insert splash launcher before MainActivity');
  }

  xml=
    xml.slice(0,mainIndex)+
    launcherActivityXml(orientation)+'\n        '+
    xml.slice(mainIndex);

  fs.writeFileSync(manifestPath,xml);
}

function writeSplashActivity({appRoot,packageName,durationMs}){
  const javaDir=path.join(
    appRoot,
    'src/main/java',
    ...javaPackagePath(packageName)
  );
  mkdir(javaDir);

  const source=`package ${packageName};

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;
import android.widget.ImageView;

public class JepongSplashActivity extends Activity {
  private static final long SPLASH_DURATION_MS=${durationMs}L;

  @Override
  protected void onCreate(Bundle savedInstanceState){
    super.onCreate(savedInstanceState);

    getWindow().setFlags(
      WindowManager.LayoutParams.FLAG_FULLSCREEN,
      WindowManager.LayoutParams.FLAG_FULLSCREEN
    );

    ImageView splash=new ImageView(this);
    splash.setImageResource(R.drawable.app_splash);
    splash.setScaleType(ImageView.ScaleType.CENTER_CROP);
    splash.setBackgroundColor(Color.rgb(17,24,39));
    setContentView(splash);

    new Handler(Looper.getMainLooper()).postDelayed(
      ()->{
        if(isFinishing()){
          return;
        }

        Intent intent=new Intent(this,MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NO_ANIMATION);
        startActivity(intent);
        overridePendingTransition(0,0);
        finish();
      },
      SPLASH_DURATION_MS
    );
  }
}
`;

  fs.writeFileSync(
    path.join(javaDir,'JepongSplashActivity.java'),
    source
  );
}

function writeSplashThemes(appRoot){
  const values=path.join(appRoot,'src/main/res/values');
  const valuesV31=path.join(appRoot,'src/main/res/values-v31');
  mkdir(values);
  mkdir(valuesV31);

  const base=`<resources>
  <style name="JepongSplashTheme" parent="android:style/Theme.Material.Light.NoActionBar">
    <item name="android:windowFullscreen">true</item>
    <item name="android:windowNoTitle">true</item>
    <item name="android:windowActionModeOverlay">true</item>
    <item name="android:windowBackground">#111827</item>
  </style>
</resources>
`;

  const api31=`<resources>
  <style name="JepongSplashTheme" parent="android:style/Theme.Material.Light.NoActionBar">
    <item name="android:windowFullscreen">true</item>
    <item name="android:windowNoTitle">true</item>
    <item name="android:windowActionModeOverlay">true</item>
    <item name="android:windowBackground">#111827</item>
    <item name="android:windowSplashScreenBackground">#111827</item>
    <item name="android:windowSplashScreenAnimatedIcon">@drawable/app_splash</item>
    <item name="android:windowSplashScreenAnimationDuration">0</item>
  </style>
</resources>
`;

  fs.writeFileSync(
    path.join(values,'jepong_splash.xml'),
    base
  );
  fs.writeFileSync(
    path.join(valuesV31,'jepong_splash.xml'),
    api31
  );
}

function ensureSplashAsset(appRoot){
  const dir=path.join(appRoot,'src/main/res/drawable-nodpi');

  if(!fs.existsSync(dir)){
    throw new Error('Splash drawable directory missing');
  }

  const found=fs.readdirSync(dir).some(
    name=>/^app_splash\.(?:png|webp|jpe?g)$/i.test(name)
  );

  if(!found){
    throw new Error('Custom app_splash drawable missing');
  }
}

function disableLegacySplash({cfg,appRoot,durationMs}){
  const activityPath=path.join(
    appRoot,
    'src/main/java',
    ...javaPackagePath(cfg.packageName),
    'MainActivity.java'
  );

  if(!fs.existsSync(activityPath)){
    throw new Error(`MainActivity missing for splash patch: ${activityPath}`);
  }

  let source=fs.readFileSync(activityPath,'utf8');

  if(cfg.engine==='native' || cfg.engine==='gecko'){
    const start=source.indexOf('void begin(){');
    const next=source.indexOf('void checkPermissionsThenStart(){',start);

    if(start<0 || next<0){
      throw new Error(`${cfg.engine} legacy splash markers missing`);
    }

    source=
      source.slice(0,start)+
      'void begin(){\n    checkPermissionsThenStart();\n  }\n\n  '+
      source.slice(next);
  }

  if(cfg.engine==='capacitor' || cfg.engine==='cordova'){
    const legacy=`ImageView brandSplash=new ImageView(this); brandSplash.setImageResource(R.drawable.app_splash); brandSplash.setScaleType(ImageView.ScaleType.CENTER_CROP); brandSplash.setBackgroundColor(Color.rgb(17,24,39)); addContentView(brandSplash,new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT)); brandSplash.bringToFront(); new Handler(Looper.getMainLooper()).postDelayed(()->{ ViewParent parent=brandSplash.getParent(); if(parent instanceof ViewGroup)((ViewGroup)parent).removeView(brandSplash); },${durationMs});`;

    if(!source.includes(legacy)){
      throw new Error(`${cfg.engine} legacy splash overlay marker missing`);
    }

    source=source.replace(legacy,'');
  }

  if(cfg.engine==='cordova'){
    source=source.replace(
      /protected boolean showInitialSplashScreen\(\)\{\s*return true;\s*\}/,
      'protected boolean showInitialSplashScreen(){\n    return false;\n  }'
    );
  }

  fs.writeFileSync(activityPath,source);
}

export function installAndroidSplashLauncher({
  appRoot,
  packageName,
  durationMs,
  enabled,
  orientation='unspecified'
}){
  if(!enabled){
    return false;
  }

  const manifestPath=path.join(
    appRoot,
    'src/main/AndroidManifest.xml'
  );

  if(!fs.existsSync(manifestPath)){
    throw new Error(`Android manifest missing: ${manifestPath}`);
  }

  ensureSplashAsset(appRoot);
  patchManifest({manifestPath,orientation});
  writeSplashActivity({
    appRoot,
    packageName,
    durationMs:normalizedDuration(durationMs)
  });
  writeSplashThemes(appRoot);

  return true;
}

export function patchDeterministicAndroidSplash(cfg,projectDir){
  if(
    !cfg ||
    !['native','gecko','capacitor','cordova'].includes(cfg.engine)
  ){
    return false;
  }

  if(cfg.splashEnabled===false){
    return false;
  }

  const appRoot=resolveAppRoot(cfg,projectDir);
  const durationMs=normalizedDuration(cfg.splashDuration);
  const orientation=
    cfg.orientation==='portrait'
      ? 'portrait'
      : cfg.orientation==='landscape'
        ? 'landscape'
        : 'unspecified';

  ensureSplashAsset(appRoot);
  disableLegacySplash({cfg,appRoot,durationMs});

  return installAndroidSplashLauncher({
    appRoot,
    packageName:cfg.packageName,
    durationMs,
    enabled:true,
    orientation
  });
}
