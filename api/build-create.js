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
    await putBuildConfig(buildId, stored);
    await dispatchBuild(buildId, config.engine);
    return json(res, 202, { ok: true, buildId });
  } catch (e) {
    return json(res, 500, { error: e.message || 'Build creation failed' });
  }
}
