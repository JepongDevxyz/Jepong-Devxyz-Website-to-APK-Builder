import fs from 'node:fs';

const source=fs.readFileSync(
  new URL('./patch-android-platform.mjs',import.meta.url),
  'utf8'
);

const capacitorStart=source.indexOf("if(base==='capacitor') return `package");
const cordovaStart=source.indexOf(' return `package ${cfg.packageName};',capacitorStart+1);

if(capacitorStart<0 || cordovaStart<0){
  throw new Error('Could not isolate Cordova Android source template');
}

const cordova=source.slice(cordovaStart);
const clientStart=cordova.indexOf('static class JepongSystemWebViewClient');
const clientEnd=cordova.indexOf('\n  int dp(',clientStart);

if(clientStart<0 || clientEnd<0){
  throw new Error('Could not isolate JepongSystemWebViewClient');
}

const client=cordova.slice(clientStart,clientEnd);

if(!client.includes('request.hasGesture()')){
  throw new Error('Cordova external app routing must remain user-gesture gated');
}

const openIndex=client.indexOf('owner.openExternalUrl(uri);');
const superIndex=client.indexOf('return super.shouldOverrideUrlLoading(');

if(openIndex<0 || superIndex<0 || openIndex>superIndex){
  throw new Error('Cordova must route eligible external links before delegating to SystemWebViewClient');
}

for(const scheme of ['tel','mailto','sms','geo']){
  const token=`\"${scheme}\".equalsIgnoreCase(scheme)`;
  if(!cordova.includes(token)){
    throw new Error(`Cordova external routing must explicitly support ${scheme}: links`);
  }
}

console.log('✓ Cordova user-gesture external app schemes are routed explicitly');
