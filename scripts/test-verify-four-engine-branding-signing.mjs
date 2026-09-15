import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT=path.resolve(process.cwd());
const sandbox=fs.mkdtempSync(path.join(os.tmpdir(),'jepong-four-engine-verify-'));
const output=path.join(sandbox,'report.json');
const strictOutput=path.join(sandbox,'strict-report.json');
const emptySdk=path.join(sandbox,'android-sdk-not-installed');

const run=spawnSync(
  process.execPath,
  [
    'scripts/verify-four-engine-branding-signing.mjs',
    '--android-sdk',emptySdk,
    '--keep',
    '--output',output
  ],
  {
    cwd:ROOT,
    encoding:'utf8',
    env:{...process.env,JEPONG_TASK4_TEST_SECRET:'must-not-appear'}
  }
);

assert.equal(run.status,0,`helper failed: ${run.stderr}`);
assert.equal(run.stdout,'','machine-readable helper output must be written only to --output');
assert.equal(run.stderr,'','helper must not emit missing-tool noise to stderr');
assert.ok(fs.existsSync(output),'helper must write its requested report');
assert.ok(!run.stdout.includes('JEPONG_TASK4_TEST_SECRET'),'helper must not print environment secret names');
assert.ok(!run.stdout.includes('must-not-appear'),'helper must not print environment secret values');

const report=JSON.parse(fs.readFileSync(output,'utf8'));
const reportText=JSON.stringify(report);
assert.ok(!reportText.includes('JEPONG_TASK4_TEST_SECRET'),'helper report must not include environment secret names');
assert.ok(!reportText.includes('must-not-appear'),'helper report must not include environment secret values');
assert.deepEqual(report.engines.map(result=>result.engine),['native','gecko','capacitor','cordova']);
assert.equal(report.requested.build,false,'builds must require explicit opt-in');
assert.equal(report.tools.androidSdk.available,false,'missing Android SDK must be reported honestly');
assert.equal(report.tools.apksigner.available,false,'missing apksigner must be reported honestly');
assert.match(report.limitations.join('\n'),/Android SDK unavailable/,'missing SDK limitation must be explicit');

for(const result of report.engines){
  assert.match(result.buildId,/^four-engine-branding-signing-/,'each engine must receive a fresh build ID');
  assert.equal(result.generated,true,`${result.engine}: fresh project generation failed`);
  assert.equal(result.branding.bootstrap.status,'verified',`${result.engine}: bootstrap branding was not checked`);
  assert.equal(result.branding.finalAndroid.status,result.engine==='native'||result.engine==='gecko'?'verified':'not-generated');
  assert.ok(fs.existsSync(path.join(ROOT,'builds',`${result.buildId}.json`)),`${result.engine}: fresh config was not created`);
  assert.ok(fs.existsSync(result.project),`${result.engine}: generated project was not retained`);
}

const strictRun=spawnSync(
  process.execPath,
  [
    'scripts/verify-four-engine-branding-signing.mjs',
    '--android-sdk',emptySdk,
    '--build',
    '--strict-signing',
    '--keep',
    '--output',strictOutput
  ],
  {
    cwd:ROOT,
    encoding:'utf8',
    env:{...process.env,JEPONG_TASK4_TEST_SECRET:'must-not-appear'}
  }
);

assert.notEqual(strictRun.status,0,'strict signing mode must fail when requested builds are skipped');
assert.equal(strictRun.stdout,'','strict helper output must be written only to --output');
assert.equal(strictRun.stderr,'','strict helper must not emit missing-tool noise to stderr');
const strictReport=JSON.parse(fs.readFileSync(strictOutput,'utf8'));
assert.equal(strictReport.requested.strictSigning,true,'strict mode must be recorded in the report');
assert.ok(
  strictReport.engines.every(result=>result.build.status==='skipped'),
  'strict missing-SDK fixture must report skipped builds distinctly'
);

for(const result of strictReport.engines){
  fs.rmSync(path.join(ROOT,'builds',`${result.buildId}.json`),{force:true});
  fs.rmSync(path.dirname(result.project),{recursive:true,force:true});
}

for(const result of report.engines){
  fs.rmSync(path.join(ROOT,'builds',`${result.buildId}.json`),{force:true});
  fs.rmSync(path.dirname(result.project),{recursive:true,force:true});
}
fs.rmSync(sandbox,{recursive:true,force:true});

console.log('✓ Four-engine branding/signing helper contract');
