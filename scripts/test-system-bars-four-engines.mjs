import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { patchSystemBars } from './patch-system-bars.mjs';

const engines=['native','gecko','capacitor','cordova'];
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'jepong-system-bars-'));

try{
  for(const engine of engines){
    const packageName=`com.jepongdevxyz.${engine}bars`;
    const project=path.join(temp,engine);
    const appRoot=(engine==='native'||engine==='gecko')
      ? path.join(project,'app')
      : engine==='capacitor'
        ? path.join(project,'android/app')
        : path.join(project,'platforms/android/app');
    const javaFile=path.join(appRoot,'src/main/java',...packageName.split('.'),'MainActivity.java');
    fs.mkdirSync(path.dirname(javaFile),{recursive:true});
    fs.writeFileSync(javaFile,`package ${packageName};
public class MainActivity extends android.app.Activity {
  @Override public void onCreate(android.os.Bundle state){
    super.onCreate(state);
    if(android.os.Build.VERSION.SDK_INT>=29){getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT); getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);}
  }
}`);

    patchSystemBars({engine,packageName},project);
    const result=fs.readFileSync(javaFile,'utf8');
    for(const token of [
      'applyJepongSystemBars(); /* JEPONG_SYSTEM_BARS_ON_CREATE */',
      'setStatusBarColor(android.graphics.Color.rgb(17,24,39))',
      'SYSTEM_UI_FLAG_LIGHT_STATUS_BAR',
      'APPEARANCE_LIGHT_STATUS_BARS'
    ]){
      if(!result.includes(token)) throw new Error(`${engine} missing system-bar contract: ${token}`);
    }
    if(result.includes('setStatusBarColor(android.graphics.Color.TRANSPARENT)')){
      throw new Error(`${engine} still makes status bar transparent`);
    }
    if(!result.includes('setNavigationBarColor(android.graphics.Color.TRANSPARENT)')){
      throw new Error(`${engine} transparent navigation option was not preserved`);
    }
  }
  console.log('✓ Dark portrait/landscape status-bar contract verified for Native, Gecko, Capacitor, Cordova');
} finally {
  fs.rmSync(temp,{recursive:true,force:true});
}
