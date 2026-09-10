import { json } from './_common.js';
import { findRun, getJobs } from './_github.js';

function progressFromJobs(run, jobs) {
  const steps = (jobs || []).flatMap(j => j.steps || []);
  if (!steps.length) return run?.status === 'completed' ? 100 : 4;
  const done = steps.filter(s => s.status === 'completed').length;
  const active = steps.some(s => s.status === 'in_progress') ? 0.45 : 0;
  return Math.min(100, Math.round(((done + active) / steps.length) * 100));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'GET required' });
  try {
    const buildId = String(req.query?.buildId || '');
    if (!buildId) return json(res, 400, { error: 'buildId required' });
    const run = await findRun(buildId);
    if (!run) return json(res, 200, { found: false, status: 'queued', progress: 2 });
    const jobsData = await getJobs(run.id);
    const jobs = jobsData.jobs || [];
    const progress = progressFromJobs(run, jobs);
    const currentStep = jobs.flatMap(j => j.steps || []).find(s => s.status === 'in_progress')?.name ||
      [...jobs.flatMap(j => j.steps || [])].reverse().find(s => s.status === 'completed')?.name || run.status;
    return json(res, 200, {
      found: true,
      runId: run.id,
      status: run.status,
      conclusion: run.conclusion,
      progress,
      currentStep,
      htmlUrl: run.html_url,
      steps: jobs.flatMap(j => (j.steps || []).map(s => ({ name: s.name, status: s.status, conclusion: s.conclusion, number: s.number })))
    });
  } catch (e) {
    return json(res, 500, { error: e.message || 'Status failed' });
  }
}
