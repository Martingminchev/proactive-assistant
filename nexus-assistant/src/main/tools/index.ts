import type { IToolRegistry } from './types';
import { registerFileTools } from './file-tools';
import { registerBrowserTools } from './browser-tools';
import { registerTextTools } from './text-tools';
import { registerClipboardTools } from './clipboard-tools';
import { registerSystemTools } from './system-tools';
import { registerDevTools } from './dev-tools';
import { registerProductivityTools } from './productivity-tools';
import { registerCodingTools } from './coding-tools';

export function registerAllTools(registry: IToolRegistry): void {
  registerFileTools(registry);
  registerBrowserTools(registry);
  registerTextTools(registry);
  registerClipboardTools(registry);
  registerSystemTools(registry);
  registerDevTools(registry);
  registerProductivityTools(registry);
  registerCodingTools(registry);
}
