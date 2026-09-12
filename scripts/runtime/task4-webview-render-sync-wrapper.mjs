import fs from 'node:fs';
import {runPatchedSmoke} from './task4-download-smoke-wrapper.mjs';

const reloadNeedle=`  stage('toolbar-reload');
  const beforeReload=requests.get('/index.html')||0;
  await tapText('Reload');
  await waitForRequest('/index.html',beforeReload+1);`;

const reloadReplacement=`  stage('toolbar-reload');
  const beforeReload=requests.get('/index.html')||0;
  const beforeReloadState=requests.get('/state/home')||0;
  await tapText('Reload');
  await waitForRequest('/index.html',beforeReload+1);
  await waitForRequest('/state/home',beforeReloadState+1);`;

export function patchWebViewRenderSynchronization(source){
  const text=String(source);
  const first=text.indexOf(reloadNeedle);

  if(first<0){
    throw new Error('WebView reload render synchronization marker missing');
  }

  if(text.indexOf(reloadNeedle,first+reloadNeedle.length)>=0){
    throw new Error('WebView reload render synchronization marker ambiguous');
  }

  return (
    text.slice(0,first)+
    reloadReplacement+
    text.slice(first+reloadNeedle.length)
  );
}

export function runRenderSyncedWebViewSmoke(coreUrl){
  const source=fs.readFileSync(coreUrl,'utf8');
  const patched=patchWebViewRenderSynchronization(source);
  const target=new URL(
    `./.task4-webview-render-sync-${process.pid}.mjs`,
    import.meta.url
  );

  fs.writeFileSync(target,patched);

  try{
    runPatchedSmoke('webview',target);
  }finally{
    fs.rmSync(target,{force:true});
  }
}
