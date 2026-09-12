import fs from 'node:fs';
import assert from 'node:assert/strict';

const verifier=fs.readFileSync(new URL('./runtime/task4-download-smoke-wrapper.mjs',import.meta.url),'utf8');
const entry=fs.readFileSync(new URL('./runtime/webview-engine-controls-smoke.mjs',import.meta.url),'utf8');

const includes=(text,needle,message)=>assert.ok(text.includes(needle),message);

includes(verifier,"const expectedPath=\`/sdcard/Download/task4-\${engine}.txt\`;",'WebView runtime must require exact public Downloads filename');
includes(verifier,"const expectedCanonicalPath=\`/storage/emulated/0/Download/task4-\${engine}.txt\`;",'WebView runtime must require canonical public Downloads path');
includes(verifier,"await adb('shell','cat',expectedPath)",'WebView runtime must read back exact downloaded contents');
includes(verifier,"await adb('shell','readlink','-f',expectedPath)",'WebView runtime must verify canonical downloaded path');
includes(verifier,"Finished with status SUCCESS",'WebView runtime must require DownloadManager SUCCESS evidence');
assert.ok(!verifier.includes("content://downloads/my_downloads"),'API35 WebView verification must not depend on shell-inaccessible DownloadProvider rows');
includes(entry,'task4-download-smoke-wrapper.mjs','WebView entry must execute the strict download verifier');

console.log('✓ strict WebView API35 download contract');
