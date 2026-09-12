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
  const oldBack='  @Override public void onBackPressed(){ if(web!=null&&web.canGoBack()) web.goBack(); else super.onBackPressed(); }';
  const replacement=`  void showExitConfirmation(){
    new AlertDialog.Builder(this)
      .setTitle("Exit app?")
      .setMessage("Are you sure you want to exit?")
      .setNegativeButton("Cancel",null)
      .setPositiveButton("Exit",(dialog,which)->finish())
      .show();
  }
  @Override public void onBackPressed(){ if(web!=null&&web.canGoBack()) web.goBack(); else showExitConfirmation(); }`;

  if(source.includes('void showExitConfirmation()')){
    throw new Error('Native exit confirmation already present');
  }

  if(source.includes(oldBack)){
    if(source.indexOf(oldBack)!==source.lastIndexOf(oldBack)){
      throw new Error('Native exit confirmation raw back marker ambiguous');
    }
    source=source.replace(oldBack,replacement);
  }else{
    if(source.includes('onBackPressed()')){
      throw new Error('Native exit confirmation found unexpected back-handler shape');
    }
    const classEnd=source.lastIndexOf('\n}');
    if(classEnd<0) throw new Error('Native exit confirmation class end marker missing');
    source=source.slice(0,classEnd)+'\n'+replacement+'\n'+source.slice(classEnd);
  }

  fs.writeFileSync(file,source);
}
