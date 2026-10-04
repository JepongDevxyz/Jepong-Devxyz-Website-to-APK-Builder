/* Shared Java snippets for fullscreen mode (all 4 engines).
   Fullscreen mode = bottom navigation toolbar hidden, navigation buttons
   attached side-by-side to the screen edge (floating, collapsible), and
   working video fullscreen playback.
   The show/hide mechanics are engine-agnostic; each engine wires its own
   fullscreen trigger (WebView onShowCustomView / Gecko onFullScreen) to
   jepongShowFullscreenVideo / jepongHideFullscreenVideo. */

export const FULLSCREEN_JAVA_FIELDS = `
  View jepongSidePanel;
  boolean jepongSideExpanded=true;
  View jepongFullscreenView;
  android.webkit.WebChromeClient.CustomViewCallback jepongFullscreenCallback;
  android.os.Handler jepongUiHandler;
  Runnable jepongAutoHideRunnable;
`;

export function fullscreenJavaMethods() {
  return `
  int jepongDp(int v){ return (int)(v*getResources().getDisplayMetrics().density+0.5f); }
  Button jepongSideBtn(String label){
    Button b=new Button(this);
    b.setText(label);
    b.setTextSize(11f);
    b.setAllCaps(false);
    b.setSingleLine(true);
    int hp=jepongDp(8), vp=jepongDp(4);
    b.setPadding(hp,vp,hp,vp);
    return b;
  }
  void jepongBuildSidePanel(Runnable onBack,Runnable onForward,Runnable onHome,Runnable onReload,Runnable onShare){
    LinearLayout panel=new LinearLayout(this);
    panel.setOrientation(LinearLayout.HORIZONTAL);
    panel.setGravity(Gravity.CENTER_VERTICAL);
    panel.setBackgroundColor(Color.argb(170,17,24,39));
    int pad=jepongDp(4);
    panel.setPadding(pad,pad,pad,pad);
    Button handle=jepongSideBtn("\\u00BB");
    handle.setOnClickListener(v->jepongToggleSidePanel());
    panel.addView(handle);
    Button bBack=jepongSideBtn("\\u2039");
    bBack.setOnClickListener(v->{ jepongScheduleAutoHide(); onBack.run(); });
    Button bFwd=jepongSideBtn("\\u203A");
    bFwd.setOnClickListener(v->{ jepongScheduleAutoHide(); onForward.run(); });
    Button bHome=jepongSideBtn("Home");
    bHome.setOnClickListener(v->{ jepongScheduleAutoHide(); onHome.run(); });
    Button bReload=jepongSideBtn("Reload");
    bReload.setOnClickListener(v->{ jepongScheduleAutoHide(); onReload.run(); });
    Button bShare=jepongSideBtn("Share");
    bShare.setOnClickListener(v->{ jepongScheduleAutoHide(); onShare.run(); });
    panel.addView(bBack);
    panel.addView(bFwd);
    panel.addView(bHome);
    panel.addView(bReload);
    panel.addView(bShare);
    FrameLayout.LayoutParams lp=new FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.WRAP_CONTENT,
      FrameLayout.LayoutParams.WRAP_CONTENT,
      Gravity.END|Gravity.CENTER_VERTICAL);
    addContentView(panel,lp);
    jepongSidePanel=panel;
    jepongUiHandler=new android.os.Handler(android.os.Looper.getMainLooper());
    jepongAutoHideRunnable=()->{
      if(jepongSidePanel!=null&&jepongSideExpanded&&jepongFullscreenView==null){
        jepongToggleSidePanel();
      }
    };
    jepongScheduleAutoHide();
  }
  void jepongScheduleAutoHide(){
    if(jepongUiHandler==null||jepongAutoHideRunnable==null) return;
    jepongUiHandler.removeCallbacks(jepongAutoHideRunnable);
    jepongUiHandler.postDelayed(jepongAutoHideRunnable,3000);
  }
  void jepongToggleSidePanel(){
    if(jepongSidePanel==null) return;
    jepongSideExpanded=!jepongSideExpanded;
    ViewGroup g=(ViewGroup)jepongSidePanel;
    for(int i=1;i<g.getChildCount();i++){
      g.getChildAt(i).setVisibility(jepongSideExpanded?View.VISIBLE:View.GONE);
    }
    if(jepongSideExpanded) jepongScheduleAutoHide();
    else if(jepongUiHandler!=null&&jepongAutoHideRunnable!=null) jepongUiHandler.removeCallbacks(jepongAutoHideRunnable);
  }
  void jepongShowFullscreenVideo(View view,android.webkit.WebChromeClient.CustomViewCallback callback){
    if(jepongFullscreenView!=null){ try{callback.onCustomViewHidden();}catch(Exception ignored){} return; }
    jepongFullscreenView=view;
    jepongFullscreenCallback=callback;
    try{
      getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
      FrameLayout decor=(FrameLayout)getWindow().getDecorView();
      decor.addView(view,new FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT));
    }catch(Exception ignored){}
    if(jepongSidePanel!=null) jepongSidePanel.setVisibility(View.GONE);
  }
  void jepongHideFullscreenVideo(){
    if(jepongFullscreenView==null) return;
    try{
      FrameLayout decor=(FrameLayout)getWindow().getDecorView();
      decor.removeView(jepongFullscreenView);
    }catch(Exception ignored){}
    jepongFullscreenView=null;
    if(jepongFullscreenCallback!=null){
      try{jepongFullscreenCallback.onCustomViewHidden();}catch(Exception ignored){}
      jepongFullscreenCallback=null;
    }
    try{ getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN); }catch(Exception ignored){}
    if(jepongSidePanel!=null&&jepongSideExpanded) jepongSidePanel.setVisibility(View.VISIBLE);
  }
  boolean jepongIsFullscreenVideo(){ return jepongFullscreenView!=null; }
`;
}

