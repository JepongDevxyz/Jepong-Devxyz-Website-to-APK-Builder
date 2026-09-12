import fs from 'node:fs';
import assert from 'node:assert/strict';

const core=fs.readFileSync(new URL('./runtime/gecko-controls-smoke-core.mjs',import.meta.url),'utf8');
const entry=fs.readFileSync(new URL('./runtime/gecko-controls-smoke.mjs',import.meta.url),'utf8');

const includes=(text,needle,message)=>assert.ok(text.includes(needle),message);

includes(core,"const expectedPath='/sdcard/Download/task4-download.txt';",'Gecko download smoke must require the exact public Downloads path');
includes(core,"const expectedCanonicalPath='/storage/emulated/0/Download/task4-download.txt';",'Gecko download smoke must verify the canonical public Downloads path');
includes(core,"await run('shell','cat',expectedPath)",'Gecko download smoke must verify actual downloaded bytes');
includes(core,'Finished with status SUCCESS','Gecko download smoke must require DownloadManager SUCCESS evidence');
includes(core,"stage('transparent-system-bars')",'Gecko runtime smoke must explicitly verify transparent system bars');
includes(core,'mStatusBarColor','Gecko runtime smoke must inspect status bar transparency');
includes(core,'mNavigationBarColor','Gecko runtime smoke must inspect navigation bar transparency');
includes(core,"stage('exit-confirmation-cancel')",'Gecko runtime smoke must exercise CANCEL');
includes(core,"stage('exit-confirmation-exit')",'Gecko runtime smoke must exercise EXIT');
includes(core,'await tapText(exit.value)','Gecko runtime smoke must actually press EXIT');
assert.ok(!entry.includes('task4-download-smoke-wrapper'),'Final Gecko smoke must not weaken strict download assertions through a wrapper');
includes(entry,'gecko-controls-smoke-core.mjs','Final Gecko smoke must execute the strict Gecko core directly');

console.log('✓ Gecko runtime smoke strict contract');
