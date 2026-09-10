export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export async function readJson(req, maxBytes = 6_500_000) {
  let total = 0;
  const parts = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw new Error('Payload too large');
    parts.push(chunk);
  }
  const text = Buffer.concat(parts).toString('utf8') || '{}';
  return JSON.parse(text);
}

export function safeId(v) {
  return String(v || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
}

export function validateConfig(config) {
  const errors = [];
  const engines = ['native', 'gecko', 'capacitor', 'cordova'];
  if (!engines.includes(config.engine)) errors.push('Invalid engine');
  try {
    const u = new URL(config.websiteUrl);
    if (!['https:', 'http:'].includes(u.protocol)) errors.push('Website URL must use http/https');
  } catch { errors.push('Invalid website URL'); }
  if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(config.packageName || '')) errors.push('Invalid Android package name');
  if (!String(config.appName || '').trim()) errors.push('App name required');
  const code = Number(config.versionCode);
  if (!Number.isInteger(code) || code < 1) errors.push('Version code must be a positive integer');
  if (!/^\d+(\.\d+){0,3}([+-][A-Za-z0-9.-]+)?$/.test(String(config.versionName || ''))) errors.push('Invalid version name');
  if (config.oneSignalAppId && !/^[0-9a-fA-F-]{36}$/.test(config.oneSignalAppId)) errors.push('OneSignal App ID must be a UUID');
  for (const key of ['iconDataUrl', 'splashDataUrl']) {
    const value = config[key];
    if (value && !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value)) errors.push(`${key} must be PNG data URL`);
  }
  return errors;
}
