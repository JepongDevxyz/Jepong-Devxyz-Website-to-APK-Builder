import fs from 'node:fs';
import path from 'node:path';

const APP_COMPAT_THEME='@style/Theme.AppCompat.NoActionBar';

function setAttr(tag,name,value){
  const re=new RegExp(`\\s${name}="[^"]*"`);
  return re.test(tag)
    ? tag.replace(re,` ${name}="${value}"`)
    : tag.replace(/>$/,` ${name}="${value}">`);
}

export function patchCordovaAppCompatThemeSource(xml,engine='cordova'){
  const source=String(xml);
  if(engine!=='cordova') return source;

  let matched=false;
  const patched=source.replace(
    /<activity\b[^>]*android:name="[^"]*MainActivity"[^>]*>/s,
    tag=>{
      matched=true;
      return setAttr(tag,'android:theme',APP_COMPAT_THEME);
    }
  );

  if(!matched){
    throw new Error('Cordova MainActivity missing for AppCompat theme patch');
  }

  return patched;
}

export function patchCordovaAppCompatTheme(cfg,projectDir){
  if(!cfg || cfg.engine!=='cordova') return false;

  const manifestPath=path.join(
    projectDir,
    'platforms/android/app/src/main/AndroidManifest.xml'
  );

  if(!fs.existsSync(manifestPath)){
    throw new Error(`Cordova manifest missing for AppCompat theme patch: ${manifestPath}`);
  }

  const source=fs.readFileSync(manifestPath,'utf8');
  const patched=patchCordovaAppCompatThemeSource(source,'cordova');
  fs.writeFileSync(manifestPath,patched);
  return true;
}
