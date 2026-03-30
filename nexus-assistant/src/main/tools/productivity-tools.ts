import { promises as fs } from 'fs';
import * as path from 'path';
import { app, Notification } from 'electron';
import type { IToolRegistry } from './types';

function getNotesDir(): string {
  return path.join(app.getPath('userData'), 'notes');
}

function getDailyNotesPath(): string {
  return path.join(getNotesDir(), `${new Date().toISOString().slice(0, 10)}.md`);
}

function getDailyLogPath(): string {
  return path.join(app.getPath('userData'), 'logs', `${new Date().toISOString().slice(0, 10)}.log`);
}

export function registerProductivityTools(registry: IToolRegistry): void {
  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'quick_note',
        description: 'Append a line to today\'s scratchpad markdown file. Use for quick notes or todos.',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Note text to append' },
          },
          required: ['text'],
        },
      },
    },
    async (args) => {
      const text = args.text as string;
      if (text == null) return { success: false, error: 'text is required' };
      try {
        const filePath = getDailyNotesPath();
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        const line = `- ${new Date().toISOString().slice(11, 19)} ${text}\n`;
        await fs.appendFile(filePath, line, 'utf-8');
        return { success: true, data: { path: filePath } };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Failed to append note',
        };
      }
    },
    { timeoutMs: 5000, requireConfirmation: true }
  );

  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'append_to_daily_log',
        description: 'Append a timestamped log entry to the daily log file. Use for structured logging.',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Log message' },
            category: { type: 'string', description: 'Optional category label' },
          },
          required: ['text'],
        },
      },
    },
    async (args) => {
      const text = args.text as string;
      const category = args.category as string | undefined;
      if (text == null) return { success: false, error: 'text is required' };
      try {
        const filePath = getDailyLogPath();
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        const ts = new Date().toISOString();
        const prefix = category ? `[${category}] ` : '';
        const line = `${ts} ${prefix}${text}\n`;
        await fs.appendFile(filePath, line, 'utf-8');
        return { success: true, data: { path: filePath } };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Failed to append log',
        };
      }
    },
    { timeoutMs: 5000, requireConfirmation: true }
  );

  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'start_pomodoro',
        description: 'Start a Pomodoro timer; show an OS notification when the time is up.',
        parameters: {
          type: 'object',
          properties: {
            minutes: { type: 'number', description: 'Timer duration in minutes (e.g. 25)', default: 25 },
            message: { type: 'string', description: 'Optional message for the notification', default: 'Pomodoro complete' },
          },
          required: [],
        },
      },
    },
    async (args) => {
      const minutes = Math.min(Math.max(Number(args.minutes) || 25, 1), 120);
      const message = (args.message as string) || 'Pomodoro complete';
      const ms = minutes * 60 * 1000;
      setTimeout(() => {
        try {
          const n = new Notification({
            title: 'Pomodoro',
            body: message,
            silent: false,
          });
          n.show();
        } catch {
          // ignore
        }
      }, ms);
      return {
        success: true,
        data: {
          minutes,
          message,
          endsAt: new Date(Date.now() + ms).toISOString(),
        },
      };
    },
    { timeoutMs: 2000, requireConfirmation: true }
  );

  registry.registerTool(
    {
      type: 'function',
      function: {
        name: 'prep_for_meeting',
        description: 'Gather context for an upcoming meeting: recent notes, daily log summary, and optional LTM/calendar context. Use when the user is about to join a meeting.',
        parameters: {
          type: 'object',
          properties: {
            meeting_title: { type: 'string', description: 'Optional meeting title or topic' },
          },
        },
      },
    },
    async (args, context) => {
      const meetingTitle = args.meeting_title as string | undefined;
      try {
        const notesPath = getDailyNotesPath();
        const logPath = getDailyLogPath();
        let notesPreview = '';
        let logPreview = '';
        try {
          notesPreview = (await fs.readFile(notesPath, 'utf-8')).slice(-2000);
        } catch {
          notesPreview = '(No notes today)';
        }
        try {
          const logContent = await fs.readFile(logPath, 'utf-8');
          const lines = logContent.trim().split('\n').slice(-30);
          logPreview = lines.join('\n') || '(No log entries today)';
        } catch {
          logPreview = '(No log today)';
        }
        const summary = {
          meetingTitle: meetingTitle ?? null,
          dailyNotesPreview: notesPreview,
          dailyLogPreview: logPreview,
          hint: 'Use request_extra_context with type ltm_topic or ltm to add recent work context.',
        };
        return { success: true, data: summary };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : 'Failed to gather meeting prep',
        };
      }
    },
    { timeoutMs: 5000, requireConfirmation: true }
  );
}
