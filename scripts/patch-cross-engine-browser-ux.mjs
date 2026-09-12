import fs from 'node:fs';
import path from 'node:path';
import {
  patchCrossEngineBrowserUx as patchCoreBrowserUx,
  patchCrossEngineBrowserUxSource
} from './patch-cross-engine-browser-ux-core.mjs';
import { patchWebViewStartup } from './patch-webview-startup.mjs';
import { patchCordovaAppCompatTheme } from './patch-cordova-appcompat-theme.mjs';

export { patchCrossEngineBrowserUxSource };

function patchCapacitorVisitedHistory(cfg,projectDir){
  if(!cfg || cfg.engine!=='capacitor'){
    return;
  }

  const activityPath=path.join(
    projectDir,
    'android/app/src/main/java',
    ...String(cfg.packageName||'').split('.'),
    'MainActivity.java'
  );

  if(!fs.existsSync(activityPath)){
    throw new Error(
      `Capacitor MainActivity missing for history patch: ${activityPath}`
    );
  }

  let source=fs.readFileSync(activityPath,'utf8');

  if(source.includes('doUpdateVisitedHistory(')){
    return;
  }

  const marker=`      owner
        .updateCapacitorNavigationButtons();
    }
  }`;

  if(!source.includes(marker)){
    throw new Error(
      'Capacitor history patch marker missing'
    );
  }

  const replacement=`      owner
        .updateCapacitorNavigationButtons();
    }

    @Override
    public void doUpdateVisitedHistory(
      WebView view,
      String url,
      boolean isReload
    ){
      super.doUpdateVisitedHistory(
        view,
        url,
        isReload
      );

      if(view!=null){
        view.post(
          owner::updateCapacitorNavigationButtons
        );
      }else{
        owner.updateCapacitorNavigationButtons();
      }
    }
  }`;

  source=source.replace(marker,replacement);
  fs.writeFileSync(activityPath,source);
}

export function patchCrossEngineBrowserUx(cfg,projectDir){
  const activityPath=patchCoreBrowserUx(cfg,projectDir);
  patchCordovaAppCompatTheme(cfg,projectDir);
  patchWebViewStartup(cfg,projectDir);
  patchCapacitorVisitedHistory(cfg,projectDir);
  return activityPath;
}
