import path from 'node:path';
import { write, mkdir, escXml, javaString, brandedAsset } from './common.mjs';

const perms = {
  camera: ['android.permission.CAMERA'],
  microphone: ['android.permission.RECORD_AUDIO'],
  notification: ['android.permission.POST_NOTIFICATIONS'],
  location: ['android.permission.ACCESS_FINE_LOCATION','android.permission.ACCESS_COARSE_LOCATION'],
  media: ['android.permission.READ_MEDIA_IMAGES','android.permission.READ_MEDIA_VIDEO'],
  contacts: ['android.permission.READ_CONTACTS'],
  calendar: ['android.permission.READ_CALENDAR','android.permission.WRITE_CALENDAR'],
  biometrics: ['android.permission.USE_BIOMETRIC'],
  files: [],
  bluetooth: ['android.permission.BLUETOOTH_SCAN','android.permission.BLUETOOTH_CONNECT'],
  sensors: ['android.permission.BODY_SENSORS']
};

function manifestPermissions(cfg) {
  const set = new Set(['android.permission.INTERNET','android.permission.ACCESS_NETWORK_STATE']);
  for (const p of cfg.permissions || []) for (const name of (perms[p] || [])) set.add(name);
  const lines=[...set].map(p => `    <uses-permission android:name="${p}" />`);
  if ((cfg.permissions||[]).includes('media')) lines.push('    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />');
  if ((cfg.permissions||[]).includes('bluetooth')) {
    lines.push('    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />');
    lines.push('    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />');
  }
  return lines.join('\n');
}

function writeBranding(cfg,out){
  const res=path.join(out,'app/src/main/res/drawable-nodpi');
  mkdir(res);
  const icon=brandedAsset(cfg,'icon'), splash=brandedAsset(cfg,'splash');
  write(path.join(res,`app_icon.${icon.ext}`), icon.buffer);
  write(path.join(res,`app_splash.${splash.ext}`), splash.buffer);
}

