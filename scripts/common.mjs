import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

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

const PNG_SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
const MAX_PNG_DECOMPRESSED_BYTES=8*1024*1024;

export function assertDecodablePng(buffer,label='PNG') {
  if(!Buffer.isBuffer(buffer) || buffer.length<33 || !buffer.subarray(0,8).equals(PNG_SIGNATURE)){
    throw new Error(`${label} is not a PNG`);
  }

  let offset=8;
  let sawHeader=false;
  let sawEnd=false;
  const imageData=[];

  while(offset<buffer.length){
    if(offset+12>buffer.length) throw new Error(`${label} has a truncated PNG chunk`);
    const length=buffer.readUInt32BE(offset);
    const type=buffer.toString('ascii',offset+4,offset+8);
    const dataStart=offset+8;
    const dataEnd=dataStart+length;
    if(dataEnd+4>buffer.length) throw new Error(`${label} has a truncated PNG chunk`);

    if(!sawHeader){
      if(type!=='IHDR' || length!==13) throw new Error(`${label} is missing a valid PNG header`);
      if(buffer.readUInt32BE(dataStart)===0 || buffer.readUInt32BE(dataStart+4)===0){
        throw new Error(`${label} has invalid PNG dimensions`);
      }
      sawHeader=true;
    }else if(type==='IDAT'){
      imageData.push(buffer.subarray(dataStart,dataEnd));
    }else if(type==='IEND'){
      if(length!==0 || dataEnd+4!==buffer.length) throw new Error(`${label} has an invalid PNG end chunk`);
      sawEnd=true;
      break;
    }

    offset=dataEnd+4;
  }

  if(!sawHeader || !sawEnd || !imageData.length) throw new Error(`${label} is missing PNG image data`);
  try {
    zlib.inflateSync(Buffer.concat(imageData),{maxOutputLength:MAX_PNG_DECOMPRESSED_BYTES});
  }catch{
    throw new Error(`${label} contains undecodable PNG image data`);
  }
}

export function dataUrlToAsset(dataUrl) {
  if (!dataUrl) return null;
  const m = /^data:image\/(png|webp|jpeg);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const ext=m[1].toLowerCase()==='jpeg'?'jpg':m[1].toLowerCase();
  const buffer=Buffer.from(m[2], 'base64');
  if(ext==='png') assertDecodablePng(buffer,'Uploaded PNG');
  return { ext, buffer };
}
function defaultBrandingAsset(kind) {
  if (kind === 'icon') {
    const icon = path.join(ROOT, 'assets', 'default-icon.png');
    if (!fs.existsSync(icon)) throw new Error(`Missing default icon asset: ${icon}`);
    return { ext:'png', buffer:fs.readFileSync(icon) };
  }

  const encoded = path.join(ROOT, 'assets', 'default-splash.base64.txt');
  if (!fs.existsSync(encoded)) throw new Error(`Missing default splash payload: ${encoded}`);
  const buffer = Buffer.from(fs.readFileSync(encoded, 'utf8').trim(), 'base64');
  const signature = buffer.subarray(0, 8);
  const expected = Buffer.from([137,80,78,71,13,10,26,10]);
  if (!signature.equals(expected)) throw new Error('Default splash payload did not decode to a PNG');
  return { ext:'png', buffer };
}
export function brandedAsset(cfg, kind) {
  const uploaded = dataUrlToAsset(kind === 'icon' ? cfg.iconDataUrl : cfg.splashDataUrl);
  if (uploaded) return uploaded;
  return defaultBrandingAsset(kind);
}
export function selected(arr, name) { return Array.isArray(arr) && arr.includes(name); }
