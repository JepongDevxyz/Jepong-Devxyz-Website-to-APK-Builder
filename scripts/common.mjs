import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export const ROOT = path.resolve(process.cwd());
export function mkdir(p) { fs.mkdirSync(p, { recursive: true }); }
export function write(p, s) { mkdir(path.dirname(p)); fs.writeFileSync(p, s); }
export function escXml(s='') { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&apos;'); }
export function javaString(s='') { return JSON.stringify(String(s)); }
export function loadConfig(buildId) { const p=path.join(ROOT,'builds',`${buildId}.json`); if(!fs.existsSync(p)) throw new Error(`Missing ${p}`); return JSON.parse(fs.readFileSync(p,'utf8')); }
export function workDir(buildId) { return path.join(ROOT,'work',buildId,'project'); }
export function dataUrlToAsset(dataUrl) { if(!dataUrl)return null; const m=/^data:image\/(png|webp|jpeg);base64,(.+)$/i.exec(dataUrl); if(!m)return null; return {ext:m[1].toLowerCase()==='jpeg'?'jpg':m[1].toLowerCase(),buffer:Buffer.from(m[2],'base64')}; }

const PNG_SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]); let crcTable;
function getCrcTable(){if(crcTable)return crcTable;crcTable=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);crcTable[n]=c>>>0;}return crcTable;}
function crc32(buffer){const table=getCrcTable();let c=0xffffffff;for(const byte of buffer)c=table[(c^byte)&0xff]^(c>>>8);return(c^0xffffffff)>>>0;}
function pngChunk(type,data=Buffer.alloc(0)){const t=Buffer.from(type,'ascii'),l=Buffer.alloc(4),crc=Buffer.alloc(4);l.writeUInt32BE(data.length,0);crc.writeUInt32BE(crc32(Buffer.concat([t,data])),0);return Buffer.concat([l,t,data,crc]);}
function paethPredictor(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);if(pa<=pb&&pa<=pc)return a;if(pb<=pc)return b;return c;}
function unfilterIndexedRows(raw,width,height,bitDepth){const rowBytes=Math.ceil(width*bitDepth/8),expected=height*(rowBytes+1);if(raw.length!==expected)throw new Error(`Indexed PNG payload length mismatch: expected ${expected}, got ${raw.length}`);const rows=[];let offset=0,previous=Buffer.alloc(rowBytes);for(let y=0;y<height;y++){const filter=raw[offset++],filtered=raw.subarray(offset,offset+rowBytes);offset+=rowBytes;const row=Buffer.alloc(rowBytes);for(let x=0;x<rowBytes;x++){const left=x>0?row[x-1]:0,up=previous[x]||0,upLeft=x>0?previous[x-1]:0;let value;switch(filter){case 0:value=filtered[x];break;case 1:value=filtered[x]+left;break;case 2:value=filtered[x]+up;break;case 3:value=filtered[x]+Math.floor((left+up)/2);break;case 4:value=filtered[x]+paethPredictor(left,up,upLeft);break;default:throw new Error(`Unsupported PNG filter type ${filter}`);}row[x]=value&0xff;}rows.push(row);previous=row;}return rows;}
function indexedPixel(row,x,bitDepth){if(bitDepth===8)return row[x];const ppb=8/bitDepth,byte=row[Math.floor(x/ppb)],shift=8-bitDepth-((x%ppb)*bitDepth);return(byte>>>shift)&((1<<bitDepth)-1);}
export function normalizePngForAndroid(buffer){if(!Buffer.isBuffer(buffer)||buffer.length<33||!buffer.subarray(0,8).equals(PNG_SIGNATURE))return buffer;if(buffer.toString('ascii',12,16)!=='IHDR')return buffer;const width=buffer.readUInt32BE(16),height=buffer.readUInt32BE(20),bitDepth=buffer[24],colorType=buffer[25],compression=buffer[26],filterMethod=buffer[27],interlace=buffer[28];if(colorType!==3)return buffer;if(![1,2,4,8].includes(bitDepth)||compression!==0||filterMethod!==0||interlace!==0)throw new Error(`Unsupported indexed branding PNG (bitDepth=${bitDepth}, interlace=${interlace})`);let palette=null,transparency=null;const idat=[];let offset=8;while(offset+12<=buffer.length){const length=buffer.readUInt32BE(offset),type=buffer.toString('ascii',offset+4,offset+8),dataStart=offset+8,dataEnd=dataStart+length;if(dataEnd+4>buffer.length)throw new Error(`Malformed branding PNG chunk ${type}`);const data=buffer.subarray(dataStart,dataEnd);if(type==='PLTE')palette=data;else if(type==='tRNS')transparency=data;else if(type==='IDAT')idat.push(data);else if(type==='IEND')break;offset=dataEnd+4;}if(!palette||palette.length<3||palette.length%3!==0)throw new Error('Indexed branding PNG is missing a valid PLTE palette');if(!idat.length)throw new Error('Indexed branding PNG is missing IDAT data');const raw=zlib.inflateSync(Buffer.concat(idat)),rows=unfilterIndexedRows(raw,width,height,bitDepth),rgba=Buffer.alloc(height*(1+width*4));let out=0;for(const row of rows){rgba[out++]=0;for(let x=0;x<width;x++){const index=indexedPixel(row,x,bitDepth),po=index*3;if(po+2>=palette.length)throw new Error(`Indexed branding PNG palette index ${index} is out of range`);rgba[out++]=palette[po];rgba[out++]=palette[po+1];rgba[out++]=palette[po+2];rgba[out++]=transparency&&index<transparency.length?transparency[index]:255;}}const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;return Buffer.concat([PNG_SIGNATURE,pngChunk('IHDR',ihdr),pngChunk('IDAT',zlib.deflateSync(rgba,{level:9})),pngChunk('IEND')]);}

export function brandedAsset(cfg,kind){
  const uploaded=dataUrlToAsset(kind==='icon'?cfg.iconDataUrl:cfg.splashDataUrl);
  if(uploaded){if(uploaded.ext==='png')return {...uploaded,buffer:normalizePngForAndroid(uploaded.buffer)};return uploaded;}
  // The approved Jepong Devxyz defaults are stored as Android-safe JPEGs.
  // Keep the PNG copies only for legacy/browser compatibility; generated APKs must not depend on them.
  const jpg=path.join(ROOT,'assets',kind==='icon'?'default-icon.jpg':'default-splash.jpg');
  if(fs.existsSync(jpg))return {ext:'jpg',buffer:fs.readFileSync(jpg)};
  const png=path.join(ROOT,'assets',kind==='icon'?'default-icon.png':'default-splash.png');
  if(!fs.existsSync(png))throw new Error(`Missing default ${kind} asset`);
  return {ext:'png',buffer:normalizePngForAndroid(fs.readFileSync(png))};
}
export function selected(arr,name){return Array.isArray(arr)&&arr.includes(name);}
