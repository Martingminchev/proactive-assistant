import { promises as fs } from 'fs';
import * as path from 'path';
import type { IToolRegistry } from './types';

// =============================================================================
// Path Validation & Security
// =============================================================================

const BLOCKED_PATHS = [
  /\\System Volume Information/i,
  /\\Windows\\System32/i,
  /\\etc\\passwd/i,
  /\\\.ssh\\/i,
  /\\\.gnupg\\/i,
  /\\AppData\\Local\\Microsoft\\Windows/i,
];

function isPathBlocked(absolutePath: string): boolean {
  return BLOCKED_PATHS.some(pattern => pattern.test(absolutePath));
}

function resolveAndValidatePath(filePath: string): { 
  absolute: string; 
  error?: string;
  warning?: string;
} {
  // Check for path traversal attempts
  const normalized = path.normalize(filePath);
  const absolute = path.resolve(normalized);
  
  // Check for traversal
  if (normalized.includes('..')) {
    return { 
      absolute: '', 
      error: 'Path traversal detected. Relative paths must stay within working directory.' 
    };
  }

  // Check for blocked paths
  if (isPathBlocked(absolute)) {
    return { 
      absolute: '', 
      error: 'Access to system directories is blocked for security.' 
    };
  }

  return { absolute };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

// =============================================================================
// Tool Registration
// =============================================================================

export function registerFileTools(registry: IToolRegistry): void {
  
  // read_file
  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read file contents. Returns text for text files or base64 for binary. Use to inspect file content.',
        parameters: {
          type: 'object',
          properties: {
            path: { 
              type: 'string', 
              description: 'Absolute or relative path to the file' 
            },
            encoding: { 
              type: 'string', 
              description: 'Optional: "utf8" (default) or "base64"', 
              default: 'utf8',
              enum: ['utf8', 'base64'],
            },
          },
          required: ['path'],
        },
      },
    },
    async (args) => {
      const filePath = args.path as string;
      const { absolute, error } = resolveAndValidatePath(filePath);
      if (error) return { success: false, error };

      const encoding = (args.encoding as string) || 'utf8';
      
      try {
        // Check file size before reading (prevent massive files)
        const stats = await fs.stat(absolute);
        const maxSize = encoding === 'base64' ? 5 * 1024 * 1024 : 1024 * 1024; // 5MB binary, 1MB text
        
        if (stats.size > maxSize) {
          return {
            success: false,
            error: `File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB, max ${(maxSize / 1024 / 1024).toFixed(0)}MB)`,
            suggestion: 'Use search_files or read specific portions',
          };
        }

        const content = await fs.readFile(absolute, encoding as BufferEncoding);
        
        return { 
          success: true, 
          data: { 
            content: String(content), 
            path: absolute,
            size: stats.size,
            modified: stats.mtime.toISOString(),
          } 
        };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Failed to read file',
        };
      }
    },
    { timeoutMs: 10000, requireConfirmation: false }
  );

  // write_file
  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'write_file',
        description: 'Create or overwrite a file with the given content. Use when the user wants to save or create a file.',
        parameters: {
          type: 'object',
          properties: {
            path: { 
              type: 'string', 
              description: 'Absolute or relative path to the file' 
            },
            content: { 
              type: 'string', 
              description: 'Content to write' 
            },
            encoding: {
              type: 'string',
              description: 'File encoding (default: utf8)',
              default: 'utf8',
              enum: ['utf8', 'base64'],
            },
          },
          required: ['path', 'content'],
        },
      },
    },
    async (args) => {
      const filePath = args.path as string;
      const content = args.content;
      
      const { absolute, error } = resolveAndValidatePath(filePath);
      if (error) return { success: false, error };

      try {
        const dir = path.dirname(absolute);
        await fs.mkdir(dir, { recursive: true });
        
        const encoding = (args.encoding as string) || 'utf8';
        await fs.writeFile(absolute, String(content), encoding as BufferEncoding);
        
        return { 
          success: true, 
          data: { 
            path: absolute,
            bytesWritten: String(content).length,
          } 
        };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Failed to write file',
        };
      }
    },
    { timeoutMs: 10000, requireConfirmation: true }
  );

  // edit_file
  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'edit_file',
        description: 'Replace the first occurrence of search string with replace in a file. Use for precise in-file edits.',
        parameters: {
          type: 'object',
          properties: {
            path: { 
              type: 'string', 
              description: 'Path to the file' 
            },
            search: { 
              type: 'string', 
              description: 'Exact string to find' 
            },
            replace: { 
              type: 'string', 
              description: 'Replacement string' 
            },
          },
          required: ['path', 'search', 'replace'],
        },
      },
    },
    async (args) => {
      const filePath = args.path as string;
      const search = args.search as string;
      const replace = args.replace as string;
      
      const { absolute, error } = resolveAndValidatePath(filePath);
      if (error) return { success: false, error };

      try {
        const content = await fs.readFile(absolute, 'utf8');
        
        if (!content.includes(search)) {
          return {
            success: false,
            error: 'Search string not found in file',
            suggestion: 'Check for exact match including whitespace and line endings',
          };
        }

        const newContent = content.replace(search, replace);
        await fs.writeFile(absolute, newContent, 'utf8');
        
        return { 
          success: true, 
          data: { 
            path: absolute,
            replacements: 1,
            originalLength: content.length,
            newLength: newContent.length,
          } 
        };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Failed to edit file',
        };
      }
    },
    { timeoutMs: 10000, requireConfirmation: true }
  );
}
