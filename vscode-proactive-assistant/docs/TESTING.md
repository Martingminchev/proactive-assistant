# Testing Guide

This guide covers how to run tests, write new tests, and understand the coverage requirements for the Proactive AI Assistant extension.

## Table of Contents

- [Quick Start](#quick-start)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Writing New Tests](#writing-new-tests)
- [Coverage Requirements](#coverage-requirements)
- [Mock Data](#mock-data)
- [Troubleshooting](#troubleshooting)

## Quick Start

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Or use the convenience scripts
cd src/test/scripts
./runTests.sh          # Linux/Mac
.\runTests.ps1         # Windows

# With coverage
./runTests.sh --coverage
.\runTests.ps1 -Coverage
```

## Running Tests

### Prerequisites

1. Node.js 18+ installed
2. Dependencies installed: `npm install`
3. TypeScript compiled: `npm run compile`

### Test Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run compile` | Compile TypeScript |
| `npm run lint` | Run ESLint |

### Platform-Specific Scripts

**Linux/Mac:**
```bash
cd src/test/scripts
chmod +x runTests.sh
./runTests.sh
```

**Windows:**
```powershell
cd src/test/scripts
.\runTests.ps1
```

## Test Structure

```
src/test/
├── runTest.ts              # VS Code test runner entry point
├── suite/
│   ├── index.ts            # Mocha configuration
│   ├── piecesClient.test.ts       # PiecesOSClient tests
│   ├── activityMonitor.test.ts    # ActivityMonitor tests
│   ├── interruptionManager.test.ts # InterruptionManager tests
│   ├── suggestionEngine.test.ts   # SuggestionEngine tests
│   ├── storageManager.test.ts     # StorageManager tests
│   ├── extension.test.ts          # Extension integration tests
│   └── commands.test.ts           # Commands integration tests
├── utils/
│   └── testHelpers.ts      # Test utilities and helpers
├── mocks/
│   ├── vscode.ts           # VS Code API mocks
│   └── piecesResponses.ts  # Mock Pieces OS responses
└── scripts/
    ├── runTests.sh         # Linux/Mac test runner script
    └── runTests.ps1        # Windows test runner script
```

## Writing New Tests

### Test File Template

```typescript
/**
 * [ServiceName] Unit Tests
 * 
 * Description of what these tests cover.
 */

import * as assert from 'assert';
import { ServiceName } from '../../services/serviceName';
import { createMockExtensionContext, createMockLogger } from '../utils/testHelpers';

describe('ServiceName', () => {
  let service: ServiceName;
  let mockContext: ReturnType<typeof createMockExtensionContext>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockContext = createMockExtensionContext();
    mockLogger = createMockLogger();
    service = new ServiceName(mockContext, mockLogger);
  });

  afterEach(() => {
    service.dispose();
  });

  describe('Feature', () => {
    it('should do something', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = service.doSomething(input);
      
      // Assert
      assert.strictEqual(result, expected);
    });
  });
});
```

### Best Practices

1. **Use Descriptive Names**: Test names should clearly describe what's being tested
   ```typescript
   it('should block interruptions when focus mode is active', () => {
   ```

2. **Arrange-Act-Assert**: Structure tests with clear phases
   ```typescript
   // Arrange - set up test data
   // Act - execute the code being tested
   // Assert - verify the results
   ```

3. **One Assertion Per Test**: When possible, test one concept per test

4. **Use Mocks**: Mock external dependencies (VS Code API, network calls)
   ```typescript
   import { createMockExtensionContext } from '../utils/testHelpers';
   ```

5. **Clean Up**: Always dispose resources in `afterEach`
   ```typescript
   afterEach(() => {
     service.dispose();
   });
   ```

### Available Helpers

```typescript
// Mock creation
import {
  createMockExtensionContext,  // Mock VS Code extension context
  createMockTextEditor,        // Mock text editor
  createMockLogger,            // Mock logger
  createMockActivityContext,   // Mock activity context
  createMockSuggestion,        // Mock suggestion
  createDefaultSettings        // Default settings object
} from '../utils/testHelpers';

// Simulation helpers
import {
  simulateTyping,     // Simulate typing in editor
  simulateError,      // Add diagnostic to editor
  waitFor,            // Async delay
  waitForCondition    // Wait for condition with timeout
} from '../utils/testHelpers';

// Mock data
import {
  mockWorkstreamSummaries,
  mockVisionEvents,
  mockConversations,
  mockCopilotResponses,
  mockHealthResponses,
  mockApiErrors
} from '../mocks/piecesResponses';
```

## Coverage Requirements

### Minimum Coverage: 80%

| Metric | Minimum | Target |
|--------|---------|--------|
| Statements | 80% | 90% |
| Branches | 80% | 85% |
| Functions | 80% | 90% |
| Lines | 80% | 90% |

### Viewing Coverage Report

After running tests with coverage:

```bash
# Open the HTML report
# Linux/Mac
open coverage/lcov-report/index.html

# Windows
start coverage/lcov-report/index.html
```

Or view the text summary in the terminal output.

### Excluding Files from Coverage

Add to `.nycrc.json` or `package.json`:

```json
{
  "nyc": {
    "exclude": [
      "out/test/**",
      "src/test/**",
      "**/*.d.ts"
    ]
  }
}
```

## Mock Data

### VS Code API Mocks

The `mocks/vscode.ts` file provides comprehensive mocks for VS Code APIs:

- `mockVscode` - Complete mock of the vscode module
- `createMockTextDocument(content, language, fileName)` - Mock document
- `createMockTextEditor(content, language, fileName)` - Mock editor
- `createMockDiagnostic(message, line, severity)` - Mock diagnostic
- `createMockExtensionContext()` - Mock extension context

### Pieces OS API Mocks

The `mocks/piecesResponses.ts` file provides sample API responses:

- `mockWorkstreamSummaries` - Sample workstream data
- `mockVisionEvents` - Sample vision/OCR events
- `mockConversations` - Sample conversation history
- `mockCopilotResponses` - Sample copilot responses
- `mockHealthResponses` - Sample health check responses
- `mockApiErrors` - Sample error responses

### Creating Custom Mocks

```typescript
// Custom workstream summary
const summary = createWorkstreamSummary(
  'User was debugging authentication',
  { source: 'VS Code', metadata: { file: 'auth.ts' } }
);

// Custom copilot response
const response = createCopilotResponse(
  'Here is a solution...',
  0.95,
  ['Option 1', 'Option 2']
);
```

## Troubleshooting

### Tests Fail to Start

1. **Check TypeScript compilation:**
   ```bash
   npm run compile
   ```

2. **Clear compiled output:**
   ```bash
   npm run clean
   npm run compile
   ```

3. **Reinstall dependencies:**
   ```bash
   rm -rf node_modules
   npm install
   ```

### VS Code Test Environment Issues

1. **Download VS Code for testing:**
   The test runner automatically downloads VS Code on first run.

2. **Use launch configuration:**
   Use `.vscode/launch.json` to debug tests in VS Code.

3. **Check VS Code version:**
   Tests run against the downloaded version, not your installed VS Code.

### Coverage Issues

1. **Source maps not working:**
   Ensure `sourceMap: true` in `tsconfig.json`.

2. **Files not instrumented:**
   Run `npm run compile` before `npm run test:coverage`.

3. **Coverage threshold failures:**
   Check the coverage report to see which files need more tests.

### Async Test Timeouts

If tests timeout, increase the timeout in `suite/index.ts`:

```typescript
const mocha = new Mocha({
  timeout: 20000, // Increase from default 10000
});
```

Or add timeout to specific tests:

```typescript
it('should complete long operation', async function() {
  this.timeout(30000); // 30 seconds
  // test code
});
```

### Debug Logging

Enable debug logging in tests:

```typescript
import { createCapturingLogger } from '../utils/testHelpers';

const logger = createCapturingLogger();
// logger.logs will contain all logged messages
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Compile TypeScript
        run: npm run compile
      
      - name: Run tests
        run: npm test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Additional Resources

- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [Mocha Documentation](https://mochajs.org/)
- [Chai Assertion Library](https://www.chaijs.com/)
- [Sinon Mocking](https://sinonjs.org/)
- [Istanbul/nyc Coverage](https://istanbul.js.org/)
