import {
  patchCrossEngineBrowserUx as patchCoreBrowserUx,
  patchCrossEngineBrowserUxSource
} from './patch-cross-engine-browser-ux-core.mjs';
import { patchWebViewStartup } from './patch-webview-startup.mjs';

export { patchCrossEngineBrowserUxSource };

export function patchCrossEngineBrowserUx(cfg,projectDir){
  const activityPath=patchCoreBrowserUx(cfg,projectDir);
  patchWebViewStartup(cfg,projectDir);
  return activityPath;
}
