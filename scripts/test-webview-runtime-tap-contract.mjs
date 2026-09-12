import fs from 'node:fs';

const source=fs.readFileSync(
  new URL('./runtime/webview-engine-controls-smoke-core.mjs',import.meta.url),
  'utf8'
);

for(const label of ['NEXT_PAGE','EXTERNAL_LINK','DOWNLOAD_FILE']){
  if(!source.includes(`await tapText('${label}');`)){
    throw new Error(`WebView runtime smoke must tap the actual accessibility target: ${label}`);
  }
}

for(const brittle of ['await tapWeb(0.17);','await tapWeb(0.36);','await tapWeb(0.55);']){
  if(source.includes(brittle)){
    throw new Error(`WebView runtime smoke must not use brittle screen-coordinate tap: ${brittle}`);
  }
}

const reloadStart=source.indexOf("stage('toolbar-reload');");
const externalStart=source.indexOf("stage('external-link');",reloadStart);

if(reloadStart<0 || externalStart<0){
  throw new Error('WebView runtime smoke reload/external stages are missing');
}

const reloadBlock=source.slice(reloadStart,externalStart);

if(!reloadBlock.includes("requests.get('/state/home')")){
  throw new Error('WebView reload verification must snapshot the rendered home pageshow state');
}

if(!reloadBlock.includes("await waitForRequest('/state/home'")){
  throw new Error('WebView reload verification must wait for rendered home before accessibility taps');
}

console.log('✓ WebView runtime smoke taps actual page controls after rendered reload');
