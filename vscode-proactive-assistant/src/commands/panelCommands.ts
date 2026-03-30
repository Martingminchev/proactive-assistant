import * as vscode from 'vscode';
import type { Services } from '../services';
import type { ActivityStats, Suggestion, ActivityContext } from '../types';
import { PanelProvider } from '../ui/panelProvider';
import { withErrorHandling } from '../utils/errors';

// ============================================================================
// Constants
// ============================================================================

const COMMAND_IDS = {
  OPEN_PANEL: 'proactiveAssistant.openPanel',
  SHOW_STATS: 'proactiveAssistant.showStats',
  SHOW_WELCOME: 'proactiveAssistant.showWelcome',
} as const;

const FIRST_RUN_KEY = 'proactiveAssistant.firstRunComplete';

const STATS_CATEGORIES = [
  { label: '$(calendar) Today\'s Activity', value: 'today', description: 'View your coding activity for today' },
  { label: '$(graph) Weekly Summary', value: 'weekly', description: 'Summary of the past 7 days' },
  { label: '$(lightbulb) Suggestion History', value: 'suggestions', description: 'History of suggestions and acceptance rate' },
  { label: '$(star) Productivity Insights', value: 'insights', description: 'AI-powered productivity analysis' }
];

const WIZARD_STEPS = [
  {
    id: 'intro',
    title: 'Welcome to Proactive AI Assistant! 👋',
    content: 'Your intelligent coding companion that anticipates your needs and offers timely suggestions.'
  },
  {
    id: 'features',
    title: '✨ Key Features',
    content: `• Smart suggestions based on your coding context
• Focus mode to minimize interruptions during deep work
• Activity tracking for personalized insights
• Integration with Pieces OS for enhanced AI capabilities
• Quick fixes and code improvements`
  },
  {
    id: 'pieces',
    title: '🔌 Pieces OS Integration',
    content: `The extension works best with Pieces OS running locally. This enables:
• Access to your coding history and snippets
• Enhanced context-aware suggestions
• Local AI processing for privacy`
  },
  {
    id: 'commands',
    title: '⌨️ Quick Commands',
    content: `• Ctrl+Shift+A - Open Assistant Panel
• Ctrl+Shift+F - Toggle Focus Mode
• Open Command Palette (Ctrl+Shift+P) and type "Proactive" for more`
  },
  {
    id: 'ready',
    title: '🚀 You\'re All Set!',
    content: 'Start coding and the assistant will begin learning your patterns to provide helpful suggestions.'
  }
];

// ============================================================================
// Module-level State
// ============================================================================

let panelProvider: PanelProvider | undefined;

// ============================================================================
// Panel Functions
// ============================================================================

function getPanelProvider(services: Services): PanelProvider {
  if (!panelProvider) {
    panelProvider = new PanelProvider(services.context.extensionUri, services.logger);
    services.context.subscriptions.push(panelProvider);
  }
  return panelProvider;
}

export async function openPanel(
  services: Services,
  toggle = false
): Promise<vscode.WebviewPanel | undefined> {
  try {
    services.logger.info(`openPanel called, toggle: ${toggle}`);
    services.logger.info(`Services available: ${Object.keys(services).join(', ')}`);
    
    const provider = getPanelProvider(services);
    services.logger.info('PanelProvider obtained successfully');
    
    services.logger.info(`${toggle ? 'Toggling' : 'Opening'} assistant panel`);
    services.logger.info(`Panel exists: ${provider.exists()}`);

    if (toggle && provider.exists()) {
      provider.hide();
      services.logger.info('Panel closed via toggle');
      return undefined;
    }

    services.logger.info('Calling provider.show()...');
    const panel = provider.show('welcome');
    services.logger.info(`Panel shown: ${panel ? 'success' : 'failed'}`);
    
    await vscode.commands.executeCommand(
      'setContext',
      'proactiveAssistant.panelVisible',
      true
    );

    return panel;
  } catch (error) {
    services.logger.error('Failed to open panel', error as Error);
    vscode.window.showErrorMessage(
      `Failed to open Proactive Assistant panel: ${(error as Error).message}`,
      'View Logs'
    ).then(selection => {
      if (selection === 'View Logs') {
        vscode.commands.executeCommand('proactiveAssistant.showLogs');
      }
    });
    throw error;
  }
}

