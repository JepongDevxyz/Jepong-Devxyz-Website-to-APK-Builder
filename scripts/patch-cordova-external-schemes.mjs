import fs from 'node:fs';
import path from 'node:path';

const oldRouting=`    /*
      Only explicit HTTP/HTTPS off-site links are handled
      here. Other schemes stay with Cordova's own routing.
    */
    if(
      !\"http\".equalsIgnoreCase(scheme) &&
      !\"https\".equalsIgnoreCase(scheme)
    ){
      return false;
    }

    return !isHomeHost(
      uri.getHost()
    );`;

const newRouting=`    /*
      Android app links that must leave the WebView are
      explicitly allowlisted. The WebResourceRequest path
      is still guarded by request.hasGesture(), so scripts
      cannot silently launch external apps.
    */
    if(
      \"tel\".equalsIgnoreCase(scheme) ||
      \"mailto\".equalsIgnoreCase(scheme) ||
      \"sms\".equalsIgnoreCase(scheme) ||
      \"geo\".equalsIgnoreCase(scheme)
    ){
      return true;
    }

    if(
      !\"http\".equalsIgnoreCase(scheme) &&
      !\"https\".equalsIgnoreCase(scheme)
    ){
      return false;
    }

    return !isHomeHost(
      uri.getHost()
    );`;

export function patchCordovaExternalSchemeSource(source){
  const text=String(source);

  if(
    text.includes('\"tel\".equalsIgnoreCase(scheme)') &&
    text.includes('\"mailto\".equalsIgnoreCase(scheme)') &&
    text.includes('\"sms\".equalsIgnoreCase(scheme)') &&
    text.includes('\"geo\".equalsIgnoreCase(scheme)')
  ){
    return text;
  }

  const first=text.indexOf(oldRouting);

  if(first<0){
    throw new Error('Cordova external-scheme routing marker missing');
  }

  if(text.indexOf(oldRouting,first+oldRouting.length)>=0){
    throw new Error('Cordova external-scheme routing marker ambiguous');
  }

  return (
    text.slice(0,first)+
    newRouting+
    text.slice(first+oldRouting.length)
  );
}

export function patchCordovaExternalSchemes(cfg,projectDir){
  if(!cfg || cfg.engine!=='cordova'){
    return;
  }

  const activityPath=path.join(
    projectDir,
    'platforms/android/app/src/main/java',
    ...String(cfg.packageName||'').split('.'),
    'MainActivity.java'
  );

  if(!fs.existsSync(activityPath)){
    throw new Error(
      `Cordova MainActivity missing for external-scheme patch: ${activityPath}`
    );
  }

  const source=fs.readFileSync(activityPath,'utf8');
  const patched=patchCordovaExternalSchemeSource(source);

  if(patched!==source){
    fs.writeFileSync(activityPath,patched);
  }
}
