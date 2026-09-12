import fs from 'node:fs';
import path from 'node:path';

function replaceOnce(source, needle, replacement, label) {
  const first=source.indexOf(needle);
  if(first<0){
    throw new Error(`Gecko startup patch marker missing: ${label}`);
  }
  if(source.indexOf(needle, first+needle.length)>=0){
    throw new Error(`Gecko startup patch marker is ambiguous: ${label}`);
  }
  return source.slice(0,first)+replacement+source.slice(first+needle.length);
}

function replaceRangeOnce(source, start, end, replacement, label) {
  const first=source.indexOf(start);
  if(first<0){
    throw new Error(`Gecko startup patch start marker missing: ${label}`);
  }
  if(source.indexOf(start, first+start.length)>=0){
    throw new Error(`Gecko startup patch start marker is ambiguous: ${label}`);
  }
  const last=source.indexOf(end, first+start.length);
  if(last<0){
    throw new Error(`Gecko startup patch end marker missing: ${label}`);
  }
  return source.slice(0,first)+replacement+source.slice(last);
}

export function patchGeckoActivitySource(source) {
  let out=String(source);

  const transparentBars=`    if(Build.VERSION.SDK_INT>=29){
      getWindow()
        .setNavigationBarColor(
          Color.TRANSPARENT
        );

      getWindow()
        .setStatusBarColor(
          Color.TRANSPARENT
        );
    }`;

  if(out.includes(transparentBars)){
    out=replaceOnce(
      out,
      transparentBars,
      `    if(Build.VERSION.SDK_INT>=29){
      getWindow()
        .setNavigationBarColor(
          Color.TRANSPARENT
        );

      getWindow()
        .setStatusBarColor(
          Color.TRANSPARENT
        );

      android.util.Log.i(
        "JepongRuntimeBars",
        "status=" + getWindow().getStatusBarColor()
          + " navigation=" + getWindow().getNavigationBarColor()
      );
    }`,
      'transparent system bar runtime evidence'
    );
  }

  out=replaceOnce(
    out,
    `  boolean started=false;\n\n  AtomicInteger extensionDone=`,
    `  boolean started=false;\n  boolean waitingForInitialWebsitePaint=false;\n\n  AtomicInteger extensionDone=`,
    'first-paint state'
  );

  const crashMarker=`        @Override
        public void onCrash(
          GeckoSession currentSession
        ){`;

  out=replaceOnce(
    out,
    crashMarker,
    `        @Override
        public void onFirstContentfulPaint(
          GeckoSession currentSession
        ){
          if(!waitingForInitialWebsitePaint){
            return;
          }

          waitingForInitialWebsitePaint=false;
          cancelWebsiteTimeout();
          finishLoader();
        }

${crashMarker}`,
    'first contentful paint callback'
  );

  const oldPageStop=`        @Override
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
        }`;

  const newPageStop=`        @Override
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

  out=replaceOnce(
    out,
    oldPageStop,
    newPageStop,
    'page stop first-paint gate'
  );

  out=replaceRangeOnce(
    out,
    `        final WebExtensionController verifyController=`,
    `

      }else{`,
    `        loadWebsite();`,
    'redundant extension re-list delay'
  );

  out=replaceOnce(
    out,
    `          hideActionButtons();
          hideExtensionLoader();
          loadWebsite();`,
    `          hideActionButtons();
          loadWebsite();`,
    'continue transition loader continuity'
  );

  out=replaceOnce(
    out,
    `      loadingCount.setText(
        "Starting GeckoView"
      );

      session.loadUri(HOME);`,
    `      loadingCount.setText(
        "Starting GeckoView"
      );

      waitingForInitialWebsitePaint=true;
      beginWebsiteTimeout();
      session.loadUri(HOME);`,
    'website first-paint start'
  );

  out=replaceOnce(
    out,
    `  void showWebsiteError(
    String message
  ){
    runOnUiThread(()->{

      cancelWebsiteTimeout();`,
    `  void showWebsiteError(
    String message
  ){
    runOnUiThread(()->{

      waitingForInitialWebsitePaint=false;
      cancelWebsiteTimeout();`,
    'website error state reset'
  );

  const enqueueMarker=`  void enqueueDownload(
    WebResponse response
  ){`;

  out=replaceOnce(
    out,
    enqueueMarker,
    `  String responseHeader(
    WebResponse response,
    String name
  ){
    if(
      response==null ||
      response.headers==null ||
      name==null
    ){
      return null;
    }

    String direct=
      response.headers.get(name);

    if(direct!=null){
      return direct;
    }

    for(Map.Entry<String,String> entry:
      response.headers.entrySet()
    ){
      if(
        entry.getKey()!=null &&
        entry.getKey().equalsIgnoreCase(name)
      ){
        return entry.getValue();
      }
    }

    return null;
  }

${enqueueMarker}`,
    'case-insensitive response header helper'
  );

  out=replaceOnce(
    out,
    `      String disposition=
        response.headers.get(
          "content-disposition"
        );

      String mime=
        response.headers.get(
          "content-type"
        );`,
    `      String disposition=
        responseHeader(response, "content-disposition");

      String mime=
        responseHeader(response, "content-type");`,
    'download response header lookup'
  );

  return out;
}

export function patchGeckoStartup(cfg, projectDir) {
  if(!cfg || cfg.engine!=='gecko'){
    return false;
  }

  const packagePath=String(cfg.packageName || '').replaceAll('.', '/');

  const activityPath=path.join(
    projectDir,
    'app/src/main/java',
    packagePath,
    'MainActivity.java'
  );

  const source=fs.readFileSync(activityPath,'utf8');
  const patched=patchGeckoActivitySource(source);

  if(patched===source){
    throw new Error('Gecko startup patch made no changes');
  }

  fs.writeFileSync(activityPath,patched);
  return true;
}
