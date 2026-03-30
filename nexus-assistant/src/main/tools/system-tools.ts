import { exec } from 'child_process';
import { promisify } from 'util';
import * as net from 'net';
import type { IToolRegistry } from './types';

const execAsync = promisify(exec);

function runPowerShell(script: string): Promise<{ stdout: string; stderr: string }> {
  return execAsync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`, {
    timeout: 10000,
    maxBuffer: 1024 * 1024,
  });
}

export function registerSystemTools(registry: IToolRegistry): void {
  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'find_window',
        description: 'Find windows whose title contains the given query. Use to locate a window by name.',
        parameters: {
          type: 'object',
          properties: {
            title_query: { type: 'string', description: 'Substring to match in window title' },
          },
          required: ['title_query'],
        },
      },
    },
    async (args) => {
      const query = args.title_query as string;
      if (!query) return { success: false, error: 'title_query is required' };
      try {
        const escaped = query.replace(/'/g, "''");
        const script = `Get-Process | Where-Object { $_.MainWindowTitle -like '*${escaped}*' } | Select-Object Id, ProcessName, MainWindowTitle | ConvertTo-Json -Compress`;
        const { stdout } = await runPowerShell(script);
        let windows: Array<{ Id: number; ProcessName: string; MainWindowTitle: string }> = [];
        try {
          const parsed = JSON.parse(stdout || '[]');
          windows = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
        } catch {
          // ignore parse error
        }
        return {
          success: true,
          data: {
            windows: windows.map((w: { Id: number; ProcessName: string; MainWindowTitle: string }) => ({
              id: w.Id,
              processName: w.ProcessName,
              title: w.MainWindowTitle,
            })),
          },
        };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Failed to list windows',
        };
      }
    },
    { timeoutMs: 10000 }
  );

  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'list_all_windows',
        description: 'List all visible windows (process id, name, title). Use to see what windows are open.',
        parameters: { type: 'object', properties: {} },
      },
    },
    async () => {
      try {
        const script =
          "Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object Id, ProcessName, MainWindowTitle | ConvertTo-Json -Compress";
        const { stdout } = await runPowerShell(script);
        let windows: Array<{ Id: number; ProcessName: string; MainWindowTitle: string }> = [];
        try {
          const parsed = JSON.parse(stdout || '[]');
          windows = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
        } catch {
          // ignore
        }
        return {
          success: true,
          data: {
            windows: windows.map((w: { Id: number; ProcessName: string; MainWindowTitle: string }) => ({
              id: w.Id,
              processName: w.ProcessName,
              title: w.MainWindowTitle,
            })),
          },
        };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Failed to list windows',
        };
      }
    },
    { timeoutMs: 10000 }
  );

  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'focus_window',
        description: 'Bring a window to the foreground by matching its title. Use when the user wants to switch to a specific window.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Window title (substring match) or process name' },
          },
          required: ['title'],
        },
      },
    },
    async (args) => {
      const title = args.title as string;
      if (!title) return { success: false, error: 'title is required' };
      try {
        const escaped = title.replace(/'/g, "''");
        const script = `Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class Win {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  }
"@
$p = Get-Process | Where-Object { $_.MainWindowTitle -like '*${escaped}*' } | Select-Object -First 1
if ($p) { [Win]::ShowWindow($p.MainWindowHandle, 9); [Win]::SetForegroundWindow($p.MainWindowHandle); exit 0 } else { exit 1 }`;
        await runPowerShell(script);
        return { success: true, data: { focused: true } };
      } catch {
        return { success: false, error: 'Window not found or could not focus' };
      }
    },
    { timeoutMs: 5000, requireConfirmation: true }
  );

  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'get_processes',
        description: 'List running processes, optionally filtered by name. Use to see what is running.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Optional filter: process name substring' },
            maxResults: { type: 'number', description: 'Max processes to return (default 50)', default: 50 },
          },
        },
      },
    },
    async (args) => {
      const query = (args.query as string) || '';
      const maxResults = Math.min(Math.max(Number(args.maxResults) || 50, 1), 200);
      try {
        const escapedQuery = String(query).replace(/'/g, "''");
        const script = query
          ? `Get-Process | Where-Object { $_.ProcessName -like '*${escapedQuery}*' } | Select-Object Id, ProcessName -First ${maxResults} | ConvertTo-Json -Compress`
          : `Get-Process | Select-Object Id, ProcessName -First ${maxResults} | ConvertTo-Json -Compress`;
        const { stdout } = await runPowerShell(script);
        let procs: Array<{ Id: number; ProcessName: string }> = [];
        try {
          const parsed = JSON.parse(stdout || '[]');
          procs = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
        } catch {
          // ignore
        }
        return {
          success: true,
          data: {
            processes: procs.map((p: { Id: number; ProcessName: string }) => ({
              pid: p.Id,
              name: p.ProcessName,
            })),
          },
        };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Failed to list processes',
        };
      }
    },
    { timeoutMs: 10000 }
  );

  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'check_port',
        description: 'Check if a port is in use (listening). Use to see if a server is running on a port.',
        parameters: {
          type: 'object',
          properties: {
            port: { type: 'number', description: 'Port number (1-65535)' },
          },
          required: ['port'],
        },
      },
    },
    async (args) => {
      const port = Number(args.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return { success: false, error: 'port must be an integer 1-65535' };
      }
      return new Promise((resolve) => {
        const server = net.createServer(() => {});
        server.once('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE') {
            resolve({ success: true, data: { port, inUse: true } });
          } else {
            resolve({ success: false, error: err.message });
          }
        });
        server.once('listening', () => {
          server.close(() => {
            resolve({ success: true, data: { port, inUse: false } });
          });
        });
        server.listen(port, '127.0.0.1');
      });
    },
    { timeoutMs: 3000 }
  );
}