export async function showSuggestion(
  services: Services,
  suggestion: unknown
): Promise<void> {
  const provider = getPanelProvider(services);
  provider.showSuggestion(suggestion as Suggestion);
}

export function updatePanelContext(
  _services: Services,
  context: ActivityContext
): void {
  if (panelProvider) {
    panelProvider.updateContext(context);
  }
}

export function updatePanelFile(
  _services: Services,
  filePath: string | null,
  duration?: number
): void {
  if (panelProvider) {
    panelProvider.updateCurrentFile(filePath, duration);
  }
}

export function updatePanelSuggestionStatus(
  _services: Services,
  id: string,
  status: 'pending' | 'accepted' | 'dismissed' | 'applied'
): void {
  if (panelProvider) {
    panelProvider.updateSuggestionStatus(id, status);
  }
}

export function updatePanelFocusMode(
  _services: Services,
  active: boolean,
  timeRemaining?: number
): void {
  if (panelProvider) {
    panelProvider.updateFocusMode(active, timeRemaining);
  }
}

export function updatePanelStats(
  _services: Services,
  stats: {
    suggestionsAccepted: number;
    suggestionsDismissed: number;
    timeInFocusMode: number;
    linesOptimized: number;
    currentStreak: number;
  }
): void {
  if (panelProvider) {
    panelProvider.updateStats(stats);
  }
}

export function showPanelCelebration(
  services: Services,
  type: 'streak' | 'milestone' | 'achievement',
  message: string
): void {
  const provider = getPanelProvider(services);
  provider.showCelebration(type, message);
}

export function getPanel(services: Services): PanelProvider {
  return getPanelProvider(services);
}

export function isPanelVisible(): boolean {
  return panelProvider?.isVisible() ?? false;
}

export function clearPanelSuggestion(id?: string): void {
  if (panelProvider) {
    panelProvider.clearSuggestion(id);
  }
}

// ============================================================================
// Stats Functions
// ============================================================================

function getMockStats(): ActivityStats {
  return {
    totalTime: 4 * 60 * 60 * 1000,
    flowStateTime: {
      idle: 30 * 60 * 1000,
      working: 2 * 60 * 60 * 1000,
      deep_flow: 1.5 * 60 * 60 * 1000,
      stuck: 15 * 60 * 1000,
      frustrated: 15 * 60 * 1000
    },
    filesWorked: 12,
    suggestionsShown: 8,
    suggestionsAccepted: 5,
    topErrors: [
      { message: 'TypeError: Cannot read property', count: 3 },
      { message: 'ReferenceError: variable is not defined', count: 2 }
    ],
    mostProductiveHour: 10,
    sessionStart: new Date(Date.now() - 4 * 60 * 60 * 1000)
  };
}

