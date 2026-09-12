import fs from 'node:fs';
import path from 'node:path';

export function patchModernBackManifest(out){
  const manifestPath=path.join(
    out,
    'app/src/main/AndroidManifest.xml'
  );

  let manifest=fs.readFileSync(
    manifestPath,
    'utf8'
  );

  const enabled='android:enableOnBackInvokedCallback="true"';

  if(manifest.includes(enabled)){
    return;
  }

  const applicationMarker='<application ';
  const count=manifest.split(applicationMarker).length-1;

  if(count!==1){
    throw new Error(
      `Expected exactly one <application> manifest marker; found ${count}`
    );
  }

  const existing=/android:enableOnBackInvokedCallback="[^"]*"/;

  if(existing.test(manifest)){
    manifest=manifest.replace(
      existing,
      enabled
    );
  }else{
    manifest=manifest.replace(
      applicationMarker,
      `${applicationMarker}${enabled} `
    );
  }

  fs.writeFileSync(
    manifestPath,
    manifest
  );
}
