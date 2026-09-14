import fs from 'node:fs';
import path from 'node:path';

function mainActivityPath(cfg,projectDir){
  const pkg=String(cfg?.packageName||'')
    .split('.')
    .filter(Boolean);

  if(cfg?.engine==='native' || cfg?.engine==='gecko'){
    return path.join(
      projectDir,
      'app/src/main/java',
      ...pkg,
      'MainActivity.java'
    );
  }

  if(cfg?.engine==='capacitor'){
    return path.join(
      projectDir,
      'android/app/src/main/java',
      ...pkg,
      'MainActivity.java'
    );
  }

  if(cfg?.engine==='cordova'){
    return path.join(
      projectDir,
      'platforms/android/app/src/main/java',
      ...pkg,
      'MainActivity.java'
    );
  }

  return null;
}

function injectAfterSuper(source,methodName,statement){
  const methodIndex=source.indexOf(`void ${methodName}(`);
  if(methodIndex<0)return source;

  const superNeedle=`super.${methodName}`;
  const superIndex=source.indexOf(superNeedle,methodIndex);
  if(superIndex<0)return source;

  const semi=source.indexOf(';',superIndex);
  if(semi<0)return source;

  const nearby=source.slice(semi+1,semi+1+160);
  if(nearby.includes(statement.trim()))return source;

  return source.slice(0,semi+1)+`\n    ${statement}`+source.slice(semi+1);
}

function appendBeforeClassEnd(source,block){
  const end=source.lastIndexOf('\n}');
  if(end<0){
    throw new Error('MainActivity class end marker missing for system bar patch');
  }
  return source.slice(0,end)+`\n\n${block}\n`+source.slice(end);
}

function patchLifecycle(source){
  let out=source;

  if(/void\s+onResume\s*\(/.test(out)){
    out=injectAfterSuper(out,'onResume','applyJepongSystemBars();');
  }else{
    out=appendBeforeClassEnd(
      out,
      `  @Override\n  protected void onResume(){\n    super.onResume();\n    applyJepongSystemBars();\n  }`
    );
  }

  if(/void\s+onConfigurationChanged\s*\(/.test(out)){
    out=injectAfterSuper(
      out,
      'onConfigurationChanged',
      'applyJepongSystemBars();'
    );
  }else{
    out=appendBeforeClassEnd(
      out,
      `  @Override\n  public void onConfigurationChanged(\n    android.content.res.Configuration newConfig\n  ){\n    super.onConfigurationChanged(newConfig);\n    applyJepongSystemBars();\n  }`
    );
  }

  return out;
}

export function patchAndroidSystemBars(cfg,projectDir){
  if(
    !cfg ||
    !['native','gecko','capacitor','cordova'].includes(cfg.engine)
  ){
    return false;
  }

  const file=mainActivityPath(cfg,projectDir);
  if(!file || !fs.existsSync(file)){
    throw new Error(`MainActivity missing for system bar patch: ${file}`);
  }

  let source=fs.readFileSync(file,'utf8');
  if(source.includes('void applyJepongSystemBars()')){
    return true;
  }

  const transparent=(cfg.controls||[]).includes('transparentNav');

  const onCreateSuper=/super\.onCreate\([^;]*\);/;
  const onCreateMatch=source.match(onCreateSuper);
  if(!onCreateMatch){
    throw new Error(`${cfg.engine} onCreate super call missing for system bar patch`);
  }

  source=source.replace(
    onCreateSuper,
    `${onCreateMatch[0]}\n    applyJepongSystemBars();`
  );

  const helper=`  void applyJepongSystemBars(){
    android.view.Window window=getWindow();
    if(window==null){
      return;
    }

    final int barColor=
      ${transparent}
        ? android.graphics.Color.TRANSPARENT
        : android.graphics.Color.BLACK;

    window.setStatusBarColor(barColor);
    window.setNavigationBarColor(barColor);

    if(android.os.Build.VERSION.SDK_INT>=28){
      window.setNavigationBarDividerColor(
        android.graphics.Color.BLACK
      );
    }

    if(android.os.Build.VERSION.SDK_INT>=29){
      window.setStatusBarContrastEnforced(false);
      window.setNavigationBarContrastEnforced(false);
    }

    android.view.View decor=window.getDecorView();
    if(decor!=null){
      decor.setBackgroundColor(
        android.graphics.Color.BLACK
      );
    }

    if(android.os.Build.VERSION.SDK_INT>=30){
      android.view.WindowInsetsController controller=
        window.getInsetsController();

      if(controller!=null){
        controller.setSystemBarsAppearance(
          0,
          android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS |
          android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
        );
      }
    }else if(decor!=null){
      int flags=decor.getSystemUiVisibility();
      flags &= ~android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;

      if(android.os.Build.VERSION.SDK_INT>=26){
        flags &= ~android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
      }

      decor.setSystemUiVisibility(flags);
    }
  }`;

  source=appendBeforeClassEnd(source,helper);
  source=patchLifecycle(source);

  fs.writeFileSync(file,source);
  return true;
}
