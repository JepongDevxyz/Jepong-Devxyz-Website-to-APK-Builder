import zlib from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([137,80,78,71,13,10,26,10]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuffer, data]);
  const out = Buffer.allocUnsafe(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  typeBuffer.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}

function parsePng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return null;
  }

  let offset = 8;
  let ihdr = null;
  let palette = null;
  let transparency = null;
  const idat = [];

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    if (chunkEnd > buffer.length) throw new Error(`Invalid PNG: truncated ${type} chunk`);
    const data = buffer.subarray(dataStart, dataEnd);

    if (type === 'IHDR') ihdr = Buffer.from(data);
    else if (type === 'PLTE') palette = Buffer.from(data);
    else if (type === 'tRNS') transparency = Buffer.from(data);
    else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;

    offset = chunkEnd;
  }

  if (!ihdr || ihdr.length !== 13 || idat.length === 0) {
    throw new Error('Invalid PNG: missing IHDR or IDAT');
  }
  return { ihdr, palette, transparency, idat };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function unfilterIndexed(raw, width, height, bitDepth) {
  const rowBytes = Math.ceil((width * bitDepth) / 8);
  const expected = height * (rowBytes + 1);
  if (raw.length !== expected) {
    throw new Error(`Unsupported indexed PNG payload: expected ${expected} bytes, got ${raw.length}`);
  }

  const rows = Buffer.allocUnsafe(height * rowBytes);
  let input = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[input++];
    const rowOffset = y * rowBytes;
    const prevOffset = (y - 1) * rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const source = raw[input++];
      const left = x > 0 ? rows[rowOffset + x - 1] : 0;
      const up = y > 0 ? rows[prevOffset + x] : 0;
      const upLeft = y > 0 && x > 0 ? rows[prevOffset + x - 1] : 0;
      let value;
      if (filter === 0) value = source;
      else if (filter === 1) value = source + left;
      else if (filter === 2) value = source + up;
      else if (filter === 3) value = source + Math.floor((left + up) / 2);
      else if (filter === 4) value = source + paeth(left, up, upLeft);
      else throw new Error(`Unsupported PNG filter ${filter}`);
      rows[rowOffset + x] = value & 0xff;
    }
  }
  return { rows, rowBytes };
}

function paletteIndex(rows, rowBytes, x, y, bitDepth) {
  const rowOffset = y * rowBytes;
  if (bitDepth === 8) return rows[rowOffset + x];
  const perByte = 8 / bitDepth;
  const byte = rows[rowOffset + Math.floor(x / perByte)];
  const shift = 8 - bitDepth * ((x % perByte) + 1);
  return (byte >>> shift) & ((1 << bitDepth) - 1);
}

export function androidSafePng(buffer) {
  const png = parsePng(buffer);
  if (!png) return buffer;

  const width = png.ihdr.readUInt32BE(0);
  const height = png.ihdr.readUInt32BE(4);
  const bitDepth = png.ihdr[8];
  const colorType = png.ihdr[9];
  const compression = png.ihdr[10];
  const filterMethod = png.ihdr[11];
  const interlace = png.ihdr[12];

  if (colorType === 2 || colorType === 6) return buffer;
  if (colorType !== 3) return buffer;
  if (![1, 2, 4, 8].includes(bitDepth)) {
    throw new Error(`Unsupported indexed PNG bit depth ${bitDepth}`);
  }
  if (compression !== 0 || filterMethod !== 0 || interlace !== 0) {
    throw new Error('Indexed branding PNG must use standard compression/filter and be non-interlaced');
  }
  if (!png.palette || png.palette.length === 0 || png.palette.length % 3 !== 0) {
    throw new Error('Indexed branding PNG is missing a valid palette');
  }

  const raw = zlib.inflateSync(Buffer.concat(png.idat));
  const { rows, rowBytes } = unfilterIndexed(raw, width, height, bitDepth);
  const rgba = Buffer.allocUnsafe(height * (1 + width * 4));
  const paletteEntries = png.palette.length / 3;
  let out = 0;

  for (let y = 0; y < height; y += 1) {
    rgba[out++] = 0;
    for (let x = 0; x < width; x += 1) {
      const index = paletteIndex(rows, rowBytes, x, y, bitDepth);
      if (index >= paletteEntries) {
        throw new Error(`Indexed PNG references missing palette entry ${index}`);
      }
      const p = index * 3;
      rgba[out++] = png.palette[p];
      rgba[out++] = png.palette[p + 1];
      rgba[out++] = png.palette[p + 2];
      rgba[out++] = png.transparency && index < png.transparency.length ? png.transparency[index] : 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(rgba, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

export function androidSafeBrandingAsset(asset) {
  if (!asset || asset.ext !== 'png') return asset;
  return { ...asset, buffer: androidSafePng(asset.buffer) };
}
