import { runPatchedSmoke } from './task4-download-smoke-wrapper.mjs';

runPatchedSmoke(
  'gecko',
  new URL('./gecko-controls-smoke-core.mjs',import.meta.url)
);
