import fs from 'node:fs';
import path from 'node:path';

function replaceOnce(
  source,
  needle,
  replacement,
  label
){
  const first=
    source.indexOf(needle);

  if(first<0){
    throw new Error(
      `Browser UX patch marker missing: ${label}`
    );
  }

  if(
    source.indexOf(
      needle,
      first+needle.length
    )>=0
  ){
    throw new Error(
      `Browser UX patch marker ambiguous: ${label}`
    );
  }

  return (
    source.slice(0,first)+
    replacement+
    source.slice(
      first+needle.length
    )
  );
}

const sharedHelpers=`
  void applySystemSafeArea(
    View target
  ){
    if(
      target==null ||
      Build.VERSION.SDK_INT<30
    ){
      return;
    }

    getWindow()
      .setDecorFitsSystemWindows(
        false
      );

    final int baseLeft=
      target.getPaddingLeft();

    final int baseTop=
      target.getPaddingTop();

    final int baseRight=
      target.getPaddingRight();

    final int baseBottom=
      target.getPaddingBottom();

    target.setOnApplyWindowInsetsListener(
      (view,insets)->{

        view.setPadding(
          baseLeft+
            insets.getSystemWindowInsetLeft(),

          baseTop+
            insets.getSystemWindowInsetTop(),

          baseRight+
            insets.getSystemWindowInsetRight(),

          baseBottom+
            insets.getSystemWindowInsetBottom()
        );

        return insets;
      }
    );

    target.requestApplyInsets();
  }

  ProgressBar makeNavigationProgress(){
    ProgressBar bar=
      new ProgressBar(
        this,
        null,
        android.R.attr
          .progressBarStyleHorizontal
      );

    bar.setMax(100);
    bar.setProgress(5);
    bar.setIndeterminate(true);

    bar.setVisibility(
      View.GONE
    );

    return bar;
  }

  void showNavigationProgress(){
    runOnUiThread(()->{

      if(navigationProgress==null){
        return;
      }

      navigationProgress
        .setProgress(5);

      navigationProgress
        .setIndeterminate(true);

      navigationProgress
        .setVisibility(
          View.VISIBLE
        );
    });
  }

  void finishNavigationProgress(){
    runOnUiThread(()->{

      if(navigationProgress==null){
        return;
      }

      final ProgressBar bar=
        navigationProgress;

      bar.setIndeterminate(false);
      bar.setProgress(100);

      bar.postDelayed(
        ()->{
          if(
            navigationProgress==bar &&
            bar.getVisibility()==
              View.VISIBLE &&
            !bar.isIndeterminate() &&
            bar.getProgress()>=100
          ){
            bar.setVisibility(
              View.GONE
            );
          }
        },
        140
      );
    });
  }

`;

