import fs from 'node:fs';
import path from 'node:path';

export function patchNativeExitConfirmation(cfg,out){
  if(cfg?.engine && cfg.engine!=='native') return;

  const nsPath=cfg.packageName.replaceAll('.','/');
  const file=path.join(
    out,
    'app/src/main/java',
    nsPath,
    'MainActivity.java'
  );

  let source=fs.readFileSync(file,'utf8');
  const needle='  @Override public void onBackPressed(){ if(web!=null&&web.canGoBack()) web.goBack(); else super.onBackPressed(); }';
  const replacement=`  void showExitConfirmation(){
    new AlertDialog.Builder(this)
      .setTitle("Exit app?")
      .setMessage("Are you sure you want to exit?")
      .setNegativeButton("Cancel",null)
      .setPositiveButton("Exit",(dialog,which)->finish())
      .show();
  }
  @Override public void onBackPressed(){ if(web!=null&&web.canGoBack()) web.goBack(); else showExitConfirmation(); }`;

  if(!source.includes(needle)){
    throw new Error('Native exit confirmation patch marker missing');
  }

  if(source.indexOf(needle)!==source.lastIndexOf(needle)){
    throw new Error('Native exit confirmation patch marker ambiguous');
  }

  source=source.replace(needle,replacement);
  fs.writeFileSync(file,source);
}
