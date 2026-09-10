import { json } from './_common.js';
import { gh, ghEnv } from './_github.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'GET required' });
  try {
    const { owner, repo } = ghEnv();
    const data = await gh(`/repos/${owner}/${repo}/actions/workflows/build-apk.yml/runs?event=workflow_dispatch&per_page=30`);
    const runs = (data.workflow_runs || []).map(r => ({ id: r.id, title: r.display_title, status: r.status, conclusion: r.conclusion, createdAt: r.created_at, htmlUrl: r.html_url }));
    return json(res, 200, { runs });
  } catch (e) { return json(res, 500, { error: e.message || 'History failed' }); }
}
