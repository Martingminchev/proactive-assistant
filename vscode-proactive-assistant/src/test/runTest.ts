/**
 * VS Code Test Runner
 * 
 * This script downloads VS Code, runs the extension tests,
 * and reports results. It's the entry point for all tests.
 */

import * as path from 'path';
import { runTests } from '@vscode/test-electron';

/**
 * Main test runner function
 */
async function main(): Promise<void> {
  try {
    // The folder containing the Extension Manifest package.json
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to test runner script
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    // Download VS Code, unzip it and run the integration test
    const exitCode = await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        // Disable other extensions for faster, more isolated tests
        '--disable-extensions',
        // Use a clean user data directory
        '--user-data-dir',
        path.join(__dirname, '../.vscode-test/user-data'),
        // Use a clean extensions directory
        '--extensions-dir',
        path.join(__dirname, '../.vscode-test/extensions'),
      ],
    });

    console.log(`Tests completed with exit code: ${exitCode}`);
    
    // Exit with the test result code
    process.exit(exitCode);
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

// Run the tests
main();
