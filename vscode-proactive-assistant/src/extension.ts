import * as vscode from 'vscode';
import { registerCommands, disposeCommands, getPanel, panelCommands } from './commands';
import { Services } from './services';
import { createLogger, Logger } from './utils/logger';
import { DisposableStore } from './types';

import { ActivityMonitor } from './services/activityMonitor';
import { SuggestionEngine } from './services/suggestionEngine';
import { PiecesOSClient } from './services/piecesClient';
import { InterruptionManager } from './services/interruptionManager';
import { StorageManager } from './services/storageManager';
import { StatusBarManager } from './services/statusBarManager';
import { SuggestionOrchestrator } from './services/suggestionOrchestrator';

let services: Services | undefined;
let disposables: DisposableStore | undefined;
let logger: Logger | undefined;
let orchestrator: SuggestionOrchestrator | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  logger = createLogger(context);
  logger.info('=== EXTENSION ACTIVATION START ===');
  logger.info(`Extension path: ${context.extensionUri?.fsPath}`);
  logger.info(`Extension mode: ${context.extensionMode === vscode.ExtensionMode.Development ? 'Development' : context.extensionMode === vscode.ExtensionMode.Test ? 'Test' : 'Production'}`);
  disposables = new DisposableStore();

  try {
    logger.info('Initializing ActivityMonitor...');
    const activityTracker = new ActivityMonitor(context, logger);
    
    logger.info('Initializing SuggestionEngine...');
    const suggestionProvider = new SuggestionEngine(context, logger);
    
    logger.info('Initializing PiecesOSClient...');
    const piecesClient = new PiecesOSClient(logger);
    
    logger.info('Initializing InterruptionManager...');
    const interruptionManager = new InterruptionManager(context, logger);
    
    logger.info('Initializing StorageManager...');
    const storageManager = new StorageManager(context, logger);
    
    logger.info('Initializing StatusBarManager...');
    const statusBarManager = new StatusBarManager(context, logger);

    logger.info('Connecting StatusBarManager to ActivityMonitor...');
    statusBarManager.connectToActivityMonitor(activityTracker);

    await Promise.all([
      activityTracker.initialize(),
      suggestionProvider.initialize(),
      piecesClient.initialize(),
      interruptionManager.initialize(),
      storageManager.initialize(),
      statusBarManager.initialize()
    ]);

    logger.info('All services initialized successfully');
    logger.info(`ActivityMonitor current context: ${JSON.stringify(activityTracker.getCurrentContext())}`);
    logger.info(`Services initialized: ActivityMonitor, SuggestionEngine, PiecesOSClient, InterruptionManager, StorageManager, StatusBarManager`);

    // Global error handlers
    const handleUnhandledRejection = (reason: unknown, _promise: Promise<unknown>) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      logger?.error('Unhandled Promise Rejection', error);
    };

    const handleUncaughtException = (error: Error) => {
      logger?.error('Uncaught Exception', error);
      // Show error to user for critical crashes
      vscode.window.showErrorMessage(
        `Proactive Assistant encountered a critical error: ${error.message}. Please reload the window.`,
        'Reload Window'
      ).then(selection => {
        if (selection === 'Reload Window') {
          vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
      });
    };

    process.on('unhandledRejection', handleUnhandledRejection);
    process.on('uncaughtException', handleUncaughtException);

    // Register for cleanup
    context.subscriptions.push({
      dispose: () => {
        process.off('unhandledRejection', handleUnhandledRejection);
        process.off('uncaughtException', handleUncaughtException);
      }
    });

    services = {
      activityTracker,
      suggestionProvider,
      piecesClient,
      interruptionManager,
      storageManager,
      statusBarManager,
      logger,
      context
    };

    const panelProvider = getPanel(services);
    
    // Subscribe to Pieces OS connection status changes and update the panel
    const piecesStatusDisposable = piecesClient.onStatusChanged((status) => {
      logger?.info(`[Extension] Pieces OS status changed to: ${status}`);
      panelProvider.updatePiecesConnectionStatus(status);
    });
    // Set initial status
    panelProvider.updatePiecesConnectionStatus(piecesClient.status);
    context.subscriptions.push(piecesStatusDisposable);
    
    orchestrator = new SuggestionOrchestrator(
      activityTracker,
      suggestionProvider,
      interruptionManager,
      panelProvider,
      piecesClient
    );
    orchestrator.start();

    logger.info('Registering commands...');
    const commandDisposables = registerCommands(context, services);
    disposables.addAll(...commandDisposables);
    logger.info(`Registered ${commandDisposables.length} commands`);

    const configDisposable = vscode.workspace.onDidChangeConfiguration(handleConfigurationChange);
    disposables.add(configDisposable);
    context.subscriptions.push(configDisposable);
    await vscode.commands.executeCommand(
      'setContext',
      'proactiveAssistant.enabled',
      true
    );
    await vscode.commands.executeCommand(
      'setContext',
      'proactiveAssistant.hasActiveSuggestion',
      false
    );
    await vscode.commands.executeCommand(
      'setContext',
      'proactiveAssistant.focusModeEnabled',
      false
    );
    await vscode.commands.executeCommand(
      'setContext',
      'proactiveAssistant.snoozed',
      false
    );

    await panelCommands.checkAndShowWelcome(services);
    const showLogsCommand = vscode.commands.registerCommand(
      'proactiveAssistant.showLogs',
      () => logger?.show()
    );
    disposables.add(showLogsCommand);
    context.subscriptions.push(showLogsCommand);

    logger.info('=== EXTENSION ACTIVATION COMPLETE ===');
    logger.info('Proactive AI Assistant extension activated successfully');
    if (context.extensionMode === vscode.ExtensionMode.Development) {
      vscode.window.showInformationMessage(
        'Proactive AI Assistant is now active',
        'Open Panel',
        'Settings'
      ).then(selection => {
        if (selection === 'Open Panel') {
          vscode.commands.executeCommand('proactiveAssistant.openPanel');
        } else if (selection === 'Settings') {
          vscode.commands.executeCommand('proactiveAssistant.configure');
        }
      }).then(undefined, (error: Error) => {
        logger?.error('Error handling startup message', error);
      });
    }

  } catch (error) {
    logger?.error(
      'Failed to activate extension',
      error instanceof Error ? error : new Error(String(error))
    );
    
    vscode.window.showErrorMessage(
      'Failed to activate Proactive AI Assistant. Check the logs for details.',
      'View Logs'
    ).then(selection => {
      if (selection === 'View Logs') {
        logger?.show();
      }
    }).then(undefined, (error: Error) => {
      logger?.error('Error handling view logs message', error);
    });
    
    throw error;
  }
}

