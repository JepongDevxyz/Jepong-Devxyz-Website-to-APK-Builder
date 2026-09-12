import fs from 'node:fs';
import path from 'node:path';

function replaceOnce(source,needle,replacement,label){
  const first=source.indexOf(needle);
  if(first<0) throw new Error(`WebView startup marker missing: ${label}`);
  if(source.indexOf(needle,first+needle.length)>=0){
    throw new Error(`WebView startup marker ambiguous: ${label}`);
  }
  return source.slice(0,first)+replacement+source.slice(first+needle.length);
}

const capacitorReady=`      if(
        CAPACITOR_NAVIGATION_TOOLBAR_ENABLED
      ){
        installCapacitorNavigationToolbar(
          w
        );
      }else{
        applySystemSafeArea(
          w
        );
      }`;

const cordovaReady=`      if(
        CORDOVA_NAVIGATION_TOOLBAR_ENABLED
      ){
        installCordovaNavigationToolbar(
          w
        );
      }else{
        applySystemSafeArea(
          w
        );
      }`;

export function patchWebViewStartupSource(source,engine){
  let out=String(source);

  if(engine==='capacitor'){
    out=replaceOnce(
      out,
      capacitorReady,
      `${capacitorReady}\n\n      // Reload only after the custom client/listeners/layout are installed.\n      w.loadUrl(HOME);`,
      'capacitor post-wiring HOME load'
    );
    return out;
  }

  if(engine==='cordova'){
    out=replaceOnce(
      out,
      `    super.onCreate(\n      savedInstanceState\n    );`,
      `    android.util.Log.i(\"JepongCordovaStartup\",\"onCreate-enter\");\n    super.onCreate(\n      savedInstanceState\n    );\n    android.util.Log.i(\"JepongCordovaStartup\",\"after-super\");`,
      'cordova onCreate lifecycle'
    );
    out=replaceOnce(
      out,
      `    requestSelectedPermissions();`,
      `    android.util.Log.i(\"JepongCordovaStartup\",\"before-permissions\");\n    requestSelectedPermissions();\n    android.util.Log.i(\"JepongCordovaStartup\",\"after-permissions\");`,
      'cordova permission request lifecycle'
    );
    out=replaceOnce(
      out,
      `    loadUrl(launchUrl);\n\n`,
      `    // Initialize Cordova without starting navigation yet.\n    // CordovaActivity.loadUrl(...) normally performs this init step.\n    android.util.Log.i(\"JepongCordovaStartup\",\"before-init\");\n    init();\n    android.util.Log.i(\"JepongCordovaStartup\",\"after-init appView=\"+(appView!=null));\n\n`,
      'cordova premature launchUrl load'
    );
    out=replaceOnce(
      out,
      cordovaReady,
      `${cordovaReady}\n\n      // Load only after the custom client/listeners/layout are installed.\n      android.util.Log.i(\"JepongCordovaStartup\",\"before-home appView=\"+(appView!=null)+\" home=\"+HOME);\n      appView.loadUrl(HOME);\n      android.util.Log.i(\"JepongCordovaStartup\",\"after-home\");`,
      'cordova post-wiring HOME load'
    );
    return out;
  }

  return out;
}

export function patchWebViewStartup(cfg,projectDir){
  if(!cfg || !['capacitor','cordova'].includes(cfg.engine)) return false;

  const packagePath=String(cfg.packageName||'').replaceAll('.','/');
  const activityPath=path.join(
    projectDir,
    cfg.engine==='capacitor'
      ? 'android/app/src/main/java'
      : 'platforms/android/app/src/main/java',
    packagePath,
    'MainActivity.java'
  );

  if(!fs.existsSync(activityPath)){
    throw new Error(`WebView startup activity missing: ${activityPath}`);
  }

  const source=fs.readFileSync(activityPath,'utf8');
  const patched=patchWebViewStartupSource(source,cfg.engine);
  if(patched===source){
    throw new Error(`WebView startup patch made no changes for ${cfg.engine}`);
  }
  fs.writeFileSync(activityPath,patched);
  return true;
}