function patchNative(source){
  let out=source;

  out=replaceOnce(
    out,

    'WebView web; Button backButton; Button forwardButton; float downY;',

    'WebView web; Button backButton; Button forwardButton; ProgressBar navigationProgress; float downY;',

    'native progress field'
  );

  out=replaceOnce(
    out,
    '  void startBrowser(){',
    sharedHelpers+
    '  void startBrowser(){',
    'native shared UX helpers'
  );

  out=replaceOnce(
    out,

    'web.setLayerType(',

    `View safeAreaTarget=web;

    if(
      NATIVE_NAVIGATION_TOOLBAR_ENABLED &&
      web!=null &&
      web.getParent() instanceof View
    ){
      safeAreaTarget=
        (View)web.getParent();
    }

    applySystemSafeArea(
      safeAreaTarget
    );

    web.setLayerType(`,

    'native safe area'
  );

  if(
    out.includes(
      'LinearLayout bar=buildNativeNavigationBar();'
    )
  ){
    out=replaceOnce(
      out,

      `LinearLayout bar=buildNativeNavigationBar();
    shell.addView(
      bar,`,

      `navigationProgress=
      makeNavigationProgress();

    shell.addView(
      navigationProgress,
      new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        dp(3)
      )
    );

    LinearLayout bar=
      buildNativeNavigationBar();

    shell.addView(
      bar,`,

      'native toolbar progress row'
    );
  }

  out=replaceOnce(
    out,

    'backButton.setOnClickListener(v->{ if(web!=null&&web.canGoBack()) web.goBack(); });',

    `backButton.setOnClickListener(
      v->{
        if(
          web!=null &&
          web.canGoBack()
        ){
          showNavigationProgress();
          web.goBack();
        }
      }
    );`,

    'native back loading'
  );

  out=replaceOnce(
    out,

    'forwardButton.setOnClickListener(v->{ if(web!=null&&web.canGoForward()) web.goForward(); });',

    `forwardButton.setOnClickListener(
      v->{
        if(
          web!=null &&
          web.canGoForward()
        ){
          showNavigationProgress();
          web.goForward();
        }
      }
    );`,

    'native forward loading'
  );

  out=replaceOnce(
    out,

    'home.setOnClickListener(v->{ if(web!=null) web.loadUrl(HOME); });',

    `home.setOnClickListener(
      v->{
        if(web!=null){
          showNavigationProgress();
          web.loadUrl(HOME);
        }
      }
    );`,

    'native home loading'
  );

  out=replaceOnce(
    out,

    'reload.setOnClickListener(v->{ if(web!=null) web.reload(); });',

    `reload.setOnClickListener(
      v->{
        if(web!=null){
          showNavigationProgress();
          web.reload();
        }
      }
    );`,

    'native reload loading'
  );

  out=replaceOnce(
    out,

    '@Override public void onPageFinished(WebView v,String url){ super.onPageFinished(v,url); updateNativeNavigationButtons(); }',

    `@Override public void onPageFinished(
        WebView v,
        String url
      ){
        super.onPageFinished(
          v,
          url
        );

        finishNavigationProgress();
        updateNativeNavigationButtons();
      }`,

    'native page finished'
  );

  out=replaceOnce(
    out,

    '@Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e){ if(r.isForMainFrame()) v.loadUrl("file:///android_asset/offline.html"); }',

    `@Override public void onReceivedError(
        WebView v,
        WebResourceRequest r,
        WebResourceError e
      ){
        if(
          r!=null &&
          r.isForMainFrame()
        ){
          finishNavigationProgress();

          v.loadUrl(
            "file:///android_asset/offline.html"
          );
        }
      }`,

    'native page error'
  );

  return out;
}

