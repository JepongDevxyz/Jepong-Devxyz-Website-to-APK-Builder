import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  brandedAsset,
  loadConfig,
  workDir
} from './common.mjs';

const args = process.argv.slice(2);
const value = name => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : '';
};

const buildId = value('build-id');
const engine = value('engine');

assert.ok(buildId, '--build-id is required');
assert.ok(
  ['native', 'capacitor', 'cordova'].includes(engine),
  '--engine must be native, capacitor or cordova'
);

const cfg = loadConfig(buildId);
assert.equal(cfg.engine, engine, 'build config engine must match --engine');

const project = workDir(buildId);
const appRoot =
  engine === 'native'
    ? path.join(project, 'app')
    : engine === 'capacitor'
      ? path.join(project, 'android/app')
      : path.join(project, 'platforms/android/app');

const javaRoot = path.join(
  appRoot,
  'src/main/java',
  ...cfg.packageName.split('.')
);

const paths = {
  icon: path.join(appRoot, 'src/main/res/drawable-nodpi/app_icon.png'),
  splash: path.join(appRoot, 'src/main/res/drawable-nodpi/app_splash.png'),
  manifest: path.join(appRoot, 'src/main/AndroidManifest.xml'),
  splashActivity: path.join(javaRoot, 'JepongSplashActivity.java')
};

for (const [label, file] of Object.entries(paths)) {
  assert.ok(fs.existsSync(file), `${engine}: missing ${label}: ${file}`);
  assert.ok(fs.statSync(file).size > 0, `${engine}: empty ${label}: ${file}`);
  console.log(`✓ ${engine} ${label} exists`);
}

const expectedIcon = brandedAsset(cfg, 'icon').buffer;
const expectedSplash = brandedAsset(cfg, 'splash').buffer;
const actualIcon = fs.readFileSync(paths.icon);
const actualSplash = fs.readFileSync(paths.splash);

assert.ok(
  actualIcon.equals(expectedIcon),
  `${engine}: final app_icon.png does not match normalized selected/default icon`
);
console.log(`✓ ${engine} final icon matches normalized branding asset`);

assert.ok(
  actualSplash.equals(expectedSplash),
  `${engine}: final app_splash.png does not match normalized selected/default splash`
);
console.log(`✓ ${engine} final splash matches normalized branding asset`);

const manifest = fs.readFileSync(paths.manifest, 'utf8');
const java = fs.readFileSync(paths.splashActivity, 'utf8');

assert.match(
  manifest,
  /android:name="\.JepongSplashActivity"/,
  `${engine}: splash launcher activity missing from manifest`
);
assert.match(
  manifest,
  /android\.intent\.action\.MAIN/,
  `${engine}: MAIN intent missing from manifest`
);
assert.match(
  manifest,
  /android\.intent\.category\.LAUNCHER/,
  `${engine}: LAUNCHER category missing from manifest`
);
assert.match(
  java,
  /R\.drawable\.app_splash/,
  `${engine}: splash activity does not reference app_splash`
);
assert.match(
  java,
  /ImageView\.ScaleType\.CENTER_CROP/,
  `${engine}: splash activity does not use CENTER_CROP`
);

console.log(`✅ ${engine} final Android branding + deterministic splash launcher verified`);
