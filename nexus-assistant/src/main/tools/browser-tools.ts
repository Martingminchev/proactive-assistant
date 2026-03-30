import { shell } from 'electron';
import type { IToolRegistry } from './types';

export function registerBrowserTools(registry: IToolRegistry): void {
  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'open_browser_tab',
        description: 'Open a URL in the default browser. Use when the user wants to open a link.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'The URL to open (e.g. https://example.com)' },
          },
          required: ['url'],
        },
      },
    },
    async (args) => {
      const url = args.url as string;
      if (!url || typeof url !== 'string') {
        return { success: false, error: 'url is required' };
      }
      try {
        await shell.openExternal(url);
        return { success: true, data: { opened: true, url } };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Failed to open URL',
        };
      }
    },
    { timeoutMs: 5000, requireConfirmation: true }
  );

  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'get_active_browser_info',
        description: 'Get the active/focused window title and URL if it is a browser. Use to see what page the user is on.',
        parameters: { type: 'object', properties: {} },
      },
    },
    async () => {
      try {
        const activeWin = await import('active-win');
        const win = await activeWin.default();
        if (!win) {
          return { success: true, data: { title: null, url: null } };
        }
        const url = (win as unknown as { url?: string }).url ?? null;
        return {
          success: true,
          data: {
            title: win.title ?? null,
            url,
            owner: win.owner?.name ?? null,
          },
        };
      } catch (e) {
        return {
          success: true,
          data: { title: null, url: null, error: e instanceof Error ? e.message : 'Could not get active window' },
        };
      }
    },
    { timeoutMs: 3000 }
  );
}