function patchGecko(source){
  let out=source;

  out=replaceOnce(
    out,

    `  ProgressBar loadingBar;
  TextView loadingStatus;`,

    `  ProgressBar loadingBar;
  ProgressBar navigationProgress;
  TextView loadingStatus;`,

    'gecko navigation progress field'
  );

  out=replaceOnce(
    out,

    `  boolean waitingForInitialWebsitePaint=false;`,

    `  boolean waitingForInitialWebsitePaint=false;
  boolean recoverableWebsiteTimeout=false;`,

    'gecko recovery field'
  );

  out=replaceOnce(
    out,
    '  void startBrowser(){',
    sharedHelpers+
    '  void startBrowser(){',
    'gecko shared UX helpers'
  );

  out=replaceOnce(
    out,

    `      buildNavigationToolbar();

      browserShell.addView(
        navigationBar,`,

    `      buildNavigationToolbar();

      navigationProgress=
        makeNavigationProgress();

      browserShell.addView(
        navigationProgress,
        new LinearLayout.LayoutParams(
          LinearLayout.LayoutParams.MATCH_PARENT,
          dp(3)
        )
      );

      browserShell.addView(
        navigationBar,`,

    'gecko toolbar progress row'
  );

  out=replaceOnce(
    out,

    `    setContentView(root);
  }

  Button makeNavigationButton(`,

    `    setContentView(root);

    applySystemSafeArea(
      browserShell
    );
  }

  Button makeNavigationButton(`,

    'gecko safe area'
  );

  out=replaceOnce(
    out,

    `        ){
          session.goBack();
        }`,

    `        ){
          showNavigationProgress();
          session.goBack();
        }`,

    'gecko back loading'
  );

  out=replaceOnce(
    out,

    `        ){
          session.goForward();
        }`,

    `        ){
          showNavigationProgress();
          session.goForward();
        }`,

    'gecko forward loading'
  );

  out=replaceOnce(
    out,

    `        if(session!=null){
          session.loadUri(HOME);
        }`,

    `        if(session!=null){
          showNavigationProgress();
          session.loadUri(HOME);
        }`,

    'gecko home loading'
  );

  out=replaceOnce(
    out,

    `        if(session!=null){
          session.reload();
        }`,

    `        if(session!=null){
          showNavigationProgress();
          session.reload();
        }`,

    'gecko reload loading'
  );

  out=replaceOnce(
    out,

    `          waitingForInitialWebsitePaint=false;
          cancelWebsiteTimeout();
          finishLoader();`,

    `          waitingForInitialWebsitePaint=false;
          recoverableWebsiteTimeout=false;

          cancelWebsiteTimeout();
          finishNavigationProgress();
          finishLoader();`,

    'gecko first paint completion'
  );

  const oldPageStop=`        @Override
        public void onPageStop(
          GeckoSession currentSession,
          boolean success
        ){
          if(success){
            if(waitingForInitialWebsitePaint){
              runOnUiThread(()->{
                loadingStatus.setText(
                  "Rendering website..."
                );

                loadingCount.setText(
                  "Waiting for first paint"
                );
              });
            }else{
              cancelWebsiteTimeout();
            }
          }else{
            cancelWebsiteTimeout();
            showWebsiteError(
              "Website could not be loaded."
            );
          }
        }`;

  const newPageStop=`        @Override
        public void onPageStop(
          GeckoSession currentSession,
          boolean success
        ){
          if(success){

            if(recoverableWebsiteTimeout){

              recoverableWebsiteTimeout=false;
              waitingForInitialWebsitePaint=false;

              cancelWebsiteTimeout();
              finishNavigationProgress();
              finishLoader();

            }else if(
              waitingForInitialWebsitePaint
            ){

              runOnUiThread(()->{
                loadingStatus.setText(
                  "Rendering website..."
                );

                loadingCount.setText(
                  "Waiting for first paint"
                );
              });

            }else{

              cancelWebsiteTimeout();
              finishNavigationProgress();
            }

          }else{

            recoverableWebsiteTimeout=false;

            finishNavigationProgress();
            cancelWebsiteTimeout();

            showWebsiteError(
              "Website could not be loaded."
            );
          }
        }`;

  out=replaceOnce(
    out,
    oldPageStop,
    newPageStop,
    'gecko successful timeout recovery'
  );

  out=replaceOnce(
    out,

    `    websiteTimeout=()->{
      showWebsiteError(
        "Website loading timed out."
      );
    };`,

    `    websiteTimeout=()->{
      recoverableWebsiteTimeout=true;

      showWebsiteError(
        "Website loading timed out."
      );
    };`,

    'gecko recoverable timeout'
  );

  out=replaceOnce(
    out,

    `      waitingForInitialWebsitePaint=true;
      beginWebsiteTimeout();
      session.loadUri(HOME);`,

    `      recoverableWebsiteTimeout=false;
      waitingForInitialWebsitePaint=true;

      beginWebsiteTimeout();
      session.loadUri(HOME);`,

    'gecko retry state reset'
  );

  out=replaceOnce(
    out,

    `      loadingCount.setText(
        safe+"%"
      );`,

    `      loadingCount.setText(
        safe+"%"
      );

      if(
        recoverableWebsiteTimeout &&
        safe>=100
      ){
        if(retryButton!=null){
          retryButton.setVisibility(
            View.GONE
          );
        }

        loadingStatus.setText(
          "Finishing website..."
        );
      }`,

    'gecko automatic 100 percent recovery UI'
  );

  return out;
}

