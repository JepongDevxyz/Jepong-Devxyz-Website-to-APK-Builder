const API = 'https://api.github.com';

export function ghEnv() {
  const token = process.env.GH_BUILDER_TOKEN;
  const owner = process.env.GH_OWNER;
  const repo = process.env.GH_REPO;
  const branch = process.env.GH_BRANCH || 'main';
  if (!token || !owner || !repo) throw new Error('GitHub builder environment is not configured');
  return { token, owner, repo, branch };
}

export async function gh(path, opts = {}) {
  const { token } = ghEnv();
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Jepong-APK-Builder',
      ...(opts.headers || {})
    }
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`GitHub ${r.status}: ${text.slice(0, 800)}`);
  }
  if (r.status === 204) return null;
  const ct = r.headers.get('content-type') || '';
  return ct.includes('json') ? r.json() : r.arrayBuffer();
}

export async function putBuildConfig(buildId, config) {
  const { owner, repo, branch } = ghEnv();
  const path = `builds/${buildId}.json`;
  const content = Buffer.from(JSON.stringify(config, null, 2)).toString('base64');
  let sha;
  try {
    const old = await gh(`/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`);
    sha = old.sha;
  } catch (e) {
    if (!String(e.message).includes('GitHub 404')) throw e;
  }
  return gh(`/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `builder: ${buildId}`, content, branch, ...(sha ? { sha } : {}) })
  });
}

export async function dispatchBuild(buildId, engine, configCommitSha) {
  const { owner, repo, branch } = ghEnv();
  if (!configCommitSha) throw new Error('Build config commit SHA is required for workflow dispatch');
  return gh(`/repos/${owner}/${repo}/actions/workflows/build-apk.yml/dispatches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ref: branch,
      inputs: {
        build_id: buildId,
        engine,
        config_commit_sha: configCommitSha
      }
    })
  });
}

export async function findRun(buildId) {
  const { owner, repo } = ghEnv();
  const data = await gh(`/repos/${owner}/${repo}/actions/workflows/build-apk.yml/runs?event=workflow_dispatch&per_page=50`);
  return (data.workflow_runs || []).find(r => String(r.display_title || r.name || '').includes(buildId)) || null;
}

export async function getJobs(runId) {
  const { owner, repo } = ghEnv();
  return gh(`/repos/${owner}/${repo}/actions/runs/${runId}/jobs?per_page=100`);
}

export async function getArtifacts(runId) {
  const { owner, repo } = ghEnv();
  return gh(`/repos/${owner}/${repo}/actions/runs/${runId}/artifacts?per_page=20`);
}