function handleConfigurationChange(event: vscode.ConfigurationChangeEvent): void {
  if (!logger) {
    return;
  }

  // Update log level if logging configuration changed
  if (event.affectsConfiguration('proactiveAssistant.logging.level')) {
    const config = vscode.workspace.getConfiguration('proactiveAssistant.logging');
    const newLevel = config.get<string>('level', 'info');
    
    if (logger instanceof Logger) {
      logger.setLevel(newLevel as 'debug' | 'info' | 'warn' | 'error');
      logger.info(`Log level changed to: ${newLevel}`);
    }
  }

  // Handle other configuration changes
  if (event.affectsConfiguration('proactiveAssistant.enabled')) {
    const config = vscode.workspace.getConfiguration('proactiveAssistant');
    const enabled = config.get<boolean>('enabled', true);
    
    vscode.commands.executeCommand(
      'setContext',
      'proactiveAssistant.enabled',
      enabled
    );
    
    logger.info(`Extension ${enabled ? 'enabled' : 'disabled'}`);
  }
}

export function deactivate(): void {
  logger?.info('Proactive AI Assistant extension deactivating...');

  // Dispose commands
  disposeCommands();

  // Dispose all tracked disposables
  disposables?.dispose();

  // Dispose orchestrator before services
  orchestrator?.dispose();

  // Dispose services in reverse order of initialization
  services?.statusBarManager?.dispose();
  services?.storageManager?.dispose();
  services?.interruptionManager?.dispose();
  services?.piecesClient.dispose();
  services?.suggestionProvider.dispose();
  services?.activityTracker.dispose();
  (services?.logger as Logger | undefined)?.dispose();

  logger?.info('Proactive AI Assistant extension deactivated');
  console.log('Proactive AI Assistant extension deactivated');
}

export function getServices(): Services | undefined {
  return services;
}