function patchCapacitor(source){
  let out=source;

  out=replaceOnce(
    out,

    `  WebView jepongWebView;
  Button backButton;
  Button forwardButton;`,

    `  WebView jepongWebView;
  Button backButton;
  Button forwardButton;
  ProgressBar navigationProgress;`,

    'capacitor progress field'
  );

  out=replaceOnce(
    out,
    '  int dp(\n',
    sharedHelpers+
    '  int dp(\n',
    'capacitor shared UX helpers'
  );

  out=replaceOnce(
    out,

    `      if(
        CAPACITOR_NAVIGATION_TOOLBAR_ENABLED
      ){
        installCapacitorNavigationToolbar(
          w
        );
      }`,

    `      if(
        CAPACITOR_NAVIGATION_TOOLBAR_ENABLED
      ){
        installCapacitorNavigationToolbar(
          w
        );
      }else{
        applySystemSafeArea(
          w
        );
      }`,

    'capacitor no-toolbar safe area'
  );

  out=replaceOnce(
    out,

    `      owner
        .updateCapacitorNavigationButtons();`,

    `      owner
        .finishNavigationProgress();

      owner
        .updateCapacitorNavigationButtons();`,

    'capacitor page finished'
  );

  out=replaceOnce(
    out,

    `    @Override
    public void onPageFinished(`,

    `    @Override
    public void onReceivedError(
      WebView view,
      WebResourceRequest request,
      WebResourceError error
    ){
      super.onReceivedError(
        view,
        request,
        error
      );

      if(
        request!=null &&
        request.isForMainFrame()
      ){
        owner.finishNavigationProgress();
      }
    }

    @Override
    public void onPageFinished(`,

    'capacitor page error'
  );

  out=replaceOnce(
    out,

    `        if(web.canGoBack()){
          web.goBack();
        }`,

    `        if(web.canGoBack()){
          showNavigationProgress();
          web.goBack();
        }`,

    'capacitor back loading'
  );

  out=replaceOnce(
    out,

    `        if(web.canGoForward()){
          web.goForward();
        }`,

    `        if(web.canGoForward()){
          showNavigationProgress();
          web.goForward();
        }`,

    'capacitor forward loading'
  );

  out=replaceOnce(
    out,

    `    home.setOnClickListener(
      v->web.loadUrl(HOME)
    );`,

    `    home.setOnClickListener(
      v->{
        showNavigationProgress();
        web.loadUrl(HOME);
      }
    );`,

    'capacitor home loading'
  );

  out=replaceOnce(
    out,

    `    reload.setOnClickListener(
      v->web.reload()
    );`,

    `    reload.setOnClickListener(
      v->{
        showNavigationProgress();
        web.reload();
      }
    );`,

    'capacitor reload loading'
  );

  out=replaceOnce(
    out,

    `    shell.addView(
      web,
      new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        0,
        1f
      )
    );

    shell.addView(
      bar,`,

    `    shell.addView(
      web,
      new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        0,
        1f
      )
    );

    navigationProgress=
      makeNavigationProgress();

    shell.addView(
      navigationProgress,
      new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        dp(3)
      )
    );

    shell.addView(
      bar,`,

    'capacitor progress row'
  );

  out=replaceOnce(
    out,

    `    }else{
      parent.addView(
        shell,
        index
      );
    }
  }

  void updateCapacitorNavigationButtons(){`,

    `    }else{
      parent.addView(
        shell,
        index
      );
    }

    applySystemSafeArea(
      shell
    );
  }

  void updateCapacitorNavigationButtons(){`,

    'capacitor toolbar safe area'
  );

  return out;
}

