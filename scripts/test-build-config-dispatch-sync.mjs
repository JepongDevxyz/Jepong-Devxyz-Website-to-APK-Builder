import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import createBuild from '../api/build-create.js';

process.env.GH_BUILDER_TOKEN = 'test-token';
process.env.GH_OWNER = 'JepongDevxyz';
process.env.GH_REPO = 'Jepong-Devxyz-Website-to-APK-Builder';
process.env.GH_BRANCH = 'main';

const configCommitSha = 'abc123configcommit';
let dispatchPayload = null;
const calls = [];
const originalFetch = global.fetch;

global.fetch = async (url, opts = {}) => {
  const method = opts.method || 'GET';
  calls.push({ url: String(url), method });

  if (method === 'GET' && String(url).includes('/contents/builds/')) {
    return new Response(JSON.stringify({ message: 'Not Found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
  }

  if (method === 'PUT' && String(url).includes('/contents/builds/')) {
    return new Response(JSON.stringify({
      content: { sha: 'config-blob-sha' },
      commit: { sha: configCommitSha }
    }), {
      status: 201,
      headers: { 'content-type': 'application/json' }
    });
  }

  if (method === 'POST' && String(url).includes('/actions/workflows/build-apk.yml/dispatches')) {
    dispatchPayload = JSON.parse(opts.body);
    return new Response(null, { status: 204 });
  }

  throw new Error(`Unexpected GitHub request: ${method} ${url}`);
};

const req = Readable.from([Buffer.from(JSON.stringify({
  websiteUrl: 'https://example.com',
  appName: 'Race Test',
  packageName: 'com.jepongdevxyz.racetest',
  versionName: '1.0.0',
  versionCode: 1,
  engine: 'native'
}))]);
req.method = 'POST';

let responseBody = '';
const res = {
  statusCode: 0,
  headers: {},
  setHeader(name, value) { this.headers[name] = value; },
  end(value = '') { responseBody += value; }
};

try {
  await createBuild(req, res);
} finally {
  global.fetch = originalFetch;
}

assert.equal(res.statusCode, 202, responseBody);
assert.ok(dispatchPayload, 'build creation must dispatch a workflow');
assert.equal(
  dispatchPayload.inputs.config_commit_sha,
  configCommitSha,
  'workflow dispatch must pin the build to the exact commit that stored its config'
);

const putIndex = calls.findIndex(call => call.method === 'PUT' && call.url.includes('/contents/builds/'));
const dispatchIndex = calls.findIndex(call => call.method === 'POST' && call.url.includes('/actions/workflows/build-apk.yml/dispatches'));
assert.ok(putIndex >= 0 && dispatchIndex > putIndex, 'config commit must be created before dispatch');

const workflow = fs.readFileSync(new URL('../.github/workflows/build-apk.yml', import.meta.url), 'utf8');
assert.match(workflow, /config_commit_sha:/, 'build workflow must accept the config commit SHA');
assert.match(
  workflow,
  /ref:\s*\$\{\{\s*inputs\.config_commit_sha\s*\|\|\s*github\.sha\s*\}\}/,
  'checkout must prefer the immutable config commit SHA'
);

console.log('✓ build config dispatch is commit-pinned');
