import { clipboard } from 'electron';
import type { IToolRegistry } from './types';

export function registerClipboardTools(registry: IToolRegistry): void {
  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'copy_to_clipboard',
        description: 'Write text to the system clipboard. Use when the user wants to copy something.',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'The text to copy to the clipboard' },
          },
          required: ['text'],
        },
      },
    },
    async (args) => {
      const text = args.text;
      if (text == null || typeof text !== 'string') {
        return { success: false, error: 'text is required' };
      }
      clipboard.writeText(text);
      return { success: true, data: { copied: true } };
    },
    { timeoutMs: 2000, requireConfirmation: true }
  );

  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'format_clipboard_json',
        description: 'Read clipboard as JSON, format it (pretty-print), and write it back. Use when the user has minified JSON in clipboard and wants it formatted.',
        parameters: { type: 'object', properties: {} },
      },
    },
    async () => {
      const raw = clipboard.readText();
      if (!raw.trim()) {
        return { success: false, error: 'Clipboard is empty or not text' };
      }
      try {
        const parsed = JSON.parse(raw);
        const formatted = JSON.stringify(parsed, null, 2);
        clipboard.writeText(formatted);
        return { success: true, data: { formatted: true } };
      } catch {
        return { success: false, error: 'Clipboard content is not valid JSON' };
      }
    },
    { timeoutMs: 2000, requireConfirmation: true }
  );
}