function patchCordova(source){
  let out=source;

  out=replaceOnce(
    out,

    `  Button backButton;
  Button forwardButton;`,

    `  Button backButton;
  Button forwardButton;
  ProgressBar navigationProgress;`,

    'cordova progress field'
  );

  out=replaceOnce(
    out,
    '  int dp(\n',
    sharedHelpers+
    '  int dp(\n',
    'cordova shared UX helpers'
  );

  out=replaceOnce(
    out,

    `      if(
        CORDOVA_NAVIGATION_TOOLBAR_ENABLED
      ){
        installCordovaNavigationToolbar(
          w
        );
      }`,

    `      if(
        CORDOVA_NAVIGATION_TOOLBAR_ENABLED
      ){
        installCordovaNavigationToolbar(
          w
        );
      }else{
        applySystemSafeArea(
          w
        );
      }`,

    'cordova no-toolbar safe area'
  );

  out=replaceOnce(
    out,

    `      owner.updateCordovaNavigationButtons();`,

    `      owner.finishNavigationProgress();
      owner.updateCordovaNavigationButtons();`,

    'cordova page finished'
  );

  out=replaceOnce(
    out,

    `    @Override
    public void onPageFinished(`,

    `    @Override
    public void onReceivedError(
      WebView view,
      WebResourceRequest request,
      WebResourceError error
    ){
      super.onReceivedError(
        view,
        request,
        error
      );

      if(
        request!=null &&
        request.isForMainFrame()
      ){
        owner.finishNavigationProgress();
      }
    }

    @Override
    public void onPageFinished(`,

    'cordova page error'
  );

  out=replaceOnce(
    out,

    `        if(web.canGoBack()){
          web.goBack();
        }`,

    `        if(web.canGoBack()){
          showNavigationProgress();
          web.goBack();
        }`,

    'cordova back loading'
  );

  out=replaceOnce(
    out,

    `        if(web.canGoForward()){
          web.goForward();
        }`,

    `        if(web.canGoForward()){
          showNavigationProgress();
          web.goForward();
        }`,

    'cordova forward loading'
  );

  out=replaceOnce(
    out,

    `        if(appView!=null){
          appView.loadUrl(HOME);
        }`,

    `        if(appView!=null){
          showNavigationProgress();
          appView.loadUrl(HOME);
        }`,

    'cordova home loading'
  );

  out=replaceOnce(
    out,

    `    reload.setOnClickListener(
      v->web.reload()
    );`,

    `    reload.setOnClickListener(
      v->{
        showNavigationProgress();
        web.reload();
      }
    );`,

    'cordova reload loading'
  );

  out=replaceOnce(
    out,

    `    shell.addView(
      web,
      new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        0,
        1f
      )
    );

    shell.addView(
      bar,`,

    `    shell.addView(
      web,
      new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        0,
        1f
      )
    );

    navigationProgress=
      makeNavigationProgress();

    shell.addView(
      navigationProgress,
      new LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        dp(3)
      )
    );

    shell.addView(
      bar,`,

    'cordova progress row'
  );

  out=replaceOnce(
    out,

    `    }else{
      parent.addView(
        shell,
        index
      );
    }
  }

  void updateCordovaNavigationButtons(){`,

    `    }else{
      parent.addView(
        shell,
        index
      );
    }

    applySystemSafeArea(
      shell
    );
  }

  void updateCordovaNavigationButtons(){`,

    'cordova toolbar safe area'
  );

  return out;
}

export function patchCrossEngineBrowserUxSource(
  source,
  engine
){
  if(engine==='native'){
    return patchNative(source);
  }

  if(engine==='gecko'){
    return patchGecko(source);
  }

  if(engine==='capacitor'){
    return patchCapacitor(source);
  }

  if(engine==='cordova'){
    return patchCordova(source);
  }

  throw new Error(
    `Unsupported browser UX engine: ${engine}`
  );
}

export function patchCrossEngineBrowserUx(
  cfg,
  projectDir
){
  if(
    !cfg ||
    ![
      'native',
      'gecko',
      'capacitor',
      'cordova'
    ].includes(cfg.engine)
  ){
    throw new Error(
      'Invalid browser UX engine'
    );
  }

  const packagePath=
    String(cfg.packageName || '')
      .replaceAll(
        '.',
        '/'
      );

  let activityPath;

  if(
    cfg.engine==='native' ||
    cfg.engine==='gecko'
  ){
    activityPath=
      path.join(
        projectDir,
        'app/src/main/java',
        packagePath,
        'MainActivity.java'
      );

  }else if(
    cfg.engine==='capacitor'
  ){
    activityPath=
      path.join(
        projectDir,
        'android/app/src/main/java',
        packagePath,
        'MainActivity.java'
      );

  }else{
    activityPath=
      path.join(
        projectDir,
        'platforms/android/app/src/main/java',
        packagePath,
        'MainActivity.java'
      );
  }

  if(!fs.existsSync(activityPath)){
    throw new Error(
      `Browser UX activity missing: ${activityPath}`
    );
  }

  const source=
    fs.readFileSync(
      activityPath,
      'utf8'
    );

  const patched=
    patchCrossEngineBrowserUxSource(
      source,
      cfg.engine
    );

  if(patched===source){
    throw new Error(
      `Browser UX patch made no changes for ${cfg.engine}`
    );
  }

  fs.writeFileSync(
    activityPath,
    patched
  );

  return activityPath;
}
