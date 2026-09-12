import fs from 'node:fs';
import assert from 'node:assert/strict';

const verifier=fs.readFileSync(new URL('./runtime/task4-download-smoke-wrapper.mjs',import.meta.url),'utf8');
const renderSync=fs.readFileSync(new URL('./runtime/task4-webview-render-sync-wrapper.mjs',import.meta.url),'utf8');
const entry=fs.readFileSync(new URL('./runtime/webview-engine-controls-smoke.mjs',import.meta.url),'utf8');

const includes=(text,needle,message)=>assert.ok(text.includes(needle),message);

includes(
  verifier,
  String.raw`const expectedPath=\`/sdcard/Download/task4-\${engine}-download.txt\`;`,
  'WebView runtime must require the exact advertised public Downloads filename'
);
includes(
  verifier,
  String.raw`const expectedCanonicalPath=\`/storage/emulated/0/Download/task4-\${engine}-download.txt\`;`,
  'WebView runtime must require the exact advertised canonical Downloads path'
);
includes(verifier,"await adb('shell','cat',expectedPath)",'WebView runtime must read back exact downloaded contents');
includes(verifier,"await adb('shell','readlink','-f',expectedPath)",'WebView runtime must verify canonical downloaded path');
includes(verifier,"Finished with status SUCCESS",'WebView runtime must require DownloadManager SUCCESS evidence');
assert.ok(!verifier.includes("content://downloads/my_downloads"),'API35 WebView verification must not depend on shell-inaccessible DownloadProvider rows');

includes(entry,'task4-webview-render-sync-wrapper.mjs','WebView entry must execute the render-synchronized wrapper');
includes(renderSync,'task4-download-smoke-wrapper.mjs','Render synchronization wrapper must preserve the strict download verifier');
includes(renderSync,"runPatchedSmoke('webview',target)",'Render synchronization wrapper must execute the strict WebView verifier');

console.log('✓ strict WebView API35 download contract');
