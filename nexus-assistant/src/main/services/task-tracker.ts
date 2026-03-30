// =============================================================================
// NEXUS - Task Tracker Service
// Tracks what the user is working on and asks confirming questions
// =============================================================================

import { EventEmitter } from 'events';
import log from 'electron-log';
import { v4 as uuidv4 } from 'uuid';
import { SystemContext } from '../../shared/types';

export interface Task {
  id: string;
  description: string;
  project?: string;
  startedAt: number;
  context: {
    apps: string[];
    files: string[];
    keywords: string[];
  };
  status: 'active' | 'paused' | 'completed';
}

export interface TaskInference {
  description: string;
  project?: string;
  confidence: number;
  apps: string[];
  files: string[];
  keywords: string[];
}

export class TaskTracker extends EventEmitter {
  private currentTask: Task | null = null;
  private taskHistory: Task[] = [];
  private lastInference: TaskInference | null = null;
  private pendingConfirmation: TaskInference | null = null;

  inferTask(context: SystemContext): TaskInference {
    const app = context.activeWindow?.application?.toLowerCase() || '';
    const title = context.activeWindow?.title || '';
    const project = this.extractProject(title, app);
    const files = context.recentFiles?.map((f) => f.path?.split(/[/\\]/).pop() || '').filter(Boolean) || [];
    const keywords = this.extractKeywords(title, app);

    const apps = app ? [app] : [];
    const description = project
      ? `Working on ${project}`
      : app
      ? `Working in ${app}`
      : 'Unknown task';

    let confidence = 0.5;
    if (project) confidence += 0.3;
    if (app && ['code.exe', 'cursor.exe', 'idea', 'pycharm'].some((ide) => app.includes(ide))) confidence += 0.2;
    if (files.length > 0) confidence += 0.1;

    return {
      description,
      project,
      confidence: Math.min(confidence, 1),
      apps,
      files: files.slice(0, 5),
      keywords: keywords.slice(0, 5),
    };
  }

  private extractProject(title: string, app: string): string | undefined {
    if (app.includes('code') || app.includes('cursor')) {
      const parts = title.split(' - ');
      if (parts.length >= 2) return parts[parts.length - 2];
    }
    if (app.includes('terminal') || app.includes('iterm')) {
      const match = title.match(/[\/\\]([^\/\\]+)$/);
      if (match) return match[1];
    }
    return undefined;
  }

  private extractKeywords(title: string, app: string): string[] {
    const words: string[] = [];
    const combined = `${title} ${app}`.toLowerCase();
    const patterns = [/\b(api|auth|fix|bug|feature|refactor|test)\b/gi, /\.(ts|tsx|js|jsx|py|rs|go)\b/gi];
    for (const p of patterns) {
      const matches = combined.match(p);
      if (matches) words.push(...matches.map((m) => m.replace(/^\./, '')));
    }
    return [...new Set(words)].slice(0, 5);
  }

  getCurrentTask(): Task | null {
    return this.currentTask ? { ...this.currentTask } : null;
  }

  getTaskHistory(): Task[] {
    return [...this.taskHistory];
  }

  setTask(inference: TaskInference): Task {
    const task: Task = {
      id: uuidv4(),
      description: inference.description,
      project: inference.project,
      startedAt: Date.now(),
      context: {
        apps: inference.apps,
        files: inference.files,
        keywords: inference.keywords,
      },
      status: 'active',
    };
    if (this.currentTask) {
      this.currentTask.status = 'completed';
      this.taskHistory.push(this.currentTask);
    }
    this.currentTask = task;
    this.emit('taskChange', this.currentTask);
    log.debug('[TaskTracker] Task set:', task.description);
    return task;
  }

  confirmTask(inference: TaskInference): void {
    this.pendingConfirmation = inference;
    this.emit('taskConfirmationRequested', inference);
  }

  respondToConfirmation(accepted: boolean): void {
    const pending = this.pendingConfirmation;
    this.pendingConfirmation = null;
    if (pending && accepted) {
      this.setTask(pending);
    }
  }

  clearTask(): void {
    if (this.currentTask) {
      this.currentTask.status = 'completed';
      this.taskHistory.push(this.currentTask);
    }
    this.currentTask = null;
  }

  hasPendingConfirmation(): boolean {
    return this.pendingConfirmation !== null;
  }

  getPendingConfirmation(): TaskInference | null {
    return this.pendingConfirmation;
  }
}
