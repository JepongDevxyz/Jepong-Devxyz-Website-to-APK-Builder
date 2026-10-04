/* Shared Fullscreen Mode helpers (all four engines).
   New behavior (per user request):
   - NO side panel. The bottom toolbar auto-hides after 3s idle and reappears on tap.
   - Status bar uses Android IMMERSIVE_STICKY (system auto-hides/shows on edge swipe).
   - Video fullscreen: absolutely NO UI (no toolbar, no handle) — true fullscreen.
   - Tap anywhere (dispatchTouchEvent) → show toolbar; 3s idle → hide.
   Uses anonymous inner classes only (no lambdas) for maximum build compatibility. */

export const FULLSCREEN_JAVA_FIELDS = `
  View jepongToolbarView;
  android.os.Handler jepongUiHandler;
  Runnable jepongUiHideRunnable;
  View jepongFullscreenView;
  android.webkit.WebChromeClient.CustomViewCallback jepongFullscreenCallback;
  boolean jepongVideoFullscreen=false;
`;

export function fullscreenJavaMethods() {
  return `
  void jepongSetupImmersive(){
    try{
      getWindow().getDecorView().setSystemUiVisibility(
        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        | View.SYSTEM_UI_FLAG_FULLSCREEN
        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }catch(Exception ignored){}
  }
  void jepongSetupToolbarAutoHide(View toolbar){
    jepongToolbarView=toolbar;
    jepongUiHandler=new android.os.Handler(android.os.Looper.getMainLooper());
    jepongUiHideRunnable=new Runnable(){ public void run(){
      if(!jepongVideoFullscreen&&jepongToolbarView!=null){
        jepongToolbarView.setVisibility(View.GONE);
      }
    } };
    if(jepongToolbarView!=null) jepongToolbarView.setVisibility(View.GONE);
    jepongSetupImmersive();
  }
  void jepongShowToolbar(){
    if(jepongVideoFullscreen) return;
    if(jepongToolbarView!=null) jepongToolbarView.setVisibility(View.VISIBLE);
    if(jepongUiHandler!=null&&jepongUiHideRunnable!=null){
      jepongUiHandler.removeCallbacks(jepongUiHideRunnable);
      jepongUiHandler.postDelayed(jepongUiHideRunnable,3000);
    }
  }
  void jepongShowFullscreenVideo(View view,android.webkit.WebChromeClient.CustomViewCallback callback){
    if(view==null) return;
    jepongVideoFullscreen=true;
    if(jepongToolbarView!=null) jepongToolbarView.setVisibility(View.GONE);
    if(jepongUiHandler!=null&&jepongUiHideRunnable!=null){
      jepongUiHandler.removeCallbacks(jepongUiHideRunnable);
    }
    try{
      getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN);
      getWindow().getDecorView().setSystemUiVisibility(
        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        | View.SYSTEM_UI_FLAG_FULLSCREEN
        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }catch(Exception ignored){}
    try{
      android.view.ViewGroup decor=(android.view.ViewGroup)getWindow().getDecorView();
      android.widget.FrameLayout.LayoutParams lp=new android.widget.FrameLayout.LayoutParams(
        android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
        android.widget.FrameLayout.LayoutParams.MATCH_PARENT);
      decor.addView(view,lp);
      jepongFullscreenView=view;
      jepongFullscreenCallback=callback;
    }catch(Exception ignored){}
  }
  void jepongHideFullscreenVideo(){
    jepongVideoFullscreen=false;
    try{
      if(jepongFullscreenView!=null){
        android.view.ViewGroup parent=(android.view.ViewGroup)jepongFullscreenView.getParent();
        if(parent!=null) parent.removeView(jepongFullscreenView);
      }
    }catch(Exception ignored){}
    jepongFullscreenView=null;
    try{
      if(jepongFullscreenCallback!=null) jepongFullscreenCallback.onCustomViewHidden();
    }catch(Exception ignored){}
    jepongFullscreenCallback=null;
    try{
      getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN);
    }catch(Exception ignored){}
    jepongSetupImmersive();
  }
  boolean jepongIsFullscreenVideo(){
    return jepongVideoFullscreen&&jepongFullscreenView!=null;
  }
`;
}

export function fullscreenDispatchTouchEvent() {
  return `
  @Override public boolean dispatchTouchEvent(android.view.MotionEvent ev){
    try{
      if(ev!=null&&ev.getAction()==android.view.MotionEvent.ACTION_DOWN){
        jepongShowToolbar();
      }
    }catch(Exception ignored){}
    return super.dispatchTouchEvent(ev);
  }
`;
}

export function fullscreenChromeClientDelegate() {
  return `
  void jepongAttachFullscreenVideoSupport(android.webkit.WebView w){
    if(w==null) return;
    try{
      final android.webkit.WebChromeClient base=(android.webkit.WebChromeClient)w.getWebChromeClient();
      w.setWebChromeClient(new android.webkit.WebChromeClient(){
        @Override public void onShowCustomView(View view,CustomViewCallback callback){
          jepongShowFullscreenVideo(view,callback);
        }
        @Override public void onHideCustomView(){
          jepongHideFullscreenVideo();
        }
        @Override public boolean onCreateWindow(android.webkit.WebView v,boolean d,boolean u,android.os.Message m){ return base!=null&&base.onCreateWindow(v,d,u,m); }
        @Override public void onProgressChanged(android.webkit.WebView v,int p){ if(base!=null) base.onProgressChanged(v,p); }
        @Override public void onReceivedTitle(android.webkit.WebView v,String t){ if(base!=null) base.onReceivedTitle(v,t); }
      });
    }catch(Exception ignored){}
  }
`;
}
