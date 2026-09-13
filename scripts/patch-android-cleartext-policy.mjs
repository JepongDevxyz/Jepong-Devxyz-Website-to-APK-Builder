import fs from 'node:fs';
import path from 'node:path';

export function androidCleartextAllowed(websiteUrl=''){
  return String(websiteUrl||'')
    .trim()
    .toLowerCase()
    .startsWith('http://');
}

export function patchAndroidCleartextPolicy(cfg,projectDir){
  if(!cfg || !['capacitor','cordova'].includes(cfg.engine)){
    return null;
  }

  const androidRoot=
    cfg.engine==='capacitor'
      ? path.join(projectDir,'android')
      : path.join(projectDir,'platforms/android');

  const manifestPath=path.join(
    androidRoot,
    'app/src/main/AndroidManifest.xml'
  );

  if(!fs.existsSync(manifestPath)){
    throw new Error(
      `Android manifest missing for cleartext policy patch: ${manifestPath}`
    );
  }

  let xml=fs.readFileSync(manifestPath,'utf8');
  const desired=androidCleartextAllowed(cfg.websiteUrl)?'true':'false';
  let matched=false;

  xml=xml.replace(
    /<application\b[^>]*>/s,
    tag=>{
      matched=true;
      const attr=/\sandroid:usesCleartextTraffic="[^"]*"/;
      return attr.test(tag)
        ? tag.replace(attr,` android:usesCleartextTraffic="${desired}"`)
        : tag.replace(/>$/,` android:usesCleartextTraffic="${desired}">`);
    }
  );

  if(!matched){
    throw new Error(
      `Android application tag missing for cleartext policy patch: ${manifestPath}`
    );
  }

  fs.writeFileSync(manifestPath,xml);
  return manifestPath;
}
