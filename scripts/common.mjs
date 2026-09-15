import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(process.cwd());
export function mkdir(p) { fs.mkdirSync(p, { recursive: true }); }
export function write(p, s) { mkdir(path.dirname(p)); fs.writeFileSync(p, s); }
export function escXml(s='') { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&apos;'); }
export function javaString(s='') { return JSON.stringify(String(s)); }
export function loadConfig(buildId) {
  const p = path.join(ROOT, 'builds', `${buildId}.json`);
  if (!fs.existsSync(p)) throw new Error(`Missing ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
export function workDir(buildId) { return path.join(ROOT, 'work', buildId, 'project'); }
export function dataUrlToAsset(dataUrl) {
  if (!dataUrl) return null;
  const m = /^data:image\/(png|webp|jpeg);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  return { ext: m[1].toLowerCase()==='jpeg'?'jpg':m[1].toLowerCase(), buffer: Buffer.from(m[2], 'base64') };
}

function decodeBundledBranding(kind) {
  const encoded = path.join(ROOT, 'assets', `default-${kind}.base64.txt`);
  if (!fs.existsSync(encoded)) return null;

  const buffer = Buffer.from(
    fs.readFileSync(encoded, 'utf8').replace(/\s+/g, ''),
    'base64'
  );

  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext:'webp', buffer };
  }

  const pngSignature = Buffer.from([137,80,78,71,13,10,26,10]);
  if (buffer.subarray(0, 8).equals(pngSignature)) {
    return { ext:'png', buffer };
  }

  throw new Error(`Default ${kind} payload is not a supported WebP/PNG image`);
}

function defaultBrandingAsset(kind) {
  const encoded = decodeBundledBranding(kind);
  if (encoded) return encoded;

  const fallback = path.join(ROOT, 'assets', kind === 'icon' ? 'default-icon.png' : 'default-splash.png');
  if (!fs.existsSync(fallback)) throw new Error(`Missing default ${kind} asset: ${fallback}`);
  return { ext:'png', buffer:fs.readFileSync(fallback) };
}

export function brandedAsset(cfg, kind) {
  const uploaded = dataUrlToAsset(kind === 'icon' ? cfg.iconDataUrl : cfg.splashDataUrl);
  if (uploaded) return uploaded;
  return defaultBrandingAsset(kind);
}
export function selected(arr, name) { return Array.isArray(arr) && arr.includes(name); }
