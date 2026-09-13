import crypto from 'node:crypto';
import { json, readJson, validateConfig } from './_common.js';
import { putBuildConfig, dispatchBuild } from './_github.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required' });
  try {
    const config = await readJson(req);
    const errors = validateConfig(config);
    if (errors.length) return json(res, 400, { error: 'Validation failed', errors });
    const buildId = `jpx-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const stored = { ...config, buildId, createdAt: new Date().toISOString(), schemaVersion: 1 };
    const saved = await putBuildConfig(buildId, stored);
    const configCommitSha = saved?.commit?.sha;
    if (!configCommitSha) throw new Error('GitHub did not return the build config commit SHA');
    await dispatchBuild(buildId, config.engine, configCommitSha);
    return json(res, 202, { ok: true, buildId });
  } catch (e) {
    return json(res, 500, { error: e.message || 'Build creation failed' });
  }
}
