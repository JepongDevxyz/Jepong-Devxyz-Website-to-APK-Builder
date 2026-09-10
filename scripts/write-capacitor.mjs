import path from 'node:path';
import { write, mkdir, brandedAsset } from './common.mjs';

export function writeCapacitor(cfg, out) {
  mkdir(out);
  const deps={
    '@capacitor/core':'8.5.0',
    '@capacitor/android':'8.5.0',
    '@capacitor/cli':'8.5.0',
    '@capacitor/splash-screen':'8.0.2'
  };
  write(path.join(out,'package.json'), JSON.stringify({ name:'jepong-generated-capacitor', version:'1.0.0', private:true, type:'module', dependencies:deps }, null, 2));
  const splashDuration=cfg.splashEnabled===false?0:Math.max(0,Math.min(15000,Number(cfg.splashDuration)||1500));
  const cap={
    appId:cfg.packageName,
    appName:cfg.appName,
    webDir:'www',
    server:{ url:cfg.websiteUrl, cleartext:cfg.websiteUrl.startsWith('http:') },
    android:{ allowMixedContent:true },
    plugins:{ SplashScreen:{ launchShowDuration:splashDuration, launchAutoHide:true, launchFadeOutDuration:200, backgroundColor:'#111827', androidSplashResourceName:'app_splash', androidScaleType:'CENTER_CROP', showSpinner:false } }
  };
  write(path.join(out,'capacitor.config.json'), JSON.stringify(cap, null, 2));
  write(path.join(out,'www/index.html'), `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(cfg.appName)}</title><style>body{background:#111827;color:#fff;font-family:system-ui;display:grid;place-items:center;min-height:100vh}</style><p>Loading ${escapeHtml(cfg.appName)}…</p>`);
  mkdir(path.join(out,'branding'));
  const icon=brandedAsset(cfg,'icon'), splash=brandedAsset(cfg,'splash');
  write(path.join(out,`branding/app_icon.${icon.ext}`),icon.buffer);
  write(path.join(out,`branding/app_splash.${splash.ext}`),splash.buffer);
  write(path.join(out,'jepong-config.json'), JSON.stringify(cfg,null,2));
}
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
