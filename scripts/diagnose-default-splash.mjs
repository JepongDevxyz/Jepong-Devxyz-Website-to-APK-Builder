import fs from 'node:fs';
import crypto from 'node:crypto';

const hex=(buf)=>Buffer.from(buf).toString('hex');

for(const file of ['assets/default-icon.png','assets/default-splash.png']){
  const b=fs.readFileSync(file);
  const sha=crypto.createHash('sha256').update(b).digest('hex');
  console.log(`\n=== ${file} ===`);
  console.log(`bytes=${b.length}`);
  console.log(`sha256=${sha}`);
  console.log(`signature=${hex(b.subarray(0,8))}`);
  if(b.length>=29){
    console.log(`ihdr width=${b.readUInt32BE(16)} height=${b.readUInt32BE(20)} bitDepth=${b[24]} colorType=${b[25]} compression=${b[26]} filter=${b[27]} interlace=${b[28]}`);
  }
  for(const marker of ['IHDR','PLTE','tRNS','IDAT','IEND']){
    const positions=[];
    let start=0;
    while(true){
      const p=b.indexOf(marker,start,'ascii');
      if(p<0) break;
      positions.push(p);
      start=p+1;
      if(positions.length>=20) break;
    }
    console.log(`${marker}_positions=${positions.join(',')||'none'}`);
  }
  let offset=8;
  for(let i=0;i<50 && offset+12<=b.length;i++){
    const length=b.readUInt32BE(offset);
    const typeBuf=b.subarray(offset+4,offset+8);
    const type=typeBuf.toString('latin1');
    const printable=[...typeBuf].every(x=>x>=65&&x<=122);
    const dataStart=offset+8;
    const dataEnd=dataStart+length;
    const chunkEnd=dataEnd+4;
    console.log(`chunk[${i}] offset=${offset} length=${length} type=${JSON.stringify(type)} printable=${printable} dataStart=${dataStart} dataEnd=${dataEnd} chunkEnd=${chunkEnd} remaining=${b.length-offset}`);
    if(chunkEnd>b.length){
      const from=Math.max(0,offset-24), to=Math.min(b.length,offset+64);
      console.log(`TRUNCATED around=${from}:${to} hex=${hex(b.subarray(from,to))}`);
      break;
    }
    if(type==='IEND') break;
    offset=chunkEnd;
  }
  console.log(`tail64=${hex(b.subarray(Math.max(0,b.length-64)))}`);
}
