import fs from 'node:fs';
import path from 'node:path';

function appRoot(cfg, projectDir){
  if(cfg.engine==='native' || cfg.engine==='gecko') return path.join(projectDir,'app');
  if(cfg.engine==='capacitor') return path.join(projectDir,'android/app');
  if(cfg.engine==='cordova') return path.join(projectDir,'platforms/android/app');
  throw new Error(`Unsupported engine for system bars: ${cfg.engine}`);
}

function activityPath(cfg, projectDir){
  return path.join(
    appRoot(cfg,projectDir),
    'src/main/java',
    ...String(cfg.packageName||'').split('.'),
    'MainActivity.java'
  );
}

const helper=`
  void applyJepongSystemBars(){
    final android.view.Window window=getWindow();
    if(window==null)return;

    // Keep the Android status area dark in portrait and landscape. Some OEMs
    // otherwise expose the light window background after a configuration
    // change, which creates the white strip above the website.
    window.setStatusBarColor(android.graphics.Color.rgb(17,24,39));

    final android.view.View decor=window.getDecorView();
    if(decor!=null && android.os.Build.VERSION.SDK_INT>=23){
      decor.setSystemUiVisibility(
        decor.getSystemUiVisibility() &
        ~android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
      );
    }

    if(android.os.Build.VERSION.SDK_INT>=30){
      final android.view.WindowInsetsController controller=
        window.getInsetsController();
      if(controller!=null){
        controller.setSystemBarsAppearance(
          0,
          android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
        );
      }
    }
  }

`;

export function patchSystemBars(cfg, projectDir){
  const file=activityPath(cfg,projectDir);
  if(!fs.existsSync(file)){
    throw new Error(`${cfg.engine} MainActivity missing for system-bar patch: ${file}`);
  }

  let source=fs.readFileSync(file,'utf8');

  // Preserve the optional transparent navigation-bar control, but never make
  // the status bar transparent: transparent status bars are what expose the
  // white website/window background in landscape on affected devices.
  source=source.replaceAll(
    'getWindow().setStatusBarColor(Color.TRANSPARENT);',
    'getWindow().setStatusBarColor(Color.rgb(17,24,39));'
  );
  source=source.replaceAll(
    'getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);',
    'getWindow().setStatusBarColor(android.graphics.Color.rgb(17,24,39));'
  );

  if(!source.includes('void applyJepongSystemBars(){')){
    const classOpen=source.indexOf('{',source.indexOf('class MainActivity'));
    if(classOpen<0) throw new Error(`${cfg.engine} MainActivity class marker missing`);
    source=source.slice(0,classOpen+1)+'\n'+helper+source.slice(classOpen+1);
  }

  if(!source.includes('/* JEPONG_SYSTEM_BARS_ON_CREATE */')){
    const re=/super\.onCreate\s*\([^;]*\);/;
    const match=source.match(re);
    if(!match) throw new Error(`${cfg.engine} onCreate super call missing for system-bar patch`);
    source=source.replace(
      re,
      `${match[0]}\n    applyJepongSystemBars(); /* JEPONG_SYSTEM_BARS_ON_CREATE */`
    );
  }

  fs.writeFileSync(file,source);
  return file;
}
