import fs from 'node:fs';
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
  // Gecko ARM64 APK size optimization.
  // Without an ABI filter Android packages every available Gecko native ABI.
  if (
    gecko &&
    cfg.sizeOptimization === true &&
    cfg.abiTarget === 'arm64-v8a'
  ) {
    const gradlePath=
      path.join(out,'app/build.gradle.kts');

    let gradle=
      fs.readFileSync(
        gradlePath,
        'utf8'
      );

    const marker=
      `        versionName = ${JSON.stringify(cfg.versionName)}\n    }`;

    if(!gradle.includes(marker)){
      throw new Error(
        'Unable to inject Gecko ARM64 ABI filter'
      );
    }

    gradle=
      gradle.replace(
        marker,
        `        versionName = ${JSON.stringify(cfg.versionName)}\n        ndk { abiFilters += listOf("arm64-v8a") }\n    }`
      );

    fs.writeFileSync(
      gradlePath,
      gradle
    );
  }

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

function splashMethods(cfg,deferRuntimePermissions=false){
  const enabled=cfg.splashEnabled!==false;

  const duration=
    Math.max(
      0,
      Math.min(
        15000,
        Number(cfg.splashDuration)||1500
      )
    );

  const permissionFlow=
    deferRuntimePermissions
      ? 'startBrowser();'
      : `ArrayList<String> missing=new ArrayList<>();
    for(String x:wantedPermissions()){
      if(
        Build.VERSION.SDK_INT>=23 &&
        checkSelfPermission(x)!=PackageManager.PERMISSION_GRANTED
      ){
        missing.add(x);
      }
    }
    if(!missing.isEmpty()){
      requestPermissions(
        missing.toArray(new String[0]),
        700
      );
    }else{
      startBrowser();
    }`;

  const permissionResult=
    deferRuntimePermissions
      ? ''
      : `@Override
  public void onRequestPermissionsResult(
    int code,
    String[] permissions,
    int[] results
  ){
    super.onRequestPermissionsResult(
      code,
      permissions,
      results
    );

    if(code==700){
      startBrowser();
    }
  }`;

  return `void begin(){
    ${enabled
      ? `ImageView splash=new ImageView(this);
    splash.setImageResource(R.drawable.app_splash);
    splash.setScaleType(ImageView.ScaleType.CENTER_CROP);
    splash.setBackgroundColor(Color.rgb(17,24,39));
    setContentView(splash);

    new Handler(
      Looper.getMainLooper()
    ).postDelayed(
      this::checkPermissionsThenStart,
      ${duration}
    );`
      : 'checkPermissionsThenStart();'}
  }

  void checkPermissionsThenStart(){
    ${permissionFlow}
  }

  ${permissionResult}

  String[] wantedPermissions(){
    ArrayList<String> p=new ArrayList<>();

    ${javaPermissionBuilder(cfg)}

    return p.toArray(
      new String[0]
    );
  }`;
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
  const extMap={
    adguard:{
      slug:'adguard-adblocker',
      label:'AdGuard'
    },
    ghostery:{
      slug:'ghostery',
      label:'Ghostery'
    },
    privacyBadger:{
      slug:'privacy-badger17',
      label:'Privacy Badger'
    },
    darkReader:{
      slug:'darkreader',
      label:'Dark Reader'
    },
    ublock:{
      slug:'ublock-origin',
      label:'uBlock Origin'
    }
  };

  const selected=(cfg.extensions||[])
    .map(key=>({
      key,
      ...(extMap[key]||{})
    }))
    .filter(x=>x.slug);

  const extensionRows=selected.map(x=>`
    keys.add(${javaString(x.key)});
    slugs.add(${javaString(x.slug)});
    names.add(${javaString(x.label)});
    urls.add("https://addons.mozilla.org/firefox/downloads/latest/${x.slug}/latest.xpi");
  `).join('\n');

  const geckoControls=
    cfg.controls||[];

  const transparent=
    geckoControls.includes(
      'transparentNav'
    );

  const navigationToolbar=
    geckoControls.includes(
      'navigationToolbar'
    );

  const externalLinks=
    geckoControls.includes(
      'externalLinks'
    );

  const downloadManager=
    geckoControls.includes(
      'downloadManager'
    );

  const filesEnabled=
    (cfg.permissions||[])
      .includes('files');

  const selectedPermissions=
    cfg.permissions||[];

  const cameraEnabled=
    selectedPermissions.includes('camera');

  const microphoneEnabled=
    selectedPermissions.includes('microphone');

  const notificationEnabled=
    selectedPermissions.includes('notification');

  const locationEnabled=
    selectedPermissions.includes('location');

  const contactsEnabled=
    selectedPermissions.includes('contacts');

  const calendarEnabled=
    selectedPermissions.includes('calendar');

  const biometricsEnabled=
    selectedPermissions.includes('biometrics');

  const bluetoothEnabled=
    selectedPermissions.includes('bluetooth');

  const sensorsEnabled=
    selectedPermissions.includes('sensors');

  const mediaEnabled=
    selectedPermissions.includes('media');

  const allowedAndroidPermissions=[];

  if(cameraEnabled){
    allowedAndroidPermissions.push(
      'android.permission.CAMERA'
    );
  }

  if(microphoneEnabled){
    allowedAndroidPermissions.push(
      'android.permission.RECORD_AUDIO'
    );
  }

  if(notificationEnabled){
    allowedAndroidPermissions.push(
      'android.permission.POST_NOTIFICATIONS'
    );
  }

  if(locationEnabled){
    allowedAndroidPermissions.push(
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION'
    );
  }

  if(contactsEnabled){
    allowedAndroidPermissions.push(
      'android.permission.READ_CONTACTS'
    );
  }

  if(calendarEnabled){
    allowedAndroidPermissions.push(
      'android.permission.READ_CALENDAR',
      'android.permission.WRITE_CALENDAR'
    );
  }

  if(biometricsEnabled){
    allowedAndroidPermissions.push(
      'android.permission.USE_BIOMETRIC'
    );
  }

  if(bluetoothEnabled){
    allowedAndroidPermissions.push(
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN'
    );
  }

  if(sensorsEnabled){
    allowedAndroidPermissions.push(
      'android.permission.BODY_SENSORS'
    );
  }

  if(mediaEnabled){
    allowedAndroidPermissions.push(
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_EXTERNAL_STORAGE'
    );
  }

  const androidPermissionPolicy=
    [...new Set(allowedAndroidPermissions)]
      .map(
        permission=>
          `if(permission.equals(${javaString(permission)})) return true;`
      )
      .join('\n    ');

  const hard=
    cfg.renderMode==='hardware';

  return `package ${cfg.packageName};

import android.Manifest;
import android.app.Activity;
import android.os.*;
import android.graphics.Color;
import android.view.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.app.DownloadManager;
import android.app.AlertDialog;
import android.webkit.URLUtil;
import android.widget.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.mozilla.geckoview.*;

public class MainActivity extends Activity {

  final String HOME=${javaString(cfg.websiteUrl)};

  final boolean NAVIGATION_TOOLBAR=${navigationToolbar};
  final boolean EXTERNAL_LINKS=${externalLinks};
  final boolean DOWNLOAD_MANAGER=${downloadManager};
  final boolean FILES_ENABLED=${filesEnabled};

  final boolean CAMERA_ENABLED=${cameraEnabled};
  final boolean MICROPHONE_ENABLED=${microphoneEnabled};
  final boolean NOTIFICATION_ENABLED=${notificationEnabled};
  final boolean LOCATION_ENABLED=${locationEnabled};

  final boolean CONTACTS_ENABLED=${contactsEnabled};
  final boolean CALENDAR_ENABLED=${calendarEnabled};
  final boolean BIOMETRICS_ENABLED=${biometricsEnabled};
  final boolean BLUETOOTH_ENABLED=${bluetoothEnabled};
  final boolean SENSORS_ENABLED=${sensorsEnabled};
  final boolean MEDIA_ENABLED=${mediaEnabled};

  static final int FILE_PICKER_REQUEST=902;
  static final int RUNTIME_PERMISSION_REQUEST=703;

  GeckoRuntime runtime;
  GeckoSession session;
  GeckoView view;

  FrameLayout root;
  LinearLayout browserShell;
  LinearLayout navigationBar;
  LinearLayout loader;
  LinearLayout diagnostics;

  Button backButton;
  Button forwardButton;
  Button homeButton;
  Button refreshButton;
  Button shareButton;

  boolean canGoBack=false;
  boolean canGoForward=false;

  String currentUrl=HOME;

  GeckoResult<
    GeckoSession.PromptDelegate.PromptResponse
  > pendingFileResult;

  GeckoSession.PromptDelegate.FilePrompt
    pendingFilePrompt;

  ProgressBar loadingBar;
  TextView loadingStatus;
  TextView loadingCount;

  Button retryButton;
  Button continueButton;

  final ArrayList<TextView> extensionRows=
    new ArrayList<>();

  SharedPreferences extensionPrefs;
  SharedPreferences permissionPrefs;

  GeckoSession.PermissionDelegate.Callback
    pendingAndroidPermissionCallback;

  boolean started=false;

  AtomicInteger extensionDone=
    new AtomicInteger(0);

  AtomicInteger extensionReady=
    new AtomicInteger(0);

  AtomicInteger extensionFailed=
    new AtomicInteger(0);

  Handler timeoutHandler=
    new Handler(Looper.getMainLooper());

  Runnable websiteTimeout;

  @Override
  public void onCreate(Bundle state){
    super.onCreate(state);

    ${transparent ? `
    if(Build.VERSION.SDK_INT>=29){
      getWindow()
        .setNavigationBarColor(
          Color.TRANSPARENT
        );

      getWindow()
        .setStatusBarColor(
          Color.TRANSPARENT
        );
    }` : ''}

    begin();
  }

  ${splashMethods(cfg,true)}

  int dp(int value){
    return (int)(
      value *
      getResources()
        .getDisplayMetrics()
        .density
      + 0.5f
    );
  }

  TextView makeText(
    String value,
    float size,
    int color
  ){
    TextView text=
      new TextView(this);

    text.setText(value);
    text.setTextSize(size);
    text.setTextColor(color);
    text.setGravity(Gravity.CENTER);

    return text;
  }

  void startBrowser(){
    if(started){
      return;
    }

    started=true;

    extensionPrefs=
      getSharedPreferences(
        "jepong_extensions",
        MODE_PRIVATE
      );

    permissionPrefs=
      getSharedPreferences(
        "jepong_site_permissions",
        MODE_PRIVATE
      );

    buildBrowserScreen();

    android.util.Log.i(
      "JepongBridge",
      deviceBridgeCapabilitySummary()
    );

    runtime=
      GeckoRuntime.create(this);

    WebExtensionController controller=
      runtime
        .getWebExtensionController();

    controller.setPromptDelegate(
      new WebExtensionController.PromptDelegate(){

        @Override
        public GeckoResult<
          WebExtension.PermissionPromptResponse
        > onInstallPromptRequest(
          WebExtension extension,
          String[] permissions,
          String[] origins,
          String[] dataCollectionPermissions
        ){
          return GeckoResult.fromValue(
            new WebExtension
              .PermissionPromptResponse(
                true,
                false,
                false
              )
          );
        }

        @Override
        public GeckoResult<AllowOrDeny>
        onOptionalPrompt(
          WebExtension extension,
          String[] permissions,
          String[] origins,
          String[] dataCollectionPermissions
        ){
          return GeckoResult.fromValue(
            AllowOrDeny.ALLOW
          );
        }

        @Override
        public GeckoResult<AllowOrDeny>
        onUpdatePrompt(
          WebExtension extension,
          String[] newPermissions,
          String[] newOrigins,
          String[] newDataCollectionPermissions
        ){
          return GeckoResult.fromValue(
            AllowOrDeny.ALLOW
          );
        }
      }
    );

    session=
      new GeckoSession();

    session.setNavigationDelegate(
      new GeckoSession.NavigationDelegate(){

        @Override
        public void onCanGoBack(
          GeckoSession currentSession,
          boolean value
        ){
          canGoBack=value;
          updateNavigationButtons();
        }

        @Override
        public void onCanGoForward(
          GeckoSession currentSession,
          boolean value
        ){
          canGoForward=value;
          updateNavigationButtons();
        }

        @Override
        public GeckoResult<AllowOrDeny>
        onLoadRequest(
          GeckoSession currentSession,
          LoadRequest request
        ){
          if(
            request.target==
              GeckoSession.NavigationDelegate
                .TARGET_WINDOW_NEW
          ){
            if(
              EXTERNAL_LINKS &&
              shouldOpenExternally(
                request.uri
              )
            ){
              openExternalUrl(
                request.uri
              );
            }else{
              currentSession.loadUri(
                request.uri
              );
            }

            return GeckoResult.deny();
          }

          if(
            EXTERNAL_LINKS &&
            request.hasUserGesture &&
            shouldOpenExternally(
              request.uri
            )
          ){
            openExternalUrl(
              request.uri
            );

            return GeckoResult.deny();
          }

          return GeckoResult.allow();
        }
      }
    );

    session.setPromptDelegate(
      new GeckoSession.PromptDelegate(){

        @Override
        public GeckoResult<
          GeckoSession.PromptDelegate.PromptResponse
        > onFilePrompt(
          GeckoSession currentSession,
          GeckoSession.PromptDelegate.FilePrompt prompt
        ){
          if(!FILES_ENABLED){
            return GeckoResult.fromValue(
              prompt.dismiss()
            );
          }

          if(
            pendingFileResult!=null &&
            pendingFilePrompt!=null
          ){
            try{
              pendingFileResult.complete(
                pendingFilePrompt.dismiss()
              );
            }catch(Exception ignored){}

            pendingFileResult=null;
            pendingFilePrompt=null;
          }

          Intent intent;

          if(
            prompt.type==
              GeckoSession.PromptDelegate
                .FilePrompt.Type.FOLDER
          ){
            intent=new Intent(
              Intent.ACTION_OPEN_DOCUMENT_TREE
            );
          }else{
            intent=new Intent(
              Intent.ACTION_OPEN_DOCUMENT
            );

            intent.addCategory(
              Intent.CATEGORY_OPENABLE
            );

            if(
              prompt.mimeTypes!=null &&
              prompt.mimeTypes.length==1
            ){
              intent.setType(
                prompt.mimeTypes[0]
              );
            }else{
              intent.setType("*/*");

              if(
                prompt.mimeTypes!=null &&
                prompt.mimeTypes.length>1
              ){
                intent.putExtra(
                  Intent.EXTRA_MIME_TYPES,
                  prompt.mimeTypes
                );
              }
            }

            intent.putExtra(
              Intent.EXTRA_ALLOW_MULTIPLE,
              prompt.type==
                GeckoSession.PromptDelegate
                  .FilePrompt.Type.MULTIPLE
            );
          }

          intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION
          );

          final GeckoResult<
            GeckoSession.PromptDelegate.PromptResponse
          > result=new GeckoResult<>();

          pendingFileResult=result;
          pendingFilePrompt=prompt;

          try{
            startActivityForResult(
              intent,
              FILE_PICKER_REQUEST
            );
          }catch(Exception error){
            pendingFileResult=null;
            pendingFilePrompt=null;

            return GeckoResult.fromValue(
              prompt.dismiss()
            );
          }

          return result;
        }
      }
    );

    session.setContentDelegate(
      new GeckoSession.ContentDelegate(){

        @Override
        public void onExternalResponse(
          GeckoSession currentSession,
          WebResponse response
        ){
          if(response==null){
            return;
          }

          if(response.requestExternalApp){
            closeResponseBody(response);
            openExternalUrl(response.uri);
            return;
          }

          if(DOWNLOAD_MANAGER){
            enqueueDownload(response);
          }else{
            closeResponseBody(response);
            openExternalUrl(response.uri);
          }
        }

        @Override
        public void onCrash(
          GeckoSession currentSession
        ){
          showWebsiteError(
            "Browser process stopped. Tap Retry."
          );
        }
      }
    );

    session.setPermissionDelegate(
      new GeckoSession.PermissionDelegate(){

        @Override
        public void onAndroidPermissionsRequest(
          GeckoSession currentSession,
          String[] permissions,
          Callback callback
        ){
          if(Build.VERSION.SDK_INT<23){
            callback.grant();
            return;
          }

          if(
            pendingAndroidPermissionCallback!=null
          ){
            callback.reject();
            return;
          }

          ArrayList<String> missing=
            new ArrayList<>();

          if(permissions!=null){
            for(String permission:permissions){

              if(
                !isAndroidPermissionSelected(
                  permission
                )
              ){
                callback.reject();
                return;
              }

              if(
                checkSelfPermission(permission)
                  !=PackageManager.PERMISSION_GRANTED
              ){
                missing.add(permission);
              }
            }
          }

          if(missing.isEmpty()){
            callback.grant();
            return;
          }

          pendingAndroidPermissionCallback=
            callback;

          runOnUiThread(()->{
            try{
              requestPermissions(
                missing.toArray(
                  new String[0]
                ),
                RUNTIME_PERMISSION_REQUEST
              );
            }catch(Exception error){

              Callback pending=
                pendingAndroidPermissionCallback;

              pendingAndroidPermissionCallback=
                null;

              if(pending!=null){
                pending.reject();
              }
            }
          });
        }

        @Override
        public GeckoResult<Integer>
        onContentPermissionRequest(
          GeckoSession currentSession,
          ContentPermission permission
        ){
          if(permission==null){
            return GeckoResult.fromValue(
              ContentPermission.VALUE_DENY
            );
          }

          if(
            permission.permission==
              PERMISSION_TRACKING
          ){
            return GeckoResult.fromValue(
              ContentPermission.VALUE_DENY
            );
          }

          if(
            permission.permission==
              PERMISSION_GEOLOCATION
          ){
            if(
              !LOCATION_ENABLED ||
              !hasEitherLocationPermission()
            ){
              return GeckoResult.fromValue(
                ContentPermission.VALUE_DENY
              );
            }

            return askContentPermission(
              permission,
              "location",
              "Location"
            );
          }

          if(
            permission.permission==
              PERMISSION_DESKTOP_NOTIFICATION
          ){
            if(!NOTIFICATION_ENABLED){
              return GeckoResult.fromValue(
                ContentPermission.VALUE_DENY
              );
            }

            if(
              Build.VERSION.SDK_INT>=33 &&
              !hasAndroidPermission(
                Manifest.permission.POST_NOTIFICATIONS
              )
            ){
              return GeckoResult.fromValue(
                ContentPermission.VALUE_DENY
              );
            }

            return askContentPermission(
              permission,
              "notifications",
              "Notifications"
            );
          }

          return GeckoResult.fromValue(
            ContentPermission.VALUE_PROMPT
          );
        }

        @Override
        public void onMediaPermissionRequest(
          GeckoSession currentSession,
          String uri,
          MediaSource[] video,
          MediaSource[] audio,
          MediaCallback callback
        ){
          MediaSource camera=
            findMediaSource(
              video,
              MediaSource.SOURCE_CAMERA
            );

          MediaSource microphone=
            findMediaSource(
              audio,
              MediaSource.SOURCE_MICROPHONE
            );

          boolean videoRequested=
            video!=null &&
            video.length>0;

          boolean audioRequested=
            audio!=null &&
            audio.length>0;

          /*
           * Screen capture and device-audio capture
           * are not silently treated as camera/microphone.
           */
          if(
            videoRequested &&
            camera==null
          ){
            callback.reject();
            return;
          }

          if(
            audioRequested &&
            microphone==null
          ){
            callback.reject();
            return;
          }

          if(
            camera!=null &&
            (
              !CAMERA_ENABLED ||
              !hasAndroidPermission(
                Manifest.permission.CAMERA
              )
            )
          ){
            callback.reject();
            return;
          }

          if(
            microphone!=null &&
            (
              !MICROPHONE_ENABLED ||
              !hasAndroidPermission(
                Manifest.permission.RECORD_AUDIO
              )
            )
          ){
            callback.reject();
            return;
          }

          if(
            camera==null &&
            microphone==null
          ){
            callback.reject();
            return;
          }

          String kind=
            camera!=null &&
            microphone!=null
              ? "camera_microphone"
              : camera!=null
                ? "camera"
                : "microphone";

          String label=
            camera!=null &&
            microphone!=null
              ? "Camera and microphone"
              : camera!=null
                ? "Camera"
                : "Microphone";

          askMediaPermission(
            uri,
            kind,
            label,
            camera,
            microphone,
            callback
          );
        }
      }
    );

    session.setProgressDelegate(
      new GeckoSession.ProgressDelegate(){

        @Override
        public void onPageStart(
          GeckoSession currentSession,
          String url
        ){
          currentUrl=
            url!=null
              ? url
              : HOME;

          beginWebsiteTimeout();

          setWebsiteProgress(0);
        }

        @Override
        public void onProgressChange(
          GeckoSession currentSession,
          int progress
        ){
          setWebsiteProgress(progress);
        }

        @Override
        public void onPageStop(
          GeckoSession currentSession,
          boolean success
        ){
          cancelWebsiteTimeout();

          if(success){
            finishLoader();
          }else{
            showWebsiteError(
              "Website could not be loaded."
            );
          }
        }
      }
    );

    session.open(runtime);

    view.setSession(session);

    prepareExtensions(controller);
  }


  boolean isAndroidPermissionSelected(
    String permission
  ){
    if(permission==null){
      return false;
    }

    ${androidPermissionPolicy}

    return false;
  }

  boolean hasAndroidPermission(
    String permission
  ){
    return
      Build.VERSION.SDK_INT<23 ||
      checkSelfPermission(permission)==
        PackageManager.PERMISSION_GRANTED;
  }

  boolean hasEitherLocationPermission(){
    return
      hasAndroidPermission(
        Manifest.permission.ACCESS_FINE_LOCATION
      ) ||
      hasAndroidPermission(
        Manifest.permission.ACCESS_COARSE_LOCATION
      );
  }

  String siteHost(
    String uri
  ){
    try{
      String host=
        Uri.parse(uri).getHost();

      if(
        host!=null &&
        !host.trim().isEmpty()
      ){
        return host
          .toLowerCase(Locale.ROOT);
      }
    }catch(Exception ignored){}

    return "unknown-site";
  }

  String sitePermissionKey(
    String uri,
    String kind
  ){
    return
      kind+
      "|" +
      siteHost(uri);
  }

  String siteDisplayName(
    String uri
  ){
    String host=
      siteHost(uri);

    return host.equals("unknown-site")
      ? "This website"
      : host;
  }

  GeckoResult<Integer>
  askContentPermission(
    ContentPermission permission,
    String kind,
    String label
  ){
    final String key=
      sitePermissionKey(
        permission.uri,
        kind
      );

    final String saved=
      permissionPrefs.getString(
        key,
        "ask"
      );

    if(saved.equals("allow")){
      return GeckoResult.fromValue(
        ContentPermission.VALUE_ALLOW
      );
    }

    if(saved.equals("deny")){
      return GeckoResult.fromValue(
        ContentPermission.VALUE_DENY
      );
    }

    final GeckoResult<Integer> result=
      new GeckoResult<>();

    runOnUiThread(()->{
      try{
        new AlertDialog.Builder(this)
          .setTitle(
            label+" permission"
          )
          .setMessage(
            siteDisplayName(
              permission.uri
            )+
            " wants to use "+
            label.toLowerCase(
              Locale.ROOT
            )+
            "."
          )
          .setPositiveButton(
            "Allow once",
            (dialog,which)->{
              result.complete(
                ContentPermission
                  .VALUE_ALLOW
              );
            }
          )
          .setNeutralButton(
            "Always allow",
            (dialog,which)->{
              permissionPrefs
                .edit()
                .putString(
                  key,
                  "allow"
                )
                .apply();

              result.complete(
                ContentPermission
                  .VALUE_ALLOW
              );
            }
          )
          .setNegativeButton(
            "Always block",
            (dialog,which)->{
              permissionPrefs
                .edit()
                .putString(
                  key,
                  "deny"
                )
                .apply();

              result.complete(
                ContentPermission
                  .VALUE_DENY
              );
            }
          )
          .setOnCancelListener(
            dialog->{
              result.complete(
                ContentPermission
                  .VALUE_DENY
              );
            }
          )
          .show();

      }catch(Exception error){
        result.complete(
          ContentPermission.VALUE_DENY
        );
      }
    });

    return result;
  }

  MediaSource findMediaSource(
    MediaSource[] sources,
    int wantedSource
  ){
    if(sources==null){
      return null;
    }

    for(MediaSource source:sources){
      if(
        source!=null &&
        source.source==wantedSource
      ){
        return source;
      }
    }

    return null;
  }

  void askMediaPermission(
    String uri,
    String kind,
    String label,
    MediaSource camera,
    MediaSource microphone,
    MediaCallback callback
  ){
    final String key=
      sitePermissionKey(
        uri,
        kind
      );

    final String saved=
      permissionPrefs.getString(
        key,
        "ask"
      );

    if(saved.equals("allow")){
      callback.grant(
        camera,
        microphone
      );
      return;
    }

    if(saved.equals("deny")){
      callback.reject();
      return;
    }

    runOnUiThread(()->{
      try{
        new AlertDialog.Builder(this)
          .setTitle(
            label+" permission"
          )
          .setMessage(
            siteDisplayName(uri)+
            " wants to use "+
            label.toLowerCase(
              Locale.ROOT
            )+
            "."
          )
          .setPositiveButton(
            "Allow once",
            (dialog,which)->{
              callback.grant(
                camera,
                microphone
              );
            }
          )
          .setNeutralButton(
            "Always allow",
            (dialog,which)->{
              permissionPrefs
                .edit()
                .putString(
                  key,
                  "allow"
                )
                .apply();

              callback.grant(
                camera,
                microphone
              );
            }
          )
          .setNegativeButton(
            "Always block",
            (dialog,which)->{
              permissionPrefs
                .edit()
                .putString(
                  key,
                  "deny"
                )
                .apply();

              callback.reject();
            }
          )
          .setOnCancelListener(
            dialog->callback.reject()
          )
          .show();

      }catch(Exception error){
        callback.reject();
      }
    });
  }

  String deviceBridgeCapabilitySummary(){
    return
      "Advanced bridge foundation only; "+
      "not exposed to website JavaScript. "+
      "files="+FILES_ENABLED+
      ", contacts="+CONTACTS_ENABLED+
      ", calendar="+CALENDAR_ENABLED+
      ", biometrics="+BIOMETRICS_ENABLED+
      ", bluetooth="+BLUETOOTH_ENABLED+
      ", sensors="+SENSORS_ENABLED+
      ", media="+MEDIA_ENABLED;
  }

  void showSitePermissionsManager(){
    String message=
      "Saved website permission decisions can be reset here.\\n\\n"+
      deviceBridgeCapabilitySummary();

    new AlertDialog.Builder(this)
      .setTitle(
        "Site permissions"
      )
      .setMessage(message)
      .setPositiveButton(
        "Reset saved decisions",
        (dialog,which)->{
          permissionPrefs
            .edit()
            .clear()
            .apply();

          Toast.makeText(
            this,
            "Saved site permissions reset",
            Toast.LENGTH_SHORT
          ).show();
        }
      )
      .setNegativeButton(
        "Close",
        null
      )
      .show();
  }

  void buildBrowserScreen(){

    root=
      new FrameLayout(this);

    view=
      new GeckoView(this);

    ${hard
      ? 'view.setLayerType(View.LAYER_TYPE_HARDWARE,null);'
      : ''}

    browserShell=
      new LinearLayout(this);

    browserShell.setOrientation(
      LinearLayout.VERTICAL
    );

    browserShell.addView(
      view,
      new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        0,
        1f
      )
    );

    if(NAVIGATION_TOOLBAR){
      buildNavigationToolbar();

      browserShell.addView(
        navigationBar,
        new LinearLayout.LayoutParams(
          LinearLayout.LayoutParams.MATCH_PARENT,
          dp(54)
        )
      );
    }

    root.addView(
      browserShell,
      new FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT
      )
    );

    loader=
      new LinearLayout(this);

    loader.setOrientation(
      LinearLayout.VERTICAL
    );

    loader.setGravity(
      Gravity.CENTER
    );

    loader.setPadding(
      dp(28),
      dp(32),
      dp(28),
      dp(32)
    );

    loader.setBackgroundColor(
      Color.rgb(
        17,
        24,
        39
      )
    );

    ImageView icon=
      new ImageView(this);

    icon.setImageResource(
      R.drawable.app_icon
    );

    icon.setScaleType(
      ImageView.ScaleType.CENTER_INSIDE
    );

    LinearLayout.LayoutParams iconParams=
      new LinearLayout.LayoutParams(
        dp(100),
        dp(100)
      );

    iconParams.bottomMargin=
      dp(18);

    loader.addView(
      icon,
      iconParams
    );

    TextView appTitle=
      makeText(
        ${javaString(cfg.appName)},
        23f,
        Color.WHITE
      );

    LinearLayout.LayoutParams titleParams=
      new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      );

    titleParams.bottomMargin=
      dp(6);

    loader.addView(
      appTitle,
      titleParams
    );

    loadingStatus=
      makeText(
        "Preparing secure browser...",
        15f,
        Color.rgb(
          209,
          213,
          219
        )
      );

    LinearLayout.LayoutParams statusParams=
      new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      );

    statusParams.bottomMargin=
      dp(16);

    loader.addView(
      loadingStatus,
      statusParams
    );

    loadingBar=
      new ProgressBar(
        this,
        null,
        android.R.attr
          .progressBarStyleHorizontal
      );

    loadingBar.setMax(100);
    loadingBar.setProgress(0);
    loadingBar.setIndeterminate(false);

    LinearLayout.LayoutParams progressParams=
      new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        dp(8)
      );

    progressParams.setMargins(
      dp(12),
      0,
      dp(12),
      dp(10)
    );

    loader.addView(
      loadingBar,
      progressParams
    );

    loadingCount=
      makeText(
        "Checking browser protection...",
        13f,
        Color.rgb(
          156,
          163,
          175
        )
      );

    LinearLayout.LayoutParams countParams=
      new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      );

    countParams.bottomMargin=
      dp(16);

    loader.addView(
      loadingCount,
      countParams
    );

    diagnostics=
      new LinearLayout(this);

    diagnostics.setOrientation(
      LinearLayout.VERTICAL
    );

    diagnostics.setPadding(
      dp(8),
      dp(4),
      dp(8),
      dp(8)
    );

    loader.addView(
      diagnostics,
      new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      )
    );

    retryButton=
      new Button(this);

    retryButton.setText(
      "Retry extensions"
    );

    retryButton.setVisibility(
      View.GONE
    );

    LinearLayout.LayoutParams retryParams=
      new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      );

    retryParams.setMargins(
      0,
      dp(12),
      0,
      dp(6)
    );

    loader.addView(
      retryButton,
      retryParams
    );

    continueButton=
      new Button(this);

    continueButton.setText(
      "Continue without failed extensions"
    );

    continueButton.setVisibility(
      View.GONE
    );

    loader.addView(
      continueButton,
      new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      )
    );

    root.addView(
      loader,
      new FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT
      )
    );

    setContentView(root);
  }

  Button makeNavigationButton(
    String text,
    String description
  ){
    Button button=
      new Button(this);

    button.setText(text);
    button.setTextSize(18f);
    button.setAllCaps(false);
    button.setContentDescription(
      description
    );
    button.setMinWidth(0);
    button.setMinimumWidth(0);

    return button;
  }

  void buildNavigationToolbar(){
    navigationBar=
      new LinearLayout(this);

    navigationBar.setOrientation(
      LinearLayout.HORIZONTAL
    );

    navigationBar.setGravity(
      Gravity.CENTER
    );

    navigationBar.setPadding(
      dp(4),
      dp(2),
      dp(4),
      dp(2)
    );

    navigationBar.setBackgroundColor(
      Color.rgb(
        17,
        24,
        39
      )
    );

    backButton=
      makeNavigationButton(
        "‹",
        "Back"
      );

    forwardButton=
      makeNavigationButton(
        "›",
        "Forward"
      );

    homeButton=
      makeNavigationButton(
        "⌂",
        "Home"
      );

    refreshButton=
      makeNavigationButton(
        "↻",
        "Refresh"
      );

    shareButton=
      makeNavigationButton(
        "↗",
        "Share"
      );

    LinearLayout.LayoutParams item=
      new LinearLayout.LayoutParams(
        0,
        LinearLayout.LayoutParams.MATCH_PARENT,
        1f
      );

    navigationBar.addView(
      backButton,
      new LinearLayout.LayoutParams(item)
    );

    navigationBar.addView(
      forwardButton,
      new LinearLayout.LayoutParams(item)
    );

    navigationBar.addView(
      homeButton,
      new LinearLayout.LayoutParams(item)
    );

    navigationBar.addView(
      refreshButton,
      new LinearLayout.LayoutParams(item)
    );

    navigationBar.addView(
      shareButton,
      new LinearLayout.LayoutParams(item)
    );

    backButton.setOnClickListener(
      clicked->{
        if(
          session!=null &&
          canGoBack
        ){
          session.goBack();
        }
      }
    );

    forwardButton.setOnClickListener(
      clicked->{
        if(
          session!=null &&
          canGoForward
        ){
          session.goForward();
        }
      }
    );

    homeButton.setOnClickListener(
      clicked->{
        if(session!=null){
          session.loadUri(HOME);
        }
      }
    );

    homeButton.setOnLongClickListener(
      clicked->{
        showSitePermissionsManager();
        return true;
      }
    );

    refreshButton.setOnClickListener(
      clicked->{
        if(session!=null){
          session.reload();
        }
      }
    );

    shareButton.setOnClickListener(
      clicked->shareCurrentPage()
    );

    updateNavigationButtons();
  }

  void updateNavigationButtons(){
    runOnUiThread(()->{
      if(backButton!=null){
        backButton.setEnabled(
          canGoBack
        );

        backButton.setAlpha(
          canGoBack
            ? 1f
            : 0.35f
        );
      }

      if(forwardButton!=null){
        forwardButton.setEnabled(
          canGoForward
        );

        forwardButton.setAlpha(
          canGoForward
            ? 1f
            : 0.35f
        );
      }
    });
  }

  void shareCurrentPage(){
    try{
      Intent share=
        new Intent(
          Intent.ACTION_SEND
        );

      share.setType(
        "text/plain"
      );

      share.putExtra(
        Intent.EXTRA_TEXT,
        currentUrl!=null
          ? currentUrl
          : HOME
      );

      startActivity(
        Intent.createChooser(
          share,
          "Share page"
        )
      );
    }catch(Exception error){
      Toast.makeText(
        this,
        "Unable to share this page",
        Toast.LENGTH_SHORT
      ).show();
    }
  }

  boolean shouldOpenExternally(
    String url
  ){
    if(url==null){
      return false;
    }

    try{
      Uri target=
        Uri.parse(url);

      String scheme=
        target.getScheme();

      if(scheme==null){
        return false;
      }

      scheme=
        scheme.toLowerCase(
          Locale.ROOT
        );

      if(
        scheme.equals("tel") ||
        scheme.equals("mailto") ||
        scheme.equals("sms") ||
        scheme.equals("geo") ||
        scheme.equals("market")
      ){
        return true;
      }

      if(
        !scheme.equals("http") &&
        !scheme.equals("https")
      ){
        return false;
      }

      Uri home=
        Uri.parse(HOME);

      String homeHost=
        home.getHost();

      String targetHost=
        target.getHost();

      if(
        homeHost==null ||
        targetHost==null
      ){
        return false;
      }

      homeHost=
        homeHost.toLowerCase(
          Locale.ROOT
        );

      targetHost=
        targetHost.toLowerCase(
          Locale.ROOT
        );

      if(
        targetHost.equals(homeHost) ||
        targetHost.endsWith(
          "."+homeHost
        ) ||
        homeHost.endsWith(
          "."+targetHost
        )
      ){
        return false;
      }

      return true;

    }catch(Exception error){
      return false;
    }
  }

  void openExternalUrl(
    String url
  ){
    if(url==null){
      return;
    }

    try{
      Intent intent=
        new Intent(
          Intent.ACTION_VIEW,
          Uri.parse(url)
        );

      startActivity(intent);

    }catch(Exception error){
      Toast.makeText(
        this,
        "No app can open this link",
        Toast.LENGTH_SHORT
      ).show();
    }
  }

  void closeResponseBody(
    WebResponse response
  ){
    try{
      if(
        response!=null &&
        response.body!=null
      ){
        response.body.close();
      }
    }catch(Exception ignored){}
  }

  void enqueueDownload(
    WebResponse response
  ){
    if(
      response==null ||
      response.uri==null
    ){
      closeResponseBody(response);
      return;
    }

    try{
      Uri uri=
        Uri.parse(
          response.uri
        );

      String scheme=
        uri.getScheme();

      if(
        scheme==null ||
        (
          !scheme.equalsIgnoreCase("http") &&
          !scheme.equalsIgnoreCase("https")
        )
      ){
        closeResponseBody(response);
        openExternalUrl(response.uri);
        return;
      }

      String disposition=
        response.headers.get(
          "content-disposition"
        );

      String mime=
        response.headers.get(
          "content-type"
        );

      String fileName=
        URLUtil.guessFileName(
          response.uri,
          disposition,
          mime
        );

      DownloadManager.Request request=
        new DownloadManager.Request(
          uri
        );

      request.setTitle(
        fileName
      );

      request.setDescription(
        "Downloading..."
      );

      if(mime!=null){
        request.setMimeType(
          mime
        );
      }

      request.setNotificationVisibility(
        DownloadManager.Request
          .VISIBILITY_VISIBLE_NOTIFY_COMPLETED
      );

      try{
        if(Build.VERSION.SDK_INT>=29){
          request.setDestinationInExternalPublicDir(
            Environment.DIRECTORY_DOWNLOADS,
            fileName
          );
        }else{
          request.setDestinationInExternalFilesDir(
            this,
            Environment.DIRECTORY_DOWNLOADS,
            fileName
          );
        }
      }catch(Exception ignored){
        request.setDestinationInExternalFilesDir(
          this,
          Environment.DIRECTORY_DOWNLOADS,
          fileName
        );
      }

      DownloadManager manager=
        (DownloadManager)
          getSystemService(
            DOWNLOAD_SERVICE
          );

      if(manager==null){
        throw new IllegalStateException(
          "Download service unavailable"
        );
      }

      manager.enqueue(request);

      Toast.makeText(
        this,
        "Download started: "+fileName,
        Toast.LENGTH_LONG
      ).show();

    }catch(Exception error){
      Toast.makeText(
        this,
        "Download could not be started",
        Toast.LENGTH_LONG
      ).show();
    }finally{
      closeResponseBody(response);
    }
  }

  void prepareExtensions(
    WebExtensionController controller
  ){
    hideActionButtons();

    extensionDone.set(0);
    extensionReady.set(0);
    extensionFailed.set(0);

    extensionRows.clear();
    diagnostics.removeAllViews();

    final ArrayList<String> keys=
      new ArrayList<>();

    final ArrayList<String> slugs=
      new ArrayList<>();

    final ArrayList<String> names=
      new ArrayList<>();

    final ArrayList<String> urls=
      new ArrayList<>();

    ${extensionRows}

    if(keys.isEmpty()){
      loadingBar.setProgress(80);

      loadingStatus.setText(
        "Browser ready"
      );

      loadingCount.setText(
        "No extensions selected"
      );

      loadWebsite();
      return;
    }

    for(String name:names){
      TextView row=
        makeText(
          "○ "+name+" • Checking",
          13f,
          Color.rgb(
            209,
            213,
            219
          )
        );

      row.setGravity(
        Gravity.START
      );

      row.setPadding(
        dp(4),
        dp(4),
        dp(4),
        dp(4)
      );

      diagnostics.addView(row);

      extensionRows.add(row);
    }

    loadingCount.setText(
      "0 / "+
      keys.size()+
      " extensions checked"
    );

    controller.list().accept(

      installed->{

        final AtomicInteger pending=
          new AtomicInteger(
            keys.size()
          );

        for(
          int i=0;
          i<keys.size();
          i++
        ){
          final int index=i;

          final String key=
            keys.get(index);

          final String slug=
            slugs.get(index);

          final String name=
            names.get(index);

          final String url=
            urls.get(index);

          WebExtension existing=
            findInstalled(
              installed,
              key,
              name
            );

          if(existing!=null){

            extensionPrefs
              .edit()
              .putString(
                "extid_"+key,
                existing.id
              )
              .apply();

            if(existing.metaData.enabled){

              finishExtension(
                pending,
                index,
                name,
                true,
                "Enabled"
              );

            }else{

              setExtensionRow(
                index,
                "◌ "+name+
                " • Enabling...",
                Color.rgb(
                  250,
                  204,
                  21
                )
              );

              controller.enable(
                existing,
                WebExtensionController
                  .EnableSource.APP
              ).accept(

                enabledExtension->{

                  boolean enabled=
                    enabledExtension
                      .metaData
                      .enabled;

                  extensionPrefs
                    .edit()
                    .putString(
                      "extid_"+key,
                      enabledExtension.id
                    )
                    .apply();

                  finishExtension(
                    pending,
                    index,
                    name,
                    enabled,
                    enabled
                      ? "Enabled"
                      : "Disabled"
                  );
                },

                error->{
                  finishExtension(
                    pending,
                    index,
                    name,
                    false,
                    "Enable failed"
                  );
                }
              );
            }

            continue;
          }

          installExtension(
            controller,
            pending,
            index,
            key,
            name,
            url
          );
        }
      },

      error->{

        for(
          int i=0;
          i<extensionRows.size();
          i++
        ){
          setExtensionRow(
            i,
            "✕ "+
            names.get(i)+
            " • Check failed",
            Color.rgb(
              248,
              113,
              113
            )
          );
        }

        extensionFailed.set(
          keys.size()
        );

        loadingStatus.setText(
          "Could not inspect extensions"
        );

        loadingCount.setText(
          "Check your internet connection"
        );

        showExtensionActions(
          controller
        );
      }
    );
  }

  WebExtension findInstalled(
    List<WebExtension> installed,
    String key,
    String expectedName
  ){
    String savedId=
      extensionPrefs.getString(
        "extid_"+key,
        ""
      );

    if(installed==null){
      return null;
    }

    if(!savedId.isEmpty()){
      for(WebExtension extension:installed){
        if(
          savedId.equals(
            extension.id
          )
        ){
          return extension;
        }
      }
    }

    String wanted=
      normalizeExtensionName(
        expectedName
      );

    for(WebExtension extension:installed){

      String actual=
        normalizeExtensionName(
          extension.metaData.name
        );

      if(
        !actual.isEmpty() &&
        (
          actual.contains(wanted) ||
          wanted.contains(actual)
        )
      ){
        return extension;
      }
    }

    return null;
  }

  String normalizeExtensionName(
    String value
  ){
    if(value==null){
      return "";
    }

    return value
      .toLowerCase(Locale.ROOT)
      .replaceAll(
        "[^a-z0-9]",
        ""
      );
  }

  void installExtension(
    WebExtensionController controller,
    AtomicInteger pending,
    int index,
    String key,
    String name,
    String url
  ){
    setExtensionRow(
      index,
      "↓ "+name+" • Installing...",
      Color.rgb(
        96,
        165,
        250
      )
    );

    controller.install(url).accept(

      extension->{

        extensionPrefs
          .edit()
          .putString(
            "extid_"+key,
            extension.id
          )
          .apply();

        if(extension.metaData.enabled){

          finishExtension(
            pending,
            index,
            name,
            true,
            "Installed & enabled"
          );

        }else{

          controller.enable(
            extension,
            WebExtensionController
              .EnableSource.APP
          ).accept(

            enabledExtension->{

              boolean enabled=
                enabledExtension
                  .metaData
                  .enabled;

              finishExtension(
                pending,
                index,
                name,
                enabled,
                enabled
                  ? "Installed & enabled"
                  : "Installed but disabled"
              );
            },

            enableError->{
              finishExtension(
                pending,
                index,
                name,
                false,
                "Installed but enable failed"
              );
            }
          );
        }
      },

      installError->{

        controller.list().accept(

          installed->{

            WebExtension existing=
              findInstalled(
                installed,
                key,
                name
              );

            if(
              existing!=null &&
              existing.metaData.enabled
            ){

              extensionPrefs
                .edit()
                .putString(
                  "extid_"+key,
                  existing.id
                )
                .apply();

              finishExtension(
                pending,
                index,
                name,
                true,
                "Already installed"
              );

            }else if(existing!=null){

              controller.enable(
                existing,
                WebExtensionController
                  .EnableSource.APP
              ).accept(

                enabledExtension->{

                  boolean enabled=
                    enabledExtension
                      .metaData
                      .enabled;

                  extensionPrefs
                    .edit()
                    .putString(
                      "extid_"+key,
                      enabledExtension.id
                    )
                    .apply();

                  finishExtension(
                    pending,
                    index,
                    name,
                    enabled,
                    enabled
                      ? "Enabled"
                      : "Disabled"
                  );
                },

                enableError->{
                  finishExtension(
                    pending,
                    index,
                    name,
                    false,
                    "Enable failed"
                  );
                }
              );

            }else{

              finishExtension(
                pending,
                index,
                name,
                false,
                "Install failed"
              );
            }
          },

          listError->{
            finishExtension(
              pending,
              index,
              name,
              false,
              "Install failed"
            );
          }
        );
      }
    );
  }

  void finishExtension(
    AtomicInteger pending,
    int index,
    String name,
    boolean success,
    String message
  ){
    int done=
      extensionDone
        .incrementAndGet();

    if(success){
      extensionReady
        .incrementAndGet();

      setExtensionRow(
        index,
        "✓ "+name+
        " • "+message,
        Color.rgb(
          74,
          222,
          128
        )
      );

    }else{

      extensionFailed
        .incrementAndGet();

      setExtensionRow(
        index,
        "✕ "+name+
        " • "+message,
        Color.rgb(
          248,
          113,
          113
        )
      );
    }

    int total=
      extensionRows.size();

    int percent=
      total==0
        ? 80
        : Math.min(
            80,
            Math.round(
              done *
              80f /
              total
            )
          );

    runOnUiThread(()->{

      loadingBar.setProgress(
        percent
      );

      loadingCount.setText(
        done+
        " / "+
        total+
        " extensions checked"
      );
    });

    if(
      pending.decrementAndGet()==0
    ){
      onExtensionsFinished();
    }
  }

  void setExtensionRow(
    int index,
    String text,
    int color
  ){
    runOnUiThread(()->{

      if(
        index>=0 &&
        index<extensionRows.size()
      ){
        TextView row=
          extensionRows.get(index);

        row.setText(text);
        row.setTextColor(color);
      }
    });
  }

  void onExtensionsFinished(){
    runOnUiThread(()->{

      loadingBar.setProgress(80);

      int ready=
        extensionReady.get();

      int failed=
        extensionFailed.get();

      if(failed==0){

        loadingStatus.setText(
          "✓ Browser protection ready"
        );

        loadingCount.setText(
          ready+
          " extensions enabled"
        );

        new Handler(
          Looper.getMainLooper()
        ).postDelayed(
          this::loadWebsite,
          250
        );

      }else{

        loadingStatus.setText(
          "Some extensions need attention"
        );

        loadingCount.setText(
          ready+
          " ready • "+
          failed+
          " failed"
        );

        WebExtensionController controller=
          runtime
            .getWebExtensionController();

        showExtensionActions(
          controller
        );
      }
    });
  }

  void showExtensionActions(
    WebExtensionController controller
  ){
    runOnUiThread(()->{

      retryButton.setText(
        "Retry extensions"
      );

      retryButton.setVisibility(
        View.VISIBLE
      );

      continueButton.setText(
        "Continue without failed extensions"
      );

      continueButton.setVisibility(
        View.VISIBLE
      );

      retryButton.setOnClickListener(
        view->{
          prepareExtensions(
            controller
          );
        }
      );

      continueButton.setOnClickListener(
        view->{
          hideActionButtons();
          loadWebsite();
        }
      );
    });
  }

  void hideActionButtons(){
    runOnUiThread(()->{
      retryButton.setVisibility(
        View.GONE
      );

      continueButton.setVisibility(
        View.GONE
      );
    });
  }

  void loadWebsite(){
    runOnUiThread(()->{

      hideActionButtons();

      loadingBar.setProgress(80);

      loadingStatus.setText(
        "Loading website..."
      );

      loadingCount.setText(
        "Starting GeckoView"
      );

      session.loadUri(HOME);
    });
  }

  void setWebsiteProgress(
    int progress
  ){
    int safe=
      Math.max(
        0,
        Math.min(
          100,
          progress
        )
      );

    int overall=
      80 +
      (
        safe *
        20 /
        100
      );

    runOnUiThread(()->{

      loadingBar.setProgress(
        overall
      );

      loadingStatus.setText(
        "Loading website..."
      );

      loadingCount.setText(
        safe+"%"
      );
    });
  }

  void beginWebsiteTimeout(){
    cancelWebsiteTimeout();

    websiteTimeout=()->{
      showWebsiteError(
        "Website loading timed out."
      );
    };

    timeoutHandler.postDelayed(
      websiteTimeout,
      30000
    );
  }

  void cancelWebsiteTimeout(){
    if(websiteTimeout!=null){
      timeoutHandler
        .removeCallbacks(
          websiteTimeout
        );

      websiteTimeout=null;
    }
  }

  void showWebsiteError(
    String message
  ){
    runOnUiThread(()->{

      cancelWebsiteTimeout();

      if(
        loader.getParent()==null
      ){
        root.addView(
          loader,
          new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
          )
        );
      }

      loader.setAlpha(1f);

      loadingStatus.setText(
        "Unable to open website"
      );

      loadingCount.setText(
        message
      );

      loadingBar.setProgress(80);

      retryButton.setText(
        "Retry website"
      );

      retryButton.setVisibility(
        View.VISIBLE
      );

      retryButton.setOnClickListener(
        view->{
          retryButton.setVisibility(
            View.GONE
          );

          loadWebsite();
        }
      );

      continueButton.setVisibility(
        View.GONE
      );
    });
  }

  void finishLoader(){
    runOnUiThread(()->{

      loadingBar.setProgress(100);

      loadingStatus.setText(
        "✓ Ready"
      );

      loadingCount.setText(
        "100%"
      );

      hideActionButtons();

      new Handler(
        Looper.getMainLooper()
      ).postDelayed(
        ()->{
          if(
            loader!=null &&
            loader.getParent()==root
          ){
            loader.animate()
              .alpha(0f)
              .setDuration(250)
              .withEndAction(
                ()->root.removeView(
                  loader
                )
              )
              .start();
          }
        },
        180
      );
    });
  }


  @Override
  public void onRequestPermissionsResult(
    int requestCode,
    String[] permissions,
    int[] grantResults
  ){
    super.onRequestPermissionsResult(
      requestCode,
      permissions,
      grantResults
    );

    if(
      requestCode!=
        RUNTIME_PERMISSION_REQUEST
    ){
      return;
    }

    GeckoSession.PermissionDelegate.Callback callback=
      pendingAndroidPermissionCallback;

    pendingAndroidPermissionCallback=
      null;

    if(callback==null){
      return;
    }

    boolean granted=true;

    if(
      grantResults==null ||
      grantResults.length==0
    ){
      granted=false;
    }else{
      for(int result:grantResults){
        if(
          result!=PackageManager.PERMISSION_GRANTED
        ){
          granted=false;
          break;
        }
      }
    }

    if(granted){
      callback.grant();
    }else{
      callback.reject();
    }
  }

  @Override
  protected void onActivityResult(
    int requestCode,
    int resultCode,
    Intent data
  ){
    super.onActivityResult(
      requestCode,
      resultCode,
      data
    );

    if(
      requestCode!=FILE_PICKER_REQUEST ||
      pendingFileResult==null ||
      pendingFilePrompt==null
    ){
      return;
    }

    try{
      if(
        resultCode==RESULT_OK &&
        data!=null
      ){
        ArrayList<Uri> picked=
          new ArrayList<>();

        ClipData clip=
          data.getClipData();

        if(clip!=null){
          for(
            int i=0;
            i<clip.getItemCount();
            i++
          ){
            Uri uri=
              clip.getItemAt(i)
                .getUri();

            if(uri!=null){
              picked.add(uri);
            }
          }
        }else if(
          data.getData()!=null
        ){
          picked.add(
            data.getData()
          );
        }

        if(!picked.isEmpty()){
          Uri[] uris=
            picked.toArray(
              new Uri[0]
            );

          pendingFileResult.complete(
            pendingFilePrompt.confirm(
              getApplicationContext(),
              uris
            )
          );
        }else{
          pendingFileResult.complete(
            pendingFilePrompt.dismiss()
          );
        }

      }else{
        pendingFileResult.complete(
          pendingFilePrompt.dismiss()
        );
      }

    }catch(Exception error){
      try{
        pendingFileResult.complete(
          pendingFilePrompt.dismiss()
        );
      }catch(Exception ignored){}

    }finally{
      pendingFileResult=null;
      pendingFilePrompt=null;
    }
  }

  @Override
  public void onBackPressed(){
    if(
      session!=null &&
      canGoBack
    ){
      session.goBack();
    }else{
      super.onBackPressed();
    }
  }
}
`;
}