export function writeNative(cfg, out, gecko=false) {
  mkdir(out);
  const pkg = cfg.packageName;
  const nsPath = pkg.replaceAll('.', '/');
  write(path.join(out, 'settings.gradle.kts'), `pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }\ndependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral(); ${gecko ? 'maven { url = uri("https://maven.mozilla.org/maven2/") }' : ''} } }\nrootProject.name = "${cfg.appName.replace(/[^A-Za-z0-9_-]/g,'') || 'JepongDevxyz'}"\ninclude(":app")\n`);
  write(path.join(out, 'build.gradle.kts'), `plugins {\n    id("com.android.application") version "9.4.0" apply false\n}\n`);
  write(path.join(out, 'gradle.properties'), `org.gradle.jvmargs=-Xmx3g -Dfile.encoding=UTF-8\nandroid.useAndroidX=true\n`);
  const oneSignal = cfg.oneSignalAppId ? `implementation("com.onesignal:OneSignal:5.9.8")` : '';
  const geckoDep = gecko ? `implementation("org.mozilla.geckoview:geckoview:154.0.20260824154132")` : '';
  write(path.join(out, 'app/build.gradle.kts'), `plugins { id("com.android.application") }\n\nandroid {\n    namespace = "${pkg}"\n    ${gecko ? 'compileSdk { version = release(37) { minorApiLevel = 1 } }' : 'compileSdk = 36'}\n    defaultConfig {\n        applicationId = "${pkg}"\n        ${gecko ? 'minSdk = 26' : 'minSdk = 24'}\n        targetSdk = 36\n        versionCode = ${Number(cfg.versionCode)}\n        versionName = ${JSON.stringify(cfg.versionName)}\n    }\n    buildTypes { release { isMinifyEnabled = false } }\n    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }\n}\n\ndependencies {\n    ${geckoDep}\n    ${oneSignal}\n}\n`);
  const orientation = cfg.orientation === 'portrait' ? 'portrait' : cfg.orientation === 'landscape' ? 'landscape' : 'unspecified';
  const hardware = cfg.renderMode === 'software' ? 'false' : 'true';
  const appClass = cfg.oneSignalAppId ? `android:name=".JepongApplication"` : '';
  write(path.join(out, 'app/src/main/AndroidManifest.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n${manifestPermissions(cfg)}\n    <application ${appClass} android:allowBackup="false" android:usesCleartextTraffic="true" android:hardwareAccelerated="${hardware}" android:theme="@style/AppTheme" android:label="${escXml(cfg.appName)}" android:icon="@drawable/app_icon" android:roundIcon="@drawable/app_icon">\n        <activity android:name=".MainActivity" android:exported="true" android:screenOrientation="${orientation}">\n            <intent-filter>\n                <action android:name="android.intent.action.MAIN" />\n                <category android:name="android.intent.category.LAUNCHER" />\n            </intent-filter>\n        </activity>\n    </application>\n</manifest>\n`);
  write(path.join(out, 'app/src/main/res/values/styles.xml'), `<resources>\n<style name="AppTheme" parent="android:style/Theme.Material.Light.NoActionBar"><item name="android:fontFamily">sans</item><item name="android:windowLightStatusBar">false</item><item name="android:statusBarColor">#111827</item><item name="android:navigationBarColor">#111827</item><item name="android:windowActionModeOverlay">true</item></style>\n</resources>`);
  writeBranding(cfg,out);
  write(path.join(out, 'app/src/main/assets/offline.html'), `<!doctype html><meta name="viewport" content="width=device-width"><style>body{font-family:system-ui;background:#111827;color:#fff;display:grid;place-items:center;height:100vh;margin:0;text-align:center}main{max-width:440px;padding:24px}</style><main><h1>${escXml(cfg.appName)}</h1><p>${escXml(cfg.offlineFallback || 'You appear to be offline. Check your connection and try again.')}</p></main>`);

  if (cfg.oneSignalAppId) write(path.join(out, `app/src/main/java/${nsPath}/JepongApplication.java`), `package ${pkg};\nimport android.app.Application;\nimport com.onesignal.OneSignal;\npublic class JepongApplication extends Application { @Override public void onCreate(){ super.onCreate(); OneSignal.initWithContext(this, ${javaString(cfg.oneSignalAppId)}); } }\n`);
  write(path.join(out, `app/src/main/java/${nsPath}/MainActivity.java`), gecko ? geckoActivity(cfg) : webViewActivity(cfg));
}

function javaPermissionBuilder(cfg){
  const p=cfg.permissions||[];
  const lines=[];
  if(p.includes('camera')) lines.push('p.add(Manifest.permission.CAMERA);');
  if(p.includes('microphone')) lines.push('p.add(Manifest.permission.RECORD_AUDIO);');
  if(p.includes('location')) lines.push('p.add(Manifest.permission.ACCESS_FINE_LOCATION); p.add(Manifest.permission.ACCESS_COARSE_LOCATION);');
  if(p.includes('contacts')) lines.push('p.add(Manifest.permission.READ_CONTACTS);');
  if(p.includes('calendar')) lines.push('p.add(Manifest.permission.READ_CALENDAR); p.add(Manifest.permission.WRITE_CALENDAR);');
  if(p.includes('sensors')) lines.push('p.add(Manifest.permission.BODY_SENSORS);');
  if(p.includes('notification')) lines.push('if(Build.VERSION.SDK_INT>=33) p.add(Manifest.permission.POST_NOTIFICATIONS);');
  if(p.includes('media')) lines.push('if(Build.VERSION.SDK_INT>=33){ p.add(Manifest.permission.READ_MEDIA_IMAGES); p.add(Manifest.permission.READ_MEDIA_VIDEO); } else { p.add(Manifest.permission.READ_EXTERNAL_STORAGE); }');
  if(p.includes('bluetooth')) lines.push('if(Build.VERSION.SDK_INT>=31){ p.add(Manifest.permission.BLUETOOTH_SCAN); p.add(Manifest.permission.BLUETOOTH_CONNECT); }');
  return lines.join('\n    ');
}

function splashMethods(cfg){
  const enabled=cfg.splashEnabled!==false;
  const duration=Math.max(0,Math.min(15000,Number(cfg.splashDuration)||1500));
  return `void begin(){\n    ${enabled ? `ImageView splash=new ImageView(this); splash.setImageResource(R.drawable.app_splash); splash.setScaleType(ImageView.ScaleType.CENTER_CROP); splash.setBackgroundColor(Color.rgb(17,24,39)); setContentView(splash); new Handler(Looper.getMainLooper()).postDelayed(this::checkPermissionsThenStart, ${duration});` : 'checkPermissionsThenStart();'}\n  }\n  void checkPermissionsThenStart(){ ArrayList<String> missing=new ArrayList<>(); for(String x:wantedPermissions()) if(Build.VERSION.SDK_INT>=23 && checkSelfPermission(x)!=PackageManager.PERMISSION_GRANTED) missing.add(x); if(!missing.isEmpty()){ requestPermissions(missing.toArray(new String[0]),700); } else startBrowser(); }\n  @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results){ super.onRequestPermissionsResult(code,permissions,results); if(code==700) startBrowser(); }\n  String[] wantedPermissions(){ ArrayList<String> p=new ArrayList<>(); ${javaPermissionBuilder(cfg)} return p.toArray(new String[0]); }`;
}

function webViewActivity(cfg) {
  const controls = cfg.controls || [];
  const pull = controls.includes('pullRefresh');
  const hideBars = controls.includes('hideScrollbars');
  const transparent = controls.includes('transparentNav');
  const zoom = controls.includes('pinchZoom');
  const noCopy = controls.includes('disableCopy');
  const block = controls.includes('blockAdsRedirects');
  const locationAllowed=(cfg.permissions||[]).includes('location');
  const layer = cfg.renderMode === 'software' ? 'View.LAYER_TYPE_SOFTWARE' : cfg.renderMode === 'hardware' ? 'View.LAYER_TYPE_HARDWARE' : 'View.LAYER_TYPE_NONE';
  return `package ${cfg.packageName};\n\nimport android.Manifest;\nimport android.app.*;\nimport android.os.*;\nimport android.graphics.Color;\nimport android.net.*;\nimport android.view.*;\nimport android.webkit.*;\nimport android.content.*;\nimport android.content.pm.PackageManager;\nimport android.widget.ImageView;\nimport java.util.*;\n\npublic class MainActivity extends Activity {\n  WebView web; float downY; ValueCallback<Uri[]> pending; boolean started=false; final String HOME=${javaString(cfg.websiteUrl)};\n  @Override public void onCreate(Bundle b){ super.onCreate(b); ${transparent ? 'if(Build.VERSION.SDK_INT>=29){getWindow().setNavigationBarColor(Color.TRANSPARENT); getWindow().setStatusBarColor(Color.TRANSPARENT);}' : ''} begin(); }\n  ${splashMethods(cfg)}\n  void startBrowser(){ if(started)return; started=true; web=new WebView(this); setContentView(web); web.setLayerType(${layer}, null);\n    WebSettings s=web.getSettings(); s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setMediaPlaybackRequiresUserGesture(false); s.setAllowFileAccess(false); s.setAllowContentAccess(true); s.setLoadWithOverviewMode(true); s.setUseWideViewPort(true); s.setBuiltInZoomControls(${zoom}); s.setDisplayZoomControls(false); s.setSupportZoom(${zoom});\n    web.setVerticalScrollBarEnabled(${!hideBars}); web.setHorizontalScrollBarEnabled(${!hideBars}); ${noCopy ? 'web.setLongClickable(false); web.setOnLongClickListener(v->true);' : ''}\n    web.setWebViewClient(new WebViewClient(){\n      @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r){ Uri u=r.getUrl(); ${block ? 'if(isBlocked(u)) return true; try{ Uri home=Uri.parse(HOME); if(!Objects.equals(home.getHost(),u.getHost())) { startActivity(new Intent(Intent.ACTION_VIEW,u)); return true; }}catch(Exception ignored){}' : ''} return false; }\n      @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r){ ${block ? 'if(isBlocked(r.getUrl())) return new WebResourceResponse("text/plain","utf-8",null);' : ''} return super.shouldInterceptRequest(v,r); }\n      @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e){ if(r.isForMainFrame()) v.loadUrl("file:///android_asset/offline.html"); }\n    });\n    web.setWebChromeClient(new WebChromeClient(){\n      @Override public void onPermissionRequest(PermissionRequest req){ runOnUiThread(() -> req.grant(req.getResources())); }\n      @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb){ cb.invoke(origin,${locationAllowed},false); }\n      @Override public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> cb, FileChooserParams p){ try{ if(pending!=null) pending.onReceiveValue(null); pending=cb; startActivityForResult(p.createIntent(),901); return true; }catch(Exception ex){ pending=null; return false; } }\n    });\n    ${pull ? 'web.setOnTouchListener((v,e)->{ if(e.getAction()==MotionEvent.ACTION_DOWN) downY=e.getY(); if(e.getAction()==MotionEvent.ACTION_UP && web.getScrollY()==0 && e.getY()-downY>180){ web.reload(); return true;} return false;});' : ''}\n    web.loadUrl(HOME);\n  }\n  @Override protected void onActivityResult(int req,int result,Intent data){ super.onActivityResult(req,result,data); if(req==901 && pending!=null){ pending.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data)); pending=null; } }\n  boolean isBlocked(Uri u){ String h=u.getHost(); if(h==null)return false; String x=h.toLowerCase(Locale.ROOT); String[] bad={"doubleclick.net","googlesyndication.com","googleadservices.com","adnxs.com","taboola.com","outbrain.com"}; for(String b:bad) if(x.equals(b)||x.endsWith("."+b)) return true; return false; }\n  @Override public void onBackPressed(){ if(web!=null&&web.canGoBack()) web.goBack(); else super.onBackPressed(); }\n}\n`;
}

function geckoActivity(cfg) {
  const extMap={adguard:'adguard-adblocker',ghostery:'ghostery',privacyBadger:'privacy-badger17',darkReader:'darkreader',ublock:'ublock-origin'};
  const installs=(cfg.extensions||[]).map(x=>extMap[x]).filter(Boolean).map(slug=>`controller.install("https://addons.mozilla.org/firefox/downloads/latest/${slug}/latest.xpi").exceptionally(e->{ android.util.Log.w("JepongExt", "Extension install failed: ${slug}", e); return null; });`).join('\n    ');
  const transparent=(cfg.controls||[]).includes('transparentNav');
  const hard=cfg.renderMode==='hardware';
  return `package ${cfg.packageName};\n\nimport android.Manifest;\nimport android.app.Activity;\nimport android.os.*;\nimport android.graphics.Color;\nimport android.view.View;\nimport android.content.pm.PackageManager;\nimport android.widget.ImageView;\nimport java.util.*;\nimport org.mozilla.geckoview.*;\n\npublic class MainActivity extends Activity {\n  GeckoRuntime runtime; GeckoSession session; GeckoView view; boolean started=false;\n  @Override public void onCreate(Bundle b){ super.onCreate(b); ${transparent ? 'if(Build.VERSION.SDK_INT>=29){getWindow().setNavigationBarColor(Color.TRANSPARENT); getWindow().setStatusBarColor(Color.TRANSPARENT);}' : ''} begin(); }\n  ${splashMethods(cfg)}\n  void startBrowser(){ if(started)return; started=true; view=new GeckoView(this); ${hard ? 'view.setLayerType(View.LAYER_TYPE_HARDWARE,null);' : ''} setContentView(view); runtime=GeckoRuntime.create(this);\n    WebExtensionController controller=runtime.getWebExtensionController();\n    controller.setPromptDelegate(new WebExtensionController.PromptDelegate(){\n      @Override public GeckoResult<WebExtension.PermissionPromptResponse> onInstallPromptRequest(WebExtension extension,String[] permissions,String[] origins,String[] dataCollectionPermissions){ return GeckoResult.fromValue(new WebExtension.PermissionPromptResponse(true,false,false)); }\n      @Override public GeckoResult<AllowOrDeny> onOptionalPrompt(WebExtension extension,String[] permissions,String[] origins,String[] dataCollectionPermissions){ return GeckoResult.fromValue(AllowOrDeny.ALLOW); }\n      @Override public GeckoResult<AllowOrDeny> onUpdatePrompt(WebExtension extension,String[] newPermissions,String[] newOrigins,String[] newDataCollectionPermissions){ return GeckoResult.fromValue(AllowOrDeny.ALLOW); }\n    });\n    session=new GeckoSession();\n    session.setPermissionDelegate(new GeckoSession.PermissionDelegate(){\n      @Override public void onAndroidPermissionsRequest(GeckoSession s,String[] permissions,Callback cb){ boolean ok=true; if(permissions!=null) for(String x:permissions) if(Build.VERSION.SDK_INT>=23 && checkSelfPermission(x)!=PackageManager.PERMISSION_GRANTED) ok=false; if(ok)cb.grant(); else cb.reject(); }\n      @Override public GeckoResult<Integer> onContentPermissionRequest(GeckoSession s,ContentPermission perm){ return GeckoResult.fromValue(ContentPermission.VALUE_ALLOW); }\n      @Override public void onMediaPermissionRequest(GeckoSession s,String uri,MediaSource[] video,MediaSource[] audio,MediaCallback cb){ MediaSource v=(video!=null&&video.length>0)?video[0]:null; MediaSource a=(audio!=null&&audio.length>0)?audio[0]:null; cb.grant(v,a); }\n    });\n    session.open(runtime); view.setSession(session); session.loadUri(${javaString(cfg.websiteUrl)});\n    ${installs}\n  }\n  @Override public void onBackPressed(){ if(session!=null) session.goBack(); else super.onBackPressed(); }\n}\n`;
}
