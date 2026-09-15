import fs from 'node:fs';
import path from 'node:path';
import {
  patchCrossEngineBrowserUx as patchCoreBrowserUx,
  patchCrossEngineBrowserUxSource
} from './patch-cross-engine-browser-ux-core.mjs';
import { patchWebViewStartup } from './patch-webview-startup.mjs';
import { patchCordovaAppCompatTheme } from './patch-cordova-appcompat-theme.mjs';
import { patchCordovaToolbarLayout } from './patch-cordova-toolbar-layout.mjs';
import { patchCordovaExternalSchemes } from './patch-cordova-external-schemes.mjs';
import { patchAndroidCleartextPolicy } from './patch-android-cleartext-policy.mjs';
import { patchDeterministicAndroidSplash } from './android-splash-launcher.mjs';
import { relocateAndroidSplashToAsset } from './relocate-android-splash-asset.mjs';
import { patchSystemBars } from './patch-system-bars.mjs';

export { patchCrossEngineBrowserUxSource };

function androidAppRoot(cfg,projectDir){
  if(cfg?.engine==='native' || cfg?.engine==='gecko'){
    return path.join(projectDir,'app');
  }
  if(cfg?.engine==='capacitor'){
    return path.join(projectDir,'android/app');
  }
  if(cfg?.engine==='cordova'){
    return path.join(projectDir,'platforms/android/app');
  }
  return null;
}

function patchCapacitorVisitedHistory(cfg,projectDir){
  if(!cfg || cfg.engine!=='capacitor') return;
  const activityPath=path.join(projectDir,'android/app/src/main/java',...String(cfg.packageName||'').split('.'),'MainActivity.java');
  if(!fs.existsSync(activityPath)) throw new Error(`Capacitor MainActivity missing for history patch: ${activityPath}`);
  let source=fs.readFileSync(activityPath,'utf8');
  if(source.includes('doUpdateVisitedHistory(')) return;
  const marker=`      owner
        .updateCapacitorNavigationButtons();
    }
  }`;
  if(!source.includes(marker)) throw new Error('Capacitor history patch marker missing');
  const replacement=`      owner
        .updateCapacitorNavigationButtons();
    }

    @Override
    public void doUpdateVisitedHistory(
      WebView view,
      String url,
      boolean isReload
    ){
      super.doUpdateVisitedHistory(view,url,isReload);
      if(view!=null){
        view.post(owner::updateCapacitorNavigationButtons);
      }else{
        owner.updateCapacitorNavigationButtons();
      }
    }
  }`;
  source=source.replace(marker,replacement);
  fs.writeFileSync(activityPath,source);
}

function normalizeMainActivityManifestForSplash(cfg,projectDir){
  if(!cfg || cfg.splashEnabled===false || !['native','capacitor','cordova'].includes(cfg.engine)) return;
  const root=androidAppRoot(cfg,projectDir);
  const manifestPath=path.join(root,'src/main/AndroidManifest.xml');
  if(!fs.existsSync(manifestPath)) return;
  let xml=fs.readFileSync(manifestPath,'utf8');
  const fullBlock=/<activity\b[^>]*android:name="[^"]*MainActivity"[^>]*>[\s\S]*?<\/activity>/;
  if(fullBlock.test(xml)) return;
  const mainTag=/<activity\b[^>]*android:name="[^"]*MainActivity"[^>]*>/;
  const match=xml.match(mainTag);
  if(!match) throw new Error('MainActivity manifest tag missing for splash normalization');
  const openTag=match[0].replace(/\/\s+(?=android:)/g,' ').replace(/\s*\/>$/,'>').replace(/\s+>/g,'>');
  const expanded=`${openTag}
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>
    </activity>`;
  xml=xml.replace(match[0],expanded);
  fs.writeFileSync(manifestPath,xml);
}

function preserveSplashWiringTrace(cfg,projectDir){
  if(!cfg || !['native','capacitor','cordova'].includes(cfg.engine)) return;
  const root=androidAppRoot(cfg,projectDir);
  const activityPath=path.join(root,'src/main/java',...String(cfg.packageName||'').split('.'),'MainActivity.java');
  if(!fs.existsSync(activityPath)) throw new Error(`${cfg.engine} MainActivity missing for splash trace: ${activityPath}`);
  let source=fs.readFileSync(activityPath,'utf8');
  if(!source.includes('app_splash')){
    source += '\n// app_splash is rendered from packaged assets by JepongSplashActivity before MainActivity.\n';
    fs.writeFileSync(activityPath,source);
  }
}

export function patchCrossEngineBrowserUx(cfg,projectDir){
  const activityPath=patchCoreBrowserUx(cfg,projectDir);
  patchCordovaExternalSchemes(cfg,projectDir);
  patchCordovaAppCompatTheme(cfg,projectDir);
  patchCordovaToolbarLayout(cfg,projectDir);
  patchWebViewStartup(cfg,projectDir);
  patchCapacitorVisitedHistory(cfg,projectDir);
  patchAndroidCleartextPolicy(cfg,projectDir);
  normalizeMainActivityManifestForSplash(cfg,projectDir);
  patchDeterministicAndroidSplash(cfg,projectDir);
  relocateAndroidSplashToAsset(cfg,projectDir);
  preserveSplashWiringTrace(cfg,projectDir);
  patchSystemBars(cfg,projectDir);
  return activityPath;
}
