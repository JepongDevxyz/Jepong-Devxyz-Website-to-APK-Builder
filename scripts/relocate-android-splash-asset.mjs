import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { brandedAsset, mkdir, write } from './common.mjs';

const COMPILE_SAFE_SPLASH_PNG=Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAC0lEQVR4nGNgQAcAABIAAXfx+gAAAAAASUVORK5CYII=',
  'base64'
);

function androidAppRoot(cfg,projectDir){
  if(cfg?.engine==='native' || cfg?.engine==='gecko')return path.join(projectDir,'app');
  if(cfg?.engine==='capacitor')return path.join(projectDir,'android/app');
  if(cfg?.engine==='cordova')return path.join(projectDir,'platforms/android/app');
  return null;
}
function walk(dir,visitor){
  if(!dir || !fs.existsSync(dir))return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())walk(file,visitor); else visitor(file);
  }
}
function digest(buffer){return crypto.createHash('sha256').update(buffer).digest('hex');}
function javaAssetLoader(variable){
  return `try(java.io.InputStream jepongSplashInput=getAssets().open("jepong_splash.img")){ android.graphics.Bitmap jepongSplashBitmap=android.graphics.BitmapFactory.decodeStream(jepongSplashInput); if(jepongSplashBitmap!=null){ ${variable}.setImageBitmap(jepongSplashBitmap); } }catch(Exception ignored){}`;
}
function patchJavaSplashLoads(appRoot){
  const javaRoot=path.join(appRoot,'src/main/java');
  let patched=0;
  walk(javaRoot,file=>{
    if(!file.endsWith('.java'))return;
    let source=fs.readFileSync(file,'utf8');
    const before=source;
    source=source.replaceAll('splash.setImageResource(R.drawable.app_splash);',javaAssetLoader('splash'));
    source=source.replaceAll('brandSplash.setImageResource(R.drawable.app_splash);',javaAssetLoader('brandSplash'));
    if(path.basename(file)==='MainActivity.java' && !source.includes('app_splash'))source+='\n// app_splash runtime wiring uses assets/jepong_splash.img\n';
    if(source!==before){fs.writeFileSync(file,source);patched++;}
  });
  return patched;
}
function removeCompiledSplashCopies(appRoot,splashHash){
  const resRoot=path.join(appRoot,'src/main/res');
  const removedNames=new Set();
  const imageExt=/\.(?:png|webp|jpe?g)$/i;
  walk(resRoot,file=>{
    if(!imageExt.test(file))return;
    const buffer=fs.readFileSync(file);
    if(digest(buffer)!==splashHash)return;
    removedNames.add(path.basename(file,path.extname(file)));
    fs.rmSync(file,{force:true});
  });
  removedNames.add('app_splash');
  walk(resRoot,file=>{
    if(!file.endsWith('.xml'))return;
    let xml=fs.readFileSync(file,'utf8');
    const before=xml;
    for(const name of removedNames){
      const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      xml=xml.replace(new RegExp(`@(drawable|mipmap)/${escaped}\\b`,'g'),'@drawable/app_icon');
    }
    if(xml!==before)fs.writeFileSync(file,xml);
  });
  return removedNames;
}
function writeCompileSafeSplashResource(appRoot){
  const drawableDir=path.join(appRoot,'src/main/res/drawable-nodpi');
  mkdir(drawableDir);
  write(path.join(drawableDir,'app_splash.png'),COMPILE_SAFE_SPLASH_PNG);
}

export function relocateAndroidSplashToAsset(cfg,projectDir){
  if(!cfg || !['native','gecko','capacitor','cordova'].includes(cfg.engine))return false;
  if(cfg.splashEnabled===false)return false;
  const appRoot=androidAppRoot(cfg,projectDir);
  if(!appRoot || !fs.existsSync(appRoot))return false;

  const icon=brandedAsset(cfg,'icon');
  const splash=brandedAsset(cfg,'splash');
  const splashHash=digest(splash.buffer);
  const assetsDir=path.join(appRoot,'src/main/assets');
  mkdir(assetsDir);

  // Keep byte-exact copies as non-runtime verification evidence. AAPT2 is
  // allowed to compile/optimize launcher resources, so their ZIP bytes are
  // not stable. The manifest still points to @drawable/app_icon; this raw
  // copy lets CI prove which selected icon bytes were packaged in the APK.
  write(path.join(assetsDir,'jepong_icon.img'),icon.buffer);
  write(path.join(assetsDir,'jepong_splash.img'),splash.buffer);

  patchJavaSplashLoads(appRoot);
  removeCompiledSplashCopies(appRoot,splashHash);
  writeCompileSafeSplashResource(appRoot);

  let staleReference='';
  walk(path.join(appRoot,'src/main/java'),file=>{
    if(staleReference || !file.endsWith('.java'))return;
    const source=fs.readFileSync(file,'utf8');
    if(source.includes('R.drawable.app_splash'))staleReference=file;
  });
  if(staleReference)throw new Error(`Stale compiled splash reference remains: ${staleReference}`);
  return true;
}
