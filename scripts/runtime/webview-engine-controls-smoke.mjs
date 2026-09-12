import { runPatchedSmoke } from './task4-download-smoke-wrapper.mjs';

runPatchedSmoke(
  'webview',
  new URL('./webview-engine-controls-smoke-core.mjs',import.meta.url)
);
