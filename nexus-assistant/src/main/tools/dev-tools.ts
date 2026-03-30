import { create, all } from 'mathjs';
import * as crypto from 'crypto';
import type { IToolRegistry } from './types';

const math = create(all);

export function registerDevTools(registry: IToolRegistry): void {
  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'calculate',
        description: 'Evaluate a math expression (e.g. "2 + 3 * 4", "sqrt(16)"). Use for arithmetic or math.',
        parameters: {
          type: 'object',
          properties: {
            expression: { type: 'string', description: 'Math expression to evaluate' },
          },
          required: ['expression'],
        },
      },
    },
    async (args) => {
      const expr = args.expression as string;
      if (expr == null || typeof expr !== 'string') {
        return { success: false, error: 'expression is required' };
      }
      try {
        const result = math.evaluate(expr);
        const value = typeof result === 'number' && Number.isFinite(result)
          ? result
          : String(result);
        return { success: true, data: { result: value } };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Invalid expression',
        };
      }
    },
    { timeoutMs: 2000 }
  );

  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'generate_uuid',
        description: 'Generate a random UUID v4. Use when the user needs a unique identifier.',
        parameters: { type: 'object', properties: {} },
      },
    },
    async () => {
      const id = crypto.randomUUID();
      return { success: true, data: { uuid: id } };
    },
    { timeoutMs: 500 }
  );

  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'generate_password',
        description: 'Generate a cryptographically secure random password.',
        parameters: {
          type: 'object',
          properties: {
            length: { type: 'number', description: 'Length of password (default 16)', default: 16 },
            includeSymbols: { type: 'boolean', description: 'Include symbols (default true)', default: true },
          },
        },
      },
    },
    async (args) => {
      const length = Math.min(Math.max(Number(args.length) || 16, 8), 128);
      const includeSymbols = args.includeSymbols !== false;
      const chars =
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' +
        (includeSymbols ? '!@#$%^&*()-_=+[]{}|;:,.<>?' : '');
      const bytes = crypto.randomBytes(length);
      let password = '';
      for (let i = 0; i < length; i++) {
        password += chars[bytes[i]! % chars.length];
      }
      return { success: true, data: { password } };
    },
    { timeoutMs: 1000 }
  );

  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'fetch_url',
        description: 'Perform an HTTP GET or POST request to a URL. Use to fetch web content or call APIs.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to fetch' },
            method: { type: 'string', description: 'GET or POST', default: 'GET' },
            body: { type: 'string', description: 'Optional request body (e.g. JSON string)' },
          },
          required: ['url'],
        },
      },
    },
    async (args) => {
      const url = args.url as string;
      const method = ((args.method as string) || 'GET').toUpperCase();
      const body = args.body as string | undefined;
      if (!url) return { success: false, error: 'url is required' };
      try {
        const fetch = (await import('node-fetch')).default;
        const res = await fetch(url, {
          method: method === 'POST' ? 'POST' : 'GET',
          body: method === 'POST' && body != null ? body : undefined,
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
        });
        const text = await res.text();
        return {
          success: true,
          data: {
            status: res.status,
            statusText: res.statusText,
            body: text.length > 4000 ? text.slice(0, 4000) + '... [truncated]' : text,
          },
        };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Request failed',
        };
      }
    },
    { timeoutMs: 15000, requireConfirmation: true }
  );

  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'web_search',
        description: 'Search the web using DuckDuckGo instant answer API. Use to look up facts or current info.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
      },
    },
    async (args) => {
      const query = args.query as string;
      if (!query) return { success: false, error: 'query is required' };
      try {
        const fetch = (await import('node-fetch')).default;
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;
        const res = await fetch(url);
        const data = (await res.json()) as {
          Abstract?: string;
          AbstractText?: string;
          RelatedTopics?: Array<{ Text?: string }>;
          Answer?: string;
        };
        const abstract = data.Abstract ?? data.AbstractText ?? data.Answer ?? '';
        const related = (data.RelatedTopics ?? [])
          .slice(0, 5)
          .map((t: { Text?: string }) => t.Text)
          .filter(Boolean);
        return {
          success: true,
          data: {
            abstract: abstract || null,
            related: related.length ? related : null,
          },
        };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Search failed',
        };
      }
    },
    { timeoutMs: 10000, requireConfirmation: true }
  );
}
