import type { IToolRegistry } from './types';

export function registerTextTools(registry: IToolRegistry): void {
  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'base64_encode',
        description: 'Encode a string to base64. Use for encoding text or small data.',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to encode' },
          },
          required: ['text'],
        },
      },
    },
    async (args) => {
      const text = args.text;
      if (text == null) return { success: false, error: 'text is required' };
      const encoded = Buffer.from(String(text), 'utf-8').toString('base64');
      return { success: true, data: { encoded } };
    },
    { timeoutMs: 1000 }
  );

  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'base64_decode',
        description: 'Decode a base64 string to plain text.',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Base64 string to decode' },
          },
          required: ['text'],
        },
      },
    },
    async (args) => {
      const text = args.text;
      if (text == null) return { success: false, error: 'text is required' };
      try {
        const decoded = Buffer.from(String(text), 'base64').toString('utf-8');
        return { success: true, data: { decoded } };
      } catch {
        return { success: false, error: 'Invalid base64 input' };
      }
    },
    { timeoutMs: 1000 }
  );

  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'url_encode',
        description: 'URL-encode a string (percent-encoding).',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to encode' },
          },
          required: ['text'],
        },
      },
    },
    async (args) => {
      const text = args.text;
      if (text == null) return { success: false, error: 'text is required' };
      const encoded = encodeURIComponent(String(text));
      return { success: true, data: { encoded } };
    },
    { timeoutMs: 1000 }
  );

  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'url_decode',
        description: 'Decode a URL-encoded string.',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'URL-encoded text to decode' },
          },
          required: ['text'],
        },
      },
    },
    async (args) => {
      const text = args.text;
      if (text == null) return { success: false, error: 'text is required' };
      try {
        const decoded = decodeURIComponent(String(text));
        return { success: true, data: { decoded } };
      } catch {
        return { success: false, error: 'Invalid URL-encoded input' };
      }
    },
    { timeoutMs: 1000 }
  );
}
