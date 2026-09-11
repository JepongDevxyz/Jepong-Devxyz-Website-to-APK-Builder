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
 const idx=engine==='cordova'?s.lastIndexOf('dependencies {'):s.indexOf('dependencies {'); if(idx<0) throw new Error('No dependencies block in app Gradle');
 const pos=idx+'dependencies {'.length; s=s.slice(0,pos)+`\n${line}`+s.slice(pos); fs.writeFileSync(gradle,s);
}
function writeOneSignalApplication(){
 if(!cfg.oneSignalAppId)return;
 injectDependency('com.onesignal:OneSignal:5.9.8');
 const p=path.join(appRoot,'src/main/java',...cfg.packageName.split('.'),'JepongApplication.java');
 write(p,`package ${cfg.packageName};\nimport android.app.Application;\nimport com.onesignal.OneSignal;\npublic class JepongApplication extends Application { @Override public void onCreate(){ super.onCreate(); OneSignal.initWithContext(this, ${javaString(cfg.oneSignalAppId)}); } }\n`);
}
function runtimePermissionBuilder(cfg){
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

function activityBody(base){
 const layer=cfg.renderMode==='software'?'View.LAYER_TYPE_SOFTWARE':cfg.renderMode==='hardware'?'View.LAYER_TYPE_HARDWARE':'View.LAYER_TYPE_NONE';
 const transparent=(cfg.controls||[]).includes('transparentNav');
 const zoom=(cfg.controls||[]).includes('pinchZoom');
 const splash=cfg.splashEnabled!==false;
 const duration=Math.max(0,Math.min(15000,Number(cfg.splashDuration)||1500));

 const selectedControls=cfg.controls||[];

 const navigationToolbar=
   selectedControls.includes('navigationToolbar');

 const externalLinks=
   selectedControls.includes('externalLinks');

 const downloadManager=
   selectedControls.includes('downloadManager');

 const common=`${transparent?'if(Build.VERSION.SDK_INT>=29){getWindow().setNavigationBarColor(Color.TRANSPARENT); getWindow().setStatusBarColor(Color.TRANSPARENT);}':''}`;

 const overlay=splash?`ImageView brandSplash=new ImageView(this); brandSplash.setImageResource(R.drawable.app_splash); brandSplash.setScaleType(ImageView.ScaleType.CENTER_CROP); brandSplash.setBackgroundColor(Color.rgb(17,24,39)); addContentView(brandSplash,new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT)); brandSplash.bringToFront(); new Handler(Looper.getMainLooper()).postDelayed(()->{ ViewParent parent=brandSplash.getParent(); if(parent instanceof ViewGroup)((ViewGroup)parent).removeView(brandSplash); },${duration});`:'';

 const permissionMethods=`
  String[] wantedPermissions(){
    ArrayList<String> p=new ArrayList<>();
    ${runtimePermissionBuilder(cfg)}
    return p.toArray(new String[0]);
  }

  void requestSelectedPermissions(){
    if(Build.VERSION.SDK_INT<23)return;
    ArrayList<String> missing=new ArrayList<>();
    for(String permission:wantedPermissions()){
      if(checkSelfPermission(permission)!=PackageManager.PERMISSION_GRANTED){
        missing.add(permission);
      }
    }
    if(!missing.isEmpty()){
      requestPermissions(missing.toArray(new String[0]),700);
    }
  }
 `;

 const webSettings=`if(w!=null){
   w.setLayerType(${layer},null);
   WebSettings ws=w.getSettings();
   ws.setBuiltInZoomControls(${zoom});
   ws.setDisplayZoomControls(false);
   ws.setSupportZoom(${zoom});
 }`;

 if(base==='capacitor') return `package ${cfg.packageName};

import android.Manifest;
import android.app.DownloadManager;
import android.os.*;
import android.graphics.Color;
import android.net.Uri;
import android.view.*;
import android.widget.*;
import android.webkit.*;
import android.content.*;
import android.content.pm.PackageManager;
import java.util.ArrayList;
import java.util.Locale;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {

  final String HOME=${javaString(cfg.websiteUrl)};

  final boolean CAPACITOR_NAVIGATION_TOOLBAR_ENABLED=${navigationToolbar};
  final boolean CAPACITOR_EXTERNAL_LINKS_ENABLED=${externalLinks};
  final boolean CAPACITOR_DOWNLOAD_MANAGER_ENABLED=${downloadManager};

  WebView jepongWebView;
  Button backButton;
  Button forwardButton;

  @Override
  protected void onCreate(
    Bundle savedInstanceState
  ){
    super.onCreate(
      savedInstanceState
    );

    ${common}

    requestSelectedPermissions();

    WebView w=
      getBridge()!=null
        ? getBridge().getWebView()
        : null;

    jepongWebView=w;

    ${webSettings}

    if(w!=null){

      w.setWebViewClient(
        new JepongBridgeWebViewClient(
          getBridge(),
          this
        )
      );

      if(
        CAPACITOR_DOWNLOAD_MANAGER_ENABLED
      ){
        w.setDownloadListener(
          (
            url,
            userAgent,
            contentDisposition,
            mimeType,
            contentLength
          )->startCapacitorDownload(
            url,
            userAgent,
            contentDisposition,
            mimeType
          )
        );
      }

      if(
        CAPACITOR_NAVIGATION_TOOLBAR_ENABLED
      ){
        installCapacitorNavigationToolbar(
          w
        );
      }
    }

    ${overlay}
  }

  static class JepongBridgeWebViewClient
    extends BridgeWebViewClient {

    final MainActivity owner;

    JepongBridgeWebViewClient(
      Bridge bridge,
      MainActivity owner
    ){
      super(bridge);
      this.owner=owner;
    }

    @Override
    public boolean shouldOverrideUrlLoading(
      WebView view,
      WebResourceRequest request
    ){
      Uri uri=
        request!=null
          ? request.getUrl()
          : null;

      if(
        uri!=null &&
        owner.CAPACITOR_EXTERNAL_LINKS_ENABLED &&
        Build.VERSION.SDK_INT>=24 &&
        request.hasGesture() &&
        owner.shouldOpenExternally(uri)
      ){
        owner.openExternalUrl(uri);
        return true;
      }

      return super.shouldOverrideUrlLoading(
        view,
        request
      );
    }

    @Override
    public void onPageFinished(
      WebView view,
      String url
    ){
      super.onPageFinished(
        view,
        url
      );

      owner
        .updateCapacitorNavigationButtons();
    }
  }

  int dp(
    int value
  ){
    return (int)(
      value *
      getResources()
        .getDisplayMetrics()
        .density +
      0.5f
    );
  }

  Button makeCapacitorButton(
    String label
  ){
    Button button=
      new Button(this);

    button.setText(label);
    button.setTextSize(10f);
    button.setAllCaps(false);
    button.setSingleLine(true);

    return button;
  }

  void addCapacitorButton(
    LinearLayout bar,
    Button button
  ){
    bar.addView(
      button,
      new LinearLayout.LayoutParams(
        0,
        LinearLayout.LayoutParams.MATCH_PARENT,
        1f
      )
    );
  }

  void installCapacitorNavigationToolbar(
    WebView web
  ){
    LinearLayout bar=
      new LinearLayout(this);

    bar.setOrientation(
      LinearLayout.HORIZONTAL
    );

    bar.setGravity(
      Gravity.CENTER
    );

    backButton=
      makeCapacitorButton("Back");

    forwardButton=
      makeCapacitorButton("Next");

    Button home=
      makeCapacitorButton("Home");

    Button reload=
      makeCapacitorButton("Reload");

    Button share=
      makeCapacitorButton("Share");

    backButton.setOnClickListener(
      v->{
        if(web.canGoBack()){
          web.goBack();
        }
      }
    );

    forwardButton.setOnClickListener(
      v->{
        if(web.canGoForward()){
          web.goForward();
        }
      }
    );

    home.setOnClickListener(
      v->web.loadUrl(HOME)
    );

    reload.setOnClickListener(
      v->web.reload()
    );

    share.setOnClickListener(
      v->shareCapacitorUrl()
    );

    addCapacitorButton(
      bar,
      backButton
    );

    addCapacitorButton(
      bar,
      forwardButton
    );

    addCapacitorButton(
      bar,
      home
    );

    addCapacitorButton(
      bar,
      reload
    );

    addCapacitorButton(
      bar,
      share
    );

    FrameLayout.LayoutParams params=
      new FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        dp(54),
        Gravity.BOTTOM
      );

    addContentView(
      bar,
      params
    );

    web.setPadding(
      web.getPaddingLeft(),
      web.getPaddingTop(),
      web.getPaddingRight(),
      web.getPaddingBottom()+dp(54)
    );

    updateCapacitorNavigationButtons();
  }

  void updateCapacitorNavigationButtons(){

    if(
      !CAPACITOR_NAVIGATION_TOOLBAR_ENABLED
    ){
      return;
    }

    if(backButton!=null){
      backButton.setEnabled(
        jepongWebView!=null &&
        jepongWebView.canGoBack()
      );
    }

    if(forwardButton!=null){
      forwardButton.setEnabled(
        jepongWebView!=null &&
        jepongWebView.canGoForward()
      );
    }
  }

  void shareCapacitorUrl(){

    if(jepongWebView==null){
      return;
    }

    String url=
      jepongWebView.getUrl();

    if(
      url==null ||
      url.trim().isEmpty()
    ){
      url=HOME;
    }

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
        url
      );

      startActivity(
        Intent.createChooser(
          share,
          "Share link"
        )
      );

    }catch(Exception ignored){}
  }

  String normalizeHost(
    String host
  ){
    if(host==null){
      return "";
    }

    String value=
      host.toLowerCase(
        Locale.ROOT
      );

    if(
      value.startsWith(
        "www."
      )
    ){
      value=
        value.substring(4);
    }

    return value;
  }

  boolean isHomeHost(
    String candidate
  ){
    try{
      String homeHost=
        Uri.parse(HOME)
          .getHost();

      if(
        homeHost==null ||
        candidate==null
      ){
        return false;
      }

      homeHost=
        normalizeHost(
          homeHost
        );

      candidate=
        normalizeHost(
          candidate
        );

      return
        candidate.equals(homeHost) ||
        candidate.endsWith(
          "."+homeHost
        );

    }catch(Exception ignored){
      return false;
    }
  }

  boolean shouldOpenExternally(
    Uri uri
  ){
    if(uri==null){
      return false;
    }

    String scheme=
      uri.getScheme();

    if(scheme==null){
      return false;
    }

    if(
      !"http".equalsIgnoreCase(scheme) &&
      !"https".equalsIgnoreCase(scheme)
    ){
      return true;
    }

    return !isHomeHost(
      uri.getHost()
    );
  }

  void openExternalUrl(
    Uri uri
  ){
    if(uri==null){
      return;
    }

    try{
      startActivity(
        new Intent(
          Intent.ACTION_VIEW,
          uri
        )
      );
    }catch(Exception ignored){}
  }

  void startCapacitorDownload(
    String url,
    String userAgent,
    String contentDisposition,
    String mimeType
  ){
    if(
      !CAPACITOR_DOWNLOAD_MANAGER_ENABLED ||
      url==null ||
      url.trim().isEmpty()
    ){
      return;
    }

    try{
      Uri uri=
        Uri.parse(url);

      String scheme=
        uri.getScheme();

      if(
        scheme==null ||
        (
          !"http".equalsIgnoreCase(scheme) &&
          !"https".equalsIgnoreCase(scheme)
        )
      ){
        openExternalUrl(uri);
        return;
      }

      DownloadManager.Request request=
        new DownloadManager.Request(
          uri
        );

      String fileName=
        URLUtil.guessFileName(
          url,
          contentDisposition,
          mimeType
        );

      if(
        mimeType!=null &&
        !mimeType.trim().isEmpty()
      ){
        request.setMimeType(
          mimeType
        );
      }

      if(
        userAgent!=null &&
        !userAgent.trim().isEmpty()
      ){
        request.addRequestHeader(
          "User-Agent",
          userAgent
        );
      }

      String cookie=
        CookieManager
          .getInstance()
          .getCookie(url);

      if(
        cookie!=null &&
        !cookie.trim().isEmpty()
      ){
        request.addRequestHeader(
          "Cookie",
          cookie
        );
      }

      request.setTitle(
        fileName
      );

      request.setNotificationVisibility(
        DownloadManager
          .Request
          .VISIBILITY_VISIBLE_NOTIFY_COMPLETED
      );

      if(
        Build.VERSION.SDK_INT>=29
      ){
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

      DownloadManager manager=
        (DownloadManager)
          getSystemService(
            DOWNLOAD_SERVICE
          );

      if(manager==null){
        throw new IllegalStateException(
          "DownloadManager unavailable"
        );
      }

      manager.enqueue(
        request
      );

      Toast.makeText(
        this,
        "Download started",
        Toast.LENGTH_SHORT
      ).show();

    }catch(Exception error){

      Toast.makeText(
        this,
        "Unable to start download",
        Toast.LENGTH_SHORT
      ).show();
    }
  }

  ${permissionMethods}
}
`;


 return `package ${cfg.packageName};

import android.Manifest;
import android.app.DownloadManager;
import android.os.*;
import android.graphics.Color;
import android.net.Uri;
import android.view.*;
import android.widget.*;
import android.webkit.*;
import android.content.*;
import android.content.pm.PackageManager;

import java.util.ArrayList;
import java.util.Locale;

import org.apache.cordova.CordovaActivity;
import org.apache.cordova.CordovaWebViewEngine;
import org.apache.cordova.engine.SystemWebView;
import org.apache.cordova.engine.SystemWebViewClient;
import org.apache.cordova.engine.SystemWebViewEngine;

public class MainActivity extends CordovaActivity {

  final String HOME=${javaString(cfg.websiteUrl)};

  final boolean CORDOVA_NAVIGATION_TOOLBAR_ENABLED=${navigationToolbar};
  final boolean CORDOVA_EXTERNAL_LINKS_ENABLED=${externalLinks};
  final boolean CORDOVA_DOWNLOAD_MANAGER_ENABLED=${downloadManager};

  SystemWebView jepongWebView;

  Button backButton;
  Button forwardButton;

  @Override
  public void onCreate(
    Bundle savedInstanceState
  ){
    super.onCreate(
      savedInstanceState
    );

    ${common}

    requestSelectedPermissions();

    loadUrl(launchUrl);

    View raw=
      appView!=null
        ? appView.getView()
        : null;

    if(
      raw instanceof SystemWebView
    ){
      SystemWebView w=
        (SystemWebView)raw;

      jepongWebView=w;

      ${webSettings}

      CordovaWebViewEngine rawEngine=
        appView.getEngine();

      if(
        rawEngine instanceof SystemWebViewEngine
      ){
        w.setWebViewClient(
          new JepongSystemWebViewClient(
            (SystemWebViewEngine)rawEngine,
            this
          )
        );
      }

      if(
        CORDOVA_DOWNLOAD_MANAGER_ENABLED
      ){
        w.setDownloadListener(
          (
            url,
            userAgent,
            contentDisposition,
            mimeType,
            contentLength
          )->startCordovaDownload(
            url,
            userAgent,
            contentDisposition,
            mimeType
          )
        );
      }

      if(
        CORDOVA_NAVIGATION_TOOLBAR_ENABLED
      ){
        installCordovaNavigationToolbar(
          w
        );
      }
    }

    ${overlay}
  }

  static class JepongSystemWebViewClient
    extends SystemWebViewClient {

    final MainActivity owner;

    JepongSystemWebViewClient(
      SystemWebViewEngine engine,
      MainActivity owner
    ){
      super(engine);
      this.owner=owner;
    }

    @Override
    public boolean shouldOverrideUrlLoading(
      WebView view,
      WebResourceRequest request
    ){
      Uri uri=
        request!=null
          ? request.getUrl()
          : null;

      if(
        uri!=null &&
        owner.CORDOVA_EXTERNAL_LINKS_ENABLED &&
        Build.VERSION.SDK_INT>=24 &&
        request.hasGesture() &&
        owner.shouldOpenExternally(uri)
      ){
        owner.openExternalUrl(uri);
        return true;
      }

      return super.shouldOverrideUrlLoading(
        view,
        request
      );
    }

    @Override
    public void onPageFinished(
      WebView view,
      String url
    ){
      super.onPageFinished(
        view,
        url
      );

      owner.updateCordovaNavigationButtons();
    }
  }

  int dp(
    int value
  ){
    return (int)(
      value *
      getResources()
        .getDisplayMetrics()
        .density +
      0.5f
    );
  }

  Button makeCordovaButton(
    String label
  ){
    Button button=
      new Button(this);

    button.setText(label);
    button.setTextSize(10f);
    button.setAllCaps(false);
    button.setSingleLine(true);

    return button;
  }

  void addCordovaButton(
    LinearLayout bar,
    Button button
  ){
    bar.addView(
      button,
      new LinearLayout.LayoutParams(
        0,
        LinearLayout.LayoutParams.MATCH_PARENT,
        1f
      )
    );
  }

  void installCordovaNavigationToolbar(
    WebView web
  ){
    LinearLayout bar=
      new LinearLayout(this);

    bar.setOrientation(
      LinearLayout.HORIZONTAL
    );

    bar.setGravity(
      Gravity.CENTER
    );

    backButton=
      makeCordovaButton(
        "Back"
      );

    forwardButton=
      makeCordovaButton(
        "Next"
      );

    Button home=
      makeCordovaButton(
        "Home"
      );

    Button reload=
      makeCordovaButton(
        "Reload"
      );

    Button share=
      makeCordovaButton(
        "Share"
      );

    backButton.setOnClickListener(
      v->{
        if(web.canGoBack()){
          web.goBack();
        }
      }
    );

    forwardButton.setOnClickListener(
      v->{
        if(web.canGoForward()){
          web.goForward();
        }
      }
    );

    home.setOnClickListener(
      v->{
        if(appView!=null){
          appView.loadUrl(HOME);
        }
      }
    );

    reload.setOnClickListener(
      v->web.reload()
    );

    share.setOnClickListener(
      v->shareCordovaUrl()
    );

    addCordovaButton(
      bar,
      backButton
    );

    addCordovaButton(
      bar,
      forwardButton
    );

    addCordovaButton(
      bar,
      home
    );

    addCordovaButton(
      bar,
      reload
    );

    addCordovaButton(
      bar,
      share
    );

    FrameLayout.LayoutParams params=
      new FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        dp(54),
        Gravity.BOTTOM
      );

    addContentView(
      bar,
      params
    );

    bar.bringToFront();

    web.setPadding(
      web.getPaddingLeft(),
      web.getPaddingTop(),
      web.getPaddingRight(),
      web.getPaddingBottom()+dp(54)
    );

    updateCordovaNavigationButtons();
  }

  void updateCordovaNavigationButtons(){

    if(
      !CORDOVA_NAVIGATION_TOOLBAR_ENABLED
    ){
      return;
    }

    if(backButton!=null){
      backButton.setEnabled(
        jepongWebView!=null &&
        jepongWebView.canGoBack()
      );
    }

    if(forwardButton!=null){
      forwardButton.setEnabled(
        jepongWebView!=null &&
        jepongWebView.canGoForward()
      );
    }
  }

  void shareCordovaUrl(){

    if(jepongWebView==null){
      return;
    }

    String url=
      jepongWebView.getUrl();

    if(
      url==null ||
      url.trim().isEmpty()
    ){
      url=HOME;
    }

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
        url
      );

      startActivity(
        Intent.createChooser(
          share,
          "Share link"
        )
      );

    }catch(Exception ignored){}
  }

  String normalizeHost(
    String host
  ){
    if(host==null){
      return "";
    }

    String value=
      host.toLowerCase(
        Locale.ROOT
      );

    if(
      value.startsWith(
        "www."
      )
    ){
      value=
        value.substring(4);
    }

    return value;
  }

  boolean isHomeHost(
    String candidate
  ){
    try{
      String homeHost=
        Uri.parse(HOME)
          .getHost();

      if(
        homeHost==null ||
        candidate==null
      ){
        return false;
      }

      homeHost=
        normalizeHost(
          homeHost
        );

      candidate=
        normalizeHost(
          candidate
        );

      return
        candidate.equals(homeHost) ||
        candidate.endsWith(
          "."+homeHost
        );

    }catch(Exception ignored){
      return false;
    }
  }

  boolean shouldOpenExternally(
    Uri uri
  ){
    if(uri==null){
      return false;
    }

    String scheme=
      uri.getScheme();

    if(scheme==null){
      return false;
    }

    /*
      Only explicit HTTP/HTTPS off-site links are handled
      here. Other schemes stay with Cordova's own routing.
    */
    if(
      !"http".equalsIgnoreCase(scheme) &&
      !"https".equalsIgnoreCase(scheme)
    ){
      return false;
    }

    return !isHomeHost(
      uri.getHost()
    );
  }

  void openExternalUrl(
    Uri uri
  ){
    if(uri==null){
      return;
    }

    try{
      Intent intent=
        new Intent(
          Intent.ACTION_VIEW,
          uri
        );

      intent.addCategory(
        Intent.CATEGORY_BROWSABLE
      );

      startActivity(intent);

    }catch(Exception ignored){}
  }

  void startCordovaDownload(
    String url,
    String userAgent,
    String contentDisposition,
    String mimeType
  ){
    if(
      !CORDOVA_DOWNLOAD_MANAGER_ENABLED ||
      url==null ||
      url.trim().isEmpty()
    ){
      return;
    }

    try{
      Uri uri=
        Uri.parse(url);

      String scheme=
        uri.getScheme();

      if(
        scheme==null ||
        (
          !"http".equalsIgnoreCase(scheme) &&
          !"https".equalsIgnoreCase(scheme)
        )
      ){
        return;
      }

      DownloadManager.Request request=
        new DownloadManager.Request(
          uri
        );

      String fileName=
        URLUtil.guessFileName(
          url,
          contentDisposition,
          mimeType
        );

      if(
        mimeType!=null &&
        !mimeType.trim().isEmpty()
      ){
        request.setMimeType(
          mimeType
        );
      }

      if(
        userAgent!=null &&
        !userAgent.trim().isEmpty()
      ){
        request.addRequestHeader(
          "User-Agent",
          userAgent
        );
      }

      String cookie=
        CookieManager
          .getInstance()
          .getCookie(url);

      if(
        cookie!=null &&
        !cookie.trim().isEmpty()
      ){
        request.addRequestHeader(
          "Cookie",
          cookie
        );
      }

      request.setTitle(
        fileName
      );

      request.setDescription(
        "Downloading file"
      );

      request.setNotificationVisibility(
        DownloadManager
          .Request
          .VISIBILITY_VISIBLE_NOTIFY_COMPLETED
      );

      if(
        Build.VERSION.SDK_INT>=29
      ){
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

      DownloadManager manager=
        (DownloadManager)
          getSystemService(
            DOWNLOAD_SERVICE
          );

      if(manager==null){
        throw new IllegalStateException(
          "DownloadManager unavailable"
        );
      }

      manager.enqueue(
        request
      );

      Toast.makeText(
        this,
        "Download started",
        Toast.LENGTH_SHORT
      ).show();

    }catch(Exception error){

      Toast.makeText(
        this,
        "Unable to start download",
        Toast.LENGTH_SHORT
      ).show();
    }
  }

  @Override
  protected boolean showInitialSplashScreen(){
    return ${splash};
  }

  ${permissionMethods}
}
`;

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
