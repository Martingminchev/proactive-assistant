// =============================================================================
// NEXUS - Quick Actions
// Context-aware actions for the sidebar - dynamically shown based on what
// the user is currently doing
// =============================================================================

import type { QuickActionDefinition, QuickActionCondition } from '../../shared/types';

// =============================================================================
// Context Detection Helpers
// =============================================================================

const EDITOR_APPS = ['Code', 'Cursor', 'cursor.exe', 'code.exe', 'vim', 'neovim', 'WebStorm', 'IntelliJ', 'PyCharm', 'Sublime', 'Atom', 'VSCodium'];
const TERMINAL_APPS = ['Terminal', 'iTerm', 'WindowsTerminal', 'cmd.exe', 'powershell', 'wt.exe', 'Hyper', 'Alacritty', 'kitty', 'Warp'];
const BROWSER_APPS = ['Chrome', 'Firefox', 'Safari', 'Edge', 'Brave', 'Opera', 'Arc', 'Vivaldi'];

export function isInEditor(appName?: string): boolean {
  if (!appName) return false;
  const lower = appName.toLowerCase();
  return EDITOR_APPS.some((app) => lower.includes(app.toLowerCase()));
}

export function isInTerminal(appName?: string): boolean {
  if (!appName) return false;
  const lower = appName.toLowerCase();
  return TERMINAL_APPS.some((app) => lower.includes(app.toLowerCase()));
}

export function isInBrowser(appName?: string): boolean {
  if (!appName) return false;
  const lower = appName.toLowerCase();
  return BROWSER_APPS.some((app) => lower.includes(app.toLowerCase()));
}

// Pattern matchers
const CODE_INDICATORS = /[{}\[\]();=<>]|const |let |var |function |class |import |return |def |=>|async |await |export /;
const ERROR_INDICATORS = /\berror\b|\bexception\b|\bfailed\b|\bcrash\b|\bdebug\b|stack\s*trace|undefined is not|cannot read|typeerror|syntaxerror|referenceerror/i;
const WINDOW_ERROR_INDICATORS = /error|exception|failed|crash|debug|stackoverflow|github\.com\/.*\/issues/i;
const URL_PATTERN = /https?:\/\/[^\s]+/;
const JSON_PATTERN = /^\s*[{\[]/;
const GIT_INDICATORS = /\bgit\b|github|gitlab|bitbucket|\.git\b|commit|branch|merge|pull request|PR #/i;
const TEST_FILE_INDICATORS = /\.test\.|\.spec\.|_test\.|_spec\.|test_|spec_|__tests__|tests\/|test\//i;

// =============================================================================
// Condition Evaluator
// =============================================================================

interface EvaluationContext {
  activeWindow?: { application?: string; title?: string };
  clipboardPreview?: string;
}

export function evaluateCondition(
  condition: QuickActionCondition,
  ctx: EvaluationContext
): boolean {
  const app = ctx.activeWindow?.application || '';
  const title = ctx.activeWindow?.title || '';
  const clipboard = ctx.clipboardPreview || '';

  switch (condition) {
    case 'always':
      return true;
    
    case 'isInEditor':
      return isInEditor(app);
    
    case 'isInTerminal':
      return isInTerminal(app);
    
    case 'isInBrowser':
      return isInBrowser(app);
    
    case 'hasCodeSelected':
      return clipboard.length > 10 && CODE_INDICATORS.test(clipboard);
    
    case 'hasErrors':
      // Check both window title and clipboard for errors
      return WINDOW_ERROR_INDICATORS.test(title) || 
             (clipboard.length > 5 && ERROR_INDICATORS.test(clipboard));
    
    case 'hasUrl':
      return URL_PATTERN.test(clipboard) || URL_PATTERN.test(title);
    
    case 'hasJsonInClipboard':
      return JSON_PATTERN.test(clipboard.trim()) && clipboard.length > 5;
    
    case 'isInGitRepo':
      // Check if we're likely in a git context
      return GIT_INDICATORS.test(title) || GIT_INDICATORS.test(app);
    
    case 'hasTestFile':
      return TEST_FILE_INDICATORS.test(title);
    
    default:
      return false;
  }
}

// =============================================================================
// Quick Action Definitions
// Ordered by priority (higher priority shown first when applicable)
// =============================================================================

export const QUICK_ACTIONS: QuickActionDefinition[] = [
  // ---- High Priority Context Actions ----
  {
    id: 'fix-error',
    label: 'Fix Error',
    icon: 'Bug',
    condition: 'hasErrors',
    handler: 'fixCurrentError',
    priority: 100,
  },
  {
    id: 'explain-code',
    label: 'Explain Code',
    icon: 'Lightbulb',
    condition: 'hasCodeSelected',
    handler: 'explainSelectedCode',
    priority: 90,
  },
  {
    id: 'run-tests',
    label: 'Run Tests',
    icon: 'Play',
    condition: 'hasTestFile',
    handler: 'runTests',
    priority: 85,
  },
  
  // ---- Editor Context Actions ----
  {
    id: 'review-code',
    label: 'Review Code',
    icon: 'Search',
    condition: 'hasCodeSelected',
    handler: 'reviewCode',
    priority: 80,
  },
  {
    id: 'refactor',
    label: 'Refactor',
    icon: 'Zap',
    condition: 'isInEditor',
    handler: 'suggestRefactoring',
    priority: 70,
  },
  {
    id: 'find-usages',
    label: 'Find Usages',
    icon: 'FileSearch',
    condition: 'isInEditor',
    handler: 'findUsages',
    priority: 65,
  },
  
  // ---- Git Actions ----
  {
    id: 'git-status',
    label: 'Git Status',
    icon: 'GitBranch',
    condition: 'isInGitRepo',
    handler: 'gitStatus',
    priority: 60,
  },
  {
    id: 'git-diff',
    label: 'Show Changes',
    icon: 'GitCompare',
    condition: 'isInGitRepo',
    handler: 'gitDiff',
    priority: 55,
  },
  
  // ---- Terminal Actions ----
  {
    id: 'explain-command',
    label: 'Explain Command',
    icon: 'Terminal',
    condition: 'isInTerminal',
    handler: 'explainTerminalCommand',
    priority: 50,
  },
  
  // ---- Browser Actions ----
  {
    id: 'summarize-page',
    label: 'Summarize Page',
    icon: 'FileText',
    condition: 'isInBrowser',
    handler: 'summarizeWebPage',
    priority: 45,
  },
  {
    id: 'fetch-url',
    label: 'Fetch URL',
    icon: 'Link',
    condition: 'hasUrl',
    handler: 'fetchUrl',
    priority: 40,
  },
  
  // ---- Data Processing ----
  {
    id: 'format-json',
    label: 'Format JSON',
    icon: 'Braces',
    condition: 'hasJsonInClipboard',
    handler: 'formatJson',
    priority: 35,
  },
  
  // ---- Always Available ----
  {
    id: 'screenshot',
    label: 'Analyze Screen',
    icon: 'Camera',
    condition: 'always',
    handler: 'captureScreenshot',
    priority: 20,
  },
  {
    id: 'analyze',
    label: 'Analyze Work',
    icon: 'Sparkles',
    condition: 'always',
    handler: 'triggerProactiveAnalysis',
    priority: 10,
  },
];

// =============================================================================
// Helper to get sorted, filtered actions
// =============================================================================

export function getAvailableActions(ctx: EvaluationContext): QuickActionDefinition[] {
  return QUICK_ACTIONS
    .filter(action => evaluateCondition(action.condition, ctx))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));
}
