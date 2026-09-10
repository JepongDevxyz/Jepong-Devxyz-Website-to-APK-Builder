import { json } from './_common.js';
import { findRun, getJobs, ghEnv } from './_github.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'GET required' });
  try {
    const buildId = String(req.query?.buildId || '');
    const run = await findRun(buildId);
    if (!run) return json(res, 200, { text: 'Waiting for GitHub Actions run…' });
    const jobsData = await getJobs(run.id);
    const jobs = jobsData.jobs || [];
    const lines = [`Run #${run.run_number} · ${run.status}${run.conclusion ? `/${run.conclusion}` : ''}`];
    for (const job of jobs) {
      lines.push(`\n[${job.status}] ${job.name}`);
      for (const step of job.steps || []) lines.push(`  ${step.status === 'completed' ? '✓' : step.status === 'in_progress' ? '▶' : '○'} ${step.name}${step.conclusion && step.conclusion !== 'success' ? ` (${step.conclusion})` : ''}`);
    }
    // GitHub REST exposes full job logs via a temporary URL. Fetch them when available.
    const job = jobs.find(j => j.status === 'in_progress') || [...jobs].reverse().find(j => j.status === 'completed');
    if (job) {
      try {
        const { token, owner, repo } = ghEnv();
        const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/jobs/${job.id}/logs`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
          redirect: 'follow'
        });
        if (r.ok) {
          const raw = await r.text();
          if (raw) lines.push(`\n--- GitHub job log ---\n${raw.slice(-120000)}`);
        }
      } catch { /* step timeline is still useful */ }
    }
    return json(res, 200, { text: lines.join('\n'), runId: run.id });
  } catch (e) {
    return json(res, 500, { error: e.message || 'Logs failed' });
  }
}
