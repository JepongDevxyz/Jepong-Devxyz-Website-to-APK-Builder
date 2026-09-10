import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, workDir, brandedAsset, mkdir, write, javaString } from './common.mjs';

const args=process.argv.slice(2);
const value=k=>{const i=args.indexOf(k); return i>=0?args[i+1]:''};
const buildId=value('--build-id');
const engine=value('--engine');
if(!buildId || !['capacitor','cordova'].includes(engine)) throw new Error('Usage: node scripts/patch-android-platform.mjs --build-id ID --engine capacitor|cordova');
const cfg=loadConfig(buildId);
const project=workDir(buildId);
const androidRoot=engine==='capacitor'?path.join(project,'android'):path.join(project,'platforms/android');
const appRoot=path.join(androidRoot,'app');
const manifestPath=path.join(appRoot,'src/main/AndroidManifest.xml');
if(!fs.existsSync(manifestPath)) throw new Error(`Android platform not generated: ${manifestPath}`);

const permissionMap={
 camera:['android.permission.CAMERA'], microphone:['android.permission.RECORD_AUDIO'], notification:['android.permission.POST_NOTIFICATIONS'],
 location:['android.permission.ACCESS_FINE_LOCATION','android.permission.ACCESS_COARSE_LOCATION'], media:['android.permission.READ_MEDIA_IMAGES','android.permission.READ_MEDIA_VIDEO'],
 contacts:['android.permission.READ_CONTACTS'], calendar:['android.permission.READ_CALENDAR','android.permission.WRITE_CALENDAR'], biometrics:['android.permission.USE_BIOMETRIC'], files:[],
 bluetooth:['android.permission.BLUETOOTH_SCAN','android.permission.BLUETOOTH_CONNECT'], sensors:['android.permission.BODY_SENSORS']
};
function setAttr(tag,name,value){const re=new RegExp(`\\s${name}="[^"]*"`); return re.test(tag)?tag.replace(re,` ${name}="${value}"`):tag.replace(/>$/,` ${name}="${value}">`);}
function patchManifest(){
 let xml=fs.readFileSync(manifestPath,'utf8');
 const wanted=new Set(['android.permission.INTERNET','android.permission.ACCESS_NETWORK_STATE']);
 for(const key of cfg.permissions||[]) for(const p of permissionMap[key]||[]) wanted.add(p);
 const lines=[];
 for(const p of wanted) if(!xml.includes(`android:name="${p}"`)) lines.push(`    <uses-permission android:name="${p}" />`);
 if((cfg.permissions||[]).includes('media')&&!xml.includes('android.permission.READ_EXTERNAL_STORAGE')) lines.push('    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />');
 if((cfg.permissions||[]).includes('bluetooth')){
   if(!xml.includes('android.permission.BLUETOOTH"')) lines.push('    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />');
   if(!xml.includes('android.permission.BLUETOOTH_ADMIN')) lines.push('    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />');
 }
 if(lines.length) xml=xml.replace(/<application\b/,`${lines.join('\n')}\n\n    <application`);
 xml=xml.replace(/<application\b[^>]*>/s,tag=>{
   tag=setAttr(tag,'android:icon','@drawable/app_icon');
   tag=setAttr(tag,'android:roundIcon','@drawable/app_icon');
   tag=setAttr(tag,'android:hardwareAccelerated',cfg.renderMode==='software'?'false':'true');
   tag=setAttr(tag,'android:usesCleartextTraffic','true');
   if(cfg.oneSignalAppId) tag=setAttr(tag,'android:name','.JepongApplication');
   return tag;
 });
 const orientation=cfg.orientation==='portrait'?'portrait':cfg.orientation==='landscape'?'landscape':'unspecified';
 xml=xml.replace(/<activity\b[^>]*android:name="[^"]*MainActivity"[^>]*>/s,tag=>setAttr(tag,'android:screenOrientation',orientation));
 fs.writeFileSync(manifestPath,xml);
}
function writeBranding(){
 const res=path.join(appRoot,'src/main/res/drawable-nodpi'); mkdir(res);
 const icon=brandedAsset(cfg,'icon'), splash=brandedAsset(cfg,'splash');
 write(path.join(res,`app_icon.${icon.ext}`),icon.buffer);
 write(path.join(res,`app_splash.${splash.ext}`),splash.buffer);
}
function injectDependency(dep){
 const candidates=[path.join(appRoot,'build.gradle'),path.join(appRoot,'build.gradle.kts')];
 const gradle=candidates.find(fs.existsSync); if(!gradle) throw new Error('Could not find app Gradle file');
 let s=fs.readFileSync(gradle,'utf8'); if(s.includes(dep)) return;
 const line=gradle.endsWith('.kts')?`    implementation("${dep}")`:`    implementation '${dep}'`;
 const idx=s.indexOf('dependencies {'); if(idx<0) throw new Error('No dependencies block in app Gradle');
 const pos=idx+'dependencies {'.length; s=s.slice(0,pos)+`\n${line}`+s.slice(pos); fs.writeFileSync(gradle,s);
}
function writeOneSignalApplication(){
 if(!cfg.oneSignalAppId)return;
 injectDependency('com.onesignal:OneSignal:5.9.8');
 const p=path.join(appRoot,'src/main/java',...cfg.packageName.split('.'),'JepongApplication.java');
 write(p,`package ${cfg.packageName};\nimport android.app.Application;\nimport com.onesignal.OneSignal;\npublic class JepongApplication extends Application { @Override public void onCreate(){ super.onCreate(); OneSignal.initWithContext(this, ${javaString(cfg.oneSignalAppId)}); } }\n`);
}
function activityBody(base){
 const layer=cfg.renderMode==='software'?'View.LAYER_TYPE_SOFTWARE':cfg.renderMode==='hardware'?'View.LAYER_TYPE_HARDWARE':'View.LAYER_TYPE_NONE';
 const transparent=(cfg.controls||[]).includes('transparentNav');
 const splash=cfg.splashEnabled!==false;
 const duration=Math.max(0,Math.min(15000,Number(cfg.splashDuration)||1500));
 const common=`${transparent?'if(Build.VERSION.SDK_INT>=29){getWindow().setNavigationBarColor(Color.TRANSPARENT); getWindow().setStatusBarColor(Color.TRANSPARENT);}':''}`;
 const overlay=splash?`ImageView brandSplash=new ImageView(this); brandSplash.setImageResource(R.drawable.app_splash); brandSplash.setScaleType(ImageView.ScaleType.CENTER_CROP); brandSplash.setBackgroundColor(Color.rgb(17,24,39)); addContentView(brandSplash,new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT)); brandSplash.bringToFront(); new Handler(Looper.getMainLooper()).postDelayed(()->{ ViewParent parent=brandSplash.getParent(); if(parent instanceof ViewGroup)((ViewGroup)parent).removeView(brandSplash); },${duration});`:'';
 if(base==='capacitor') return `package ${cfg.packageName};\n\nimport android.os.*;\nimport android.graphics.Color;\nimport android.view.*;\nimport android.widget.ImageView;\nimport android.webkit.WebView;\nimport com.getcapacitor.BridgeActivity;\n\npublic class MainActivity extends BridgeActivity {\n  @Override protected void onCreate(Bundle savedInstanceState){ super.onCreate(savedInstanceState); ${common} WebView w=getBridge()!=null?getBridge().getWebView():null; if(w!=null)w.setLayerType(${layer},null); ${overlay} }\n}\n`;
 return `package ${cfg.packageName};\n\nimport android.os.*;\nimport android.graphics.Color;\nimport android.view.*;\nimport android.widget.ImageView;\nimport org.apache.cordova.CordovaActivity;\n\npublic class MainActivity extends CordovaActivity {\n  @Override public void onCreate(Bundle savedInstanceState){ super.onCreate(savedInstanceState); ${common} loadUrl(launchUrl); if(appView!=null&&appView.getView()!=null) appView.getView().setLayerType(${layer},null); ${overlay} }\n  @Override protected boolean showInitialSplashScreen(){ return ${splash}; }\n}\n`;
}
function writeActivity(){
 const javaRoot=path.join(appRoot,'src/main/java');
 if(engine==='capacitor'){
   const p=path.join(javaRoot,...cfg.packageName.split('.'),'MainActivity.java'); write(p,activityBody('capacitor')); return;
 }
 // Cordova package is the widget id; remove any stale generated MainActivity to avoid duplicate classes.
 if(fs.existsSync(javaRoot)){
   const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name==='MainActivity.java'&&!p.endsWith(path.join(...cfg.packageName.split('.'),'MainActivity.java')))fs.rmSync(p);}}; walk(javaRoot);
 }
 write(path.join(javaRoot,...cfg.packageName.split('.'),'MainActivity.java'),activityBody('cordova'));
}
function patchCapacitorSplashStyle(){
 if(engine!=='capacitor')return;
 const styles=path.join(appRoot,'src/main/res/values/styles.xml'); if(!fs.existsSync(styles))return;
 let s=fs.readFileSync(styles,'utf8');
 // Keep Android's native launch splash, then our full-screen overlay presents the chosen image for the exact duration.
 if(!s.includes('name="jepongSplashBackground"')) s=s.replace('</resources>','    <color name="jepongSplashBackground">#111827</color>\n</resources>');
 fs.writeFileSync(styles,s);
}

patchManifest(); writeBranding(); writeOneSignalApplication(); writeActivity(); patchCapacitorSplashStyle();
console.log(`Patched ${engine} Android platform for ${buildId}`);
