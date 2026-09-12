import {runRenderSyncedWebViewSmoke} from './task4-webview-render-sync-wrapper.mjs';

runRenderSyncedWebViewSmoke(
  new URL('./webview-engine-controls-smoke-core.mjs',import.meta.url)
);