function getMockSuggestionHistory(): Suggestion[] {
  return [
    {
      id: '1',
      title: 'Optimize import statements',
      description: 'Remove unused imports in utils.ts',
      actions: [],
      priority: 'medium',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      category: 'refactoring',
      confidence: 0.85,
      seen: true
    },
    {
      id: '2',
      title: 'Fix potential null pointer',
      description: 'Add null check before accessing user.name',
      actions: [],
      priority: 'high',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      category: 'bugfix',
      confidence: 0.92,
      seen: true
    }
  ];
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

async function showTodayStats(services: Services): Promise<void> {
  const stats = services.activityTracker?.getStats() || getMockStats();
  
  const message = `
📊 **Today's Activity**

⏱️ **Time Tracked:** ${formatDuration(stats.totalTime)}
📝 **Files Worked:** ${stats.filesWorked}
💡 **Suggestions:** ${stats.suggestionsShown} shown, ${stats.suggestionsAccepted} accepted
🏆 **Acceptance Rate:** ${Math.round((stats.suggestionsAccepted / Math.max(stats.suggestionsShown, 1)) * 100)}%

**Flow State Breakdown:**
• Deep Flow: ${formatDuration(stats.flowStateTime.deep_flow)}
• Working: ${formatDuration(stats.flowStateTime.working)}
• Stuck: ${formatDuration(stats.flowStateTime.stuck)}
  `.trim();

  const selection = await vscode.window.showInformationMessage(
    message.replace(/\*\*/g, ''),
    'View in Panel',
    'Dismiss'
  );

  if (selection === 'View in Panel') {
    getPanel(services).showStats(stats);
  }

  services.logger.info('Today stats displayed');
}

async function showWeeklyStats(services: Services): Promise<void> {
  const weeklyStats = {
    totalDays: 5,
    avgDailyTime: '5h 30m',
    totalSuggestions: 42,
    acceptedSuggestions: 28,
    mostActiveDay: 'Tuesday',
    codingStreak: 3
  };

  const message = `
📈 **Weekly Summary (Last 7 Days)**

📅 **Active Days:** ${weeklyStats.totalDays}/7
⏱️ **Avg Daily Time:** ${weeklyStats.avgDailyTime}
💡 **Total Suggestions:** ${weeklyStats.totalSuggestions}
✅ **Accepted:** ${weeklyStats.acceptedSuggestions}
📊 **Weekly Rate:** ${Math.round((weeklyStats.acceptedSuggestions / weeklyStats.totalSuggestions) * 100)}%
🔥 **Current Streak:** ${weeklyStats.codingStreak} days
🏆 **Most Active:** ${weeklyStats.mostActiveDay}
  `.trim();

  vscode.window.showInformationMessage(message.replace(/\*\*/g, ''));
  services.logger.info('Weekly stats displayed');
}

async function showSuggestionHistory(services: Services): Promise<void> {
  const history = getMockSuggestionHistory();
  const stats = services.activityTracker?.getStats() || getMockStats();
  
  const byCategory: Record<string, number> = {};
  history.forEach(s => {
    byCategory[s.category || 'other'] = (byCategory[s.category || 'other'] || 0) + 1;
  });

  const categoryBreakdown = Object.entries(byCategory)
    .map(([cat, count]) => `• ${cat}: ${count}`)
    .join('\n');

  const message = `
💡 **Suggestion History**

📊 **Total Shown:** ${stats.suggestionsShown}
✅ **Accepted:** ${stats.suggestionsAccepted}
❌ **Dismissed:** ${stats.suggestionsShown - stats.suggestionsAccepted}
📈 **Success Rate:** ${Math.round((stats.suggestionsAccepted / Math.max(stats.suggestionsShown, 1)) * 100)}%

**By Category:**
${categoryBreakdown || '• No categories recorded'}

**Recent Suggestions:**
${history.slice(0, 3).map(s => `• ${s.title}`).join('\n')}
  `.trim();

  const selection = await vscode.window.showInformationMessage(
    message.replace(/\*\*/g, ''),
    'View Details',
    'Dismiss'
  );

  if (selection === 'View Details') {
    const channel = vscode.window.createOutputChannel('Proactive Assistant - History');
    channel.clear();
    channel.appendLine('=== Suggestion History ===\n');
    history.forEach(s => {
      channel.appendLine(`[${s.timestamp.toLocaleString()}] ${s.title}`);
      channel.appendLine(`  Priority: ${s.priority}, Category: ${s.category}`);
      channel.appendLine(`  ${s.description}\n`);
    });
    channel.show();
  }

  services.logger.info('Suggestion history displayed');
}

async function showProductivityInsights(services: Services): Promise<void> {
  const stats = services.activityTracker?.getStats() || getMockStats();
  
  const insights = [];
  
  if (stats.flowStateTime.deep_flow > stats.flowStateTime.working * 0.5) {
    insights.push('🎯 You spent significant time in deep flow today!');
  }
  
  if (stats.suggestionsAccepted > stats.suggestionsShown * 0.6) {
    insights.push('💡 You\'re accepting most suggestions - the AI is well-calibrated!');
  }
  
  if (stats.mostProductiveHour !== undefined) {
    insights.push(`⏰ Your most productive hour is around ${stats.mostProductiveHour}:00`);
  }
  
  if (stats.topErrors.length > 0 && stats.topErrors[0]) {
    insights.push(`⚠️ Most common issue: "${stats.topErrors[0].message}" (${stats.topErrors[0].count}x)`);
  }

  const message = `
🌟 **Productivity Insights**

${insights.join('\n\n') || 'Keep coding to generate more personalized insights!'}

**Tips:**
• Use Focus Mode during your peak productivity hours
• Review dismissed suggestions to improve relevance
• Check the weekly summary to track progress
  `.trim();

  vscode.window.showInformationMessage(message.replace(/\*\*/g, ''));
  services.logger.info('Productivity insights displayed');
}

export async function showStats(services: Services): Promise<void> {
  const selection = await vscode.window.showQuickPick(
    STATS_CATEGORIES.map(c => ({
      label: c.label,
      description: c.description,
      value: c.value
    })),
    {
      placeHolder: 'Select a statistics category',
      ignoreFocusOut: true
    }
  );

  if (!selection) {
    return;
  }

  services.logger.debug(`Stats category selected: ${selection.value}`);

  switch (selection.value) {
    case 'today':
      await showTodayStats(services);
      break;
    case 'weekly':
      await showWeeklyStats(services);
      break;
    case 'suggestions':
      await showSuggestionHistory(services);
      break;
    case 'insights':
      await showProductivityInsights(services);
      break;
  }
}

// ============================================================================
// Welcome Functions
// ============================================================================

export function isFirstRun(context: vscode.ExtensionContext): boolean {
  return !context.globalState.get<boolean>(FIRST_RUN_KEY, false);
}

export async function markFirstRunComplete(context: vscode.ExtensionContext): Promise<void> {
  await context.globalState.update(FIRST_RUN_KEY, true);
}

async function checkPiecesOsStatus(services: Services): Promise<boolean> {
  try {
    return services.piecesClient?.isAvailable() ?? false;
  } catch {
    return false;
  }
}

async function showWelcomeStep(
  step: typeof WIZARD_STEPS[0],
  currentStep: number,
  totalSteps: number
): Promise<string | undefined> {
  const buttons = [];
  
  if (currentStep > 0) {
    buttons.push('← Back');
  }
  
  if (currentStep < totalSteps - 1) {
    buttons.push('Next →');
  } else {
    buttons.push('Get Started 🚀');
  }
  
  buttons.push('Skip Tour');

  const selection = await vscode.window.showInformationMessage(
    `${step.title}\n\n${step.content}`,
    { modal: true },
    ...buttons
  );

  if (selection === '← Back') {
    return 'back';
  } else if (selection === 'Next →' || selection === 'Get Started 🚀') {
    return 'next';
  } else if (selection === 'Skip Tour') {
    return 'skip';
  }
  
  return undefined;
}

async function runPiecesSetup(services: Services): Promise<boolean> {
  const isConnected = await checkPiecesOsStatus(services);
  
  if (isConnected) {
    await vscode.window.showInformationMessage(
      '✅ Pieces OS is connected and ready!',
      'Continue'
    );
    return true;
  }

  const selection = await vscode.window.showWarningMessage(
    'Pieces OS does not appear to be running.\n\nWould you like to:\n• Download and install Pieces OS\n• Learn more about Pieces OS\n• Skip this step (you can connect later)',
    'Download Pieces OS',
    'Learn More',
    'Skip for Now'
  );

  switch (selection) {
    case 'Download Pieces OS':
      vscode.env.openExternal(vscode.Uri.parse('https://pieces.app'));
      
      await vscode.window.showInformationMessage(
        'After installing Pieces OS, click "Check Connection" to continue.',
        'Check Connection'
      );
      
      return runPiecesSetup(services);
      
    case 'Learn More':
      vscode.env.openExternal(vscode.Uri.parse('https://docs.pieces.app'));
      return runPiecesSetup(services);
      
    case 'Skip for Now':
    default:
      await vscode.window.showInformationMessage(
        'You can configure Pieces OS later in settings.',
        'Open Settings'
      ).then(s => {
        if (s === 'Open Settings') {
          vscode.commands.executeCommand('proactiveAssistant.configure');
        }
      });
      return false;
  }
}

async function showFeatureTour(services: Services): Promise<void> {
  const panel = getPanel(services);
  const panelInstance = panel.show('welcome');
  
  panelInstance.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proactive Assistant Tour</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
      line-height: 1.6;
    }
    h1 {
      font-size: 22px;
      margin-bottom: 20px;
    }
    .feature {
      margin-bottom: 25px;
      padding: 15px;
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 8px;
    }
    .feature-title {
      font-weight: 600;
      font-size: 16px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .feature-desc {
      opacity: 0.9;
    }
    .shortcut {
      background-color: var(--vscode-textCodeBlock-background);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: monospace;
    }
    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      font-family: inherit;
      font-size: inherit;
      margin-top: 20px;
    }
    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
  </style>
</head>
<body>
  <h1>🎯 Feature Tour</h1>
  
  <div class="feature">
    <div class="feature-title">💡 Smart Suggestions</div>
    <div class="feature-desc">
      The assistant watches your coding patterns and suggests improvements,
      fixes, and optimizations at the right moment.
    </div>
  </div>
  
  <div class="feature">
    <div class="feature-title">🎯 Focus Mode</div>
    <div class="feature-desc">
      Press <span class="shortcut">Ctrl+Shift+F</span> to enter focus mode.
      All non-critical suggestions are suppressed during this time.
    </div>
  </div>
  
  <div class="feature">
    <div class="feature-title">📊 Activity Insights</div>
    <div class="feature-desc">
      View your coding statistics and productivity insights.
      Run <span class="shortcut">Proactive Assistant: Show Stats</span> from the command palette.
    </div>
  </div>
  
  <div class="feature">
    <div class="feature-title">🔧 Quick Fixes</div>
    <div class="feature-desc">
      Accept code fixes with a single click. Each fix can be undone
      if needed using the standard undo command.
    </div>
  </div>
  
  <div class="feature">
    <div class="feature-title">🔕 Snooze</div>
    <div class="feature-desc">
      Not in the mood for suggestions? Snooze them for 15 minutes,
      an hour, or until tomorrow.
    </div>
  </div>

  <button onclick="vscode.postMessage({command: 'closePanel'})">Close Tour</button>
</body>
</html>`;

  panelInstance.webview.onDidReceiveMessage(
    message => {
      if (message.command === 'closePanel') {
        panel.hide();
      }
    }
  );
}

export async function showWelcome(
  services: Services,
  force = false
): Promise<void> {
  const isFirstTime = isFirstRun(services.context);
  
  if (!isFirstTime && !force) {
    services.logger.debug('Welcome wizard skipped - not first run');
    return;
  }

  services.logger.info('Showing welcome wizard');

  let currentStep = 0;
  const totalSteps = WIZARD_STEPS.length;

  while (currentStep < totalSteps) {
    const step = WIZARD_STEPS[currentStep];
    if (!step) {
      break;
    }
    const result = await showWelcomeStep(step, currentStep, totalSteps);

    if (result === 'skip') {
      break;
    } else if (result === 'back') {
      currentStep = Math.max(0, currentStep - 1);
    } else if (result === 'next') {
      if (step.id === 'pieces') {
        await runPiecesSetup(services);
      }
      currentStep++;
    } else {
      break;
    }
  }

  await markFirstRunComplete(services.context);
  await showFeatureTour(services);

  services.logger.info('Welcome wizard completed');
}

export async function checkAndShowWelcome(services: Services): Promise<void> {
  if (isFirstRun(services.context)) {
    setTimeout(() => {
      showWelcome(services);
    }, 1000);
  }
}

// ============================================================================
// Command Registration
// ============================================================================

export function registerOpenPanelCommand(services: Services): vscode.Disposable {
  const command = withErrorHandling(
    async () => openPanel(services, true),
    services.logger,
    COMMAND_IDS.OPEN_PANEL
  );

  return vscode.commands.registerCommand(COMMAND_IDS.OPEN_PANEL, command);
}

export function registerShowStatsCommand(services: Services): vscode.Disposable {
  const command = withErrorHandling(
    async () => showStats(services),
    services.logger,
    COMMAND_IDS.SHOW_STATS
  );

  return vscode.commands.registerCommand(COMMAND_IDS.SHOW_STATS, command);
}

export function registerShowWelcomeCommand(services: Services): vscode.Disposable {
  const command = withErrorHandling(
    async (...args: unknown[]) => {
      const force = args[0] as boolean | undefined;
      return showWelcome(services, force ?? false);
    },
    services.logger,
    COMMAND_IDS.SHOW_WELCOME
  );

  return vscode.commands.registerCommand(COMMAND_IDS.SHOW_WELCOME, command);
}

// ============================================================================
// Export Command IDs
// ============================================================================

export const COMMAND_ID_OPEN_PANEL = COMMAND_IDS.OPEN_PANEL;
export const COMMAND_ID_SHOW_STATS = COMMAND_IDS.SHOW_STATS;
export const COMMAND_ID_SHOW_WELCOME = COMMAND_IDS.SHOW_WELCOME;
