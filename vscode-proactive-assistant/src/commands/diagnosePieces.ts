import * as vscode from 'vscode';
import type { Services } from '../services';

export const COMMAND_ID = 'proactiveAssistant.diagnosePieces';

export async function diagnosePieces(services: Services): Promise<void> {
  const logger = services.logger;
  
  logger.info('Starting Pieces OS diagnostics...');
  
  const output = vscode.window.createOutputChannel('Pieces OS Diagnostics');
  output.show();
  output.appendLine('=== Pieces OS Connection Diagnostics ===\n');
  
  const piecesClient = services.piecesClient;
  
  output.appendLine('1. Checking if Pieces OS client is available...');
  const isAvailable = piecesClient.isAvailable();
  output.appendLine(`   Status: ${isAvailable ? '✅ Connected' : '❌ Not connected'}\n`);
  
  if ('diagnoseConnection' in piecesClient) {
    output.appendLine('2. Running port diagnostics...');
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = await (piecesClient as any).diagnoseConnection();
      for (const result of results) {
        output.appendLine(`   ${result}`);
      }
    } catch (error) {
      output.appendLine(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  output.appendLine('\n3. Checking current connection status...');
  output.appendLine(`   Current Status: ${isAvailable ? 'Connected' : 'Disconnected'}`);
  
  output.appendLine('\n=== Troubleshooting Tips ===');
  output.appendLine('1. Ensure Pieces OS is running (check system tray)');
  output.appendLine('2. Try restarting Pieces OS');
  output.appendLine('3. Check Windows Firewall settings for port 39300');
  output.appendLine('4. Download Pieces OS from: https://pieces.app/');
  
  output.appendLine('\n=== End of Diagnostics ===');
  
  vscode.window.showInformationMessage(
    'Pieces OS diagnostics complete. Check the "Pieces OS Diagnostics" output channel.',
    'OK'
  );
}

export function registerDiagnosePiecesCommand(services: Services): vscode.Disposable {
  return vscode.commands.registerCommand(COMMAND_ID, () => diagnosePieces(services));
}