/* Delegating WebChromeClient for engines whose WebView already has a client
   (Capacitor/Cordova). Forwards everything to the existing client and only
   intercepts fullscreen video. Safe when base is null (behaves like default). */
export function fullscreenChromeClientDelegate() {
  return `
  void jepongAttachFullscreenVideoSupport(android.webkit.WebView w){
    if(w==null) return;
    final android.webkit.WebChromeClient base=w.getWebChromeClient();
    w.setWebChromeClient(new android.webkit.WebChromeClient(){
      @Override public void onShowCustomView(View view,CustomViewCallback callback){
        jepongShowFullscreenVideo(view,callback);
      }
      @Override public void onHideCustomView(){
        jepongHideFullscreenVideo();
      }
      @Override public boolean onShowFileChooser(android.webkit.WebView v,android.webkit.ValueCallback<android.net.Uri[]> cb,FileChooserParams p){
        if(base!=null) return base.onShowFileChooser(v,cb,p);
        return super.onShowFileChooser(v,cb,p);
      }
      @Override public void onPermissionRequest(android.webkit.PermissionRequest req){
        if(base!=null){ base.onPermissionRequest(req); return; }
        super.onPermissionRequest(req);
      }
      @Override public void onGeolocationPermissionsShowPrompt(String origin,android.webkit.GeolocationPermissions.Callback cb){
        if(base!=null){ base.onGeolocationPermissionsShowPrompt(origin,cb); return; }
        super.onGeolocationPermissionsShowPrompt(origin,cb);
      }
      @Override public void onProgressChanged(android.webkit.WebView v,int p){
        if(base!=null) base.onProgressChanged(v,p); else super.onProgressChanged(v,p);
      }
      @Override public void onReceivedTitle(android.webkit.WebView v,String t){
        if(base!=null) base.onReceivedTitle(v,t); else super.onReceivedTitle(v,t);
      }
      @Override public boolean onJsAlert(android.webkit.WebView v,String url,String msg,android.webkit.JsResult r){
        if(base!=null) return base.onJsAlert(v,url,msg,r);
        return super.onJsAlert(v,url,msg,r);
      }
      @Override public boolean onJsConfirm(android.webkit.WebView v,String url,String msg,android.webkit.JsResult r){
        if(base!=null) return base.onJsConfirm(v,url,msg,r);
        return super.onJsConfirm(v,url,msg,r);
      }
      @Override public boolean onJsPrompt(android.webkit.WebView v,String url,String msg,String def,android.webkit.JsPromptResult r){
        if(base!=null) return base.onJsPrompt(v,url,msg,def,r);
        return super.onJsPrompt(v,url,msg,def,r);
      }
    });
  }
`;
}
