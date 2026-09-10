import { inflateRawSync } from 'node:zlib';
import { getArtifacts, ghEnv } from './_github.js';

function extractApk(zipBuffer) {
  const b = Buffer.from(zipBuffer);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Invalid artifact zip');
  const entries = b.readUInt16LE(eocd + 10);
  let p = b.readUInt32LE(eocd + 16);
  for (let n = 0; n < entries; n++) {
    if (b.readUInt32LE(p) !== 0x02014b50) throw new Error('Invalid central directory');
    const method = b.readUInt16LE(p + 10);
    const compressedSize = b.readUInt32LE(p + 20);
    const fileNameLen = b.readUInt16LE(p + 28);
    const extraLen = b.readUInt16LE(p + 30);
    const commentLen = b.readUInt16LE(p + 32);
    const localOffset = b.readUInt32LE(p + 42);
    const name = b.subarray(p + 46, p + 46 + fileNameLen).toString('utf8');
    if (name.toLowerCase().endsWith('.apk')) {
      if (b.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('Invalid local zip entry');
      const localNameLen = b.readUInt16LE(localOffset + 26);
      const localExtraLen = b.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLen + localExtraLen;
      const compressed = b.subarray(start, start + compressedSize);
      const apk = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null;
      if (!apk) throw new Error(`Unsupported zip compression method ${method}`);
      return { name: name.split('/').pop(), data: apk };
    }
    p += 46 + fileNameLen + extraLen + commentLen;
  }
  throw new Error('APK not found in artifact');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.statusCode = 405; return res.end('GET required'); }
  try {
    const runId = Number(req.query?.runId);
    if (!Number.isInteger(runId)) throw new Error('runId required');
    const artifactsData = await getArtifacts(runId);
    const artifact = (artifactsData.artifacts || []).find(a => !a.expired && /apk/i.test(a.name));
    if (!artifact) throw new Error('APK artifact not found');
    const { token, owner, repo } = ghEnv();
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifact.id}/zip`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      redirect: 'follow'
    });
    if (!r.ok) throw new Error(`Artifact download failed: ${r.status}`);
    const zip = Buffer.from(await r.arrayBuffer());
    const apk = extractApk(zip);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${apk.name.replace(/[^A-Za-z0-9._-]/g, '_')}"`);
    res.setHeader('Content-Length', String(apk.data.length));
    return res.end(apk.data);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end(e.message || 'Download failed');
  }
}
