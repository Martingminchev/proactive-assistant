# Testing Infrastructure

This directory contains the comprehensive testing infrastructure for the Proactive AI Assistant VS Code extension.

## Structure

```
src/test/
├── README.md               # This file
├── runTest.ts              # VS Code test runner entry point
├── suite/                  # Test suites
│   ├── index.ts            # Mocha configuration
│   ├── piecesClient.test.ts
│   ├── activityMonitor.test.ts
│   ├── interruptionManager.test.ts
│   ├── suggestionEngine.test.ts
│   ├── storageManager.test.ts
│   ├── extension.test.ts
│   └── commands.test.ts
├── utils/
│   └── testHelpers.ts      # Test utilities and helpers
├── mocks/
│   ├── vscode.ts           # VS Code API mocks
│   └── piecesResponses.ts  # Mock Pieces OS API responses
└── scripts/
    ├── runTests.sh         # Linux/Mac test runner
    └── runTests.ps1        # Windows test runner
```

## Quick Start

```bash
# Install dependencies (from extension root)
npm install

# Compile TypeScript
npm run compile

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Or use the platform-specific scripts
cd src/test/scripts
./runTests.sh        # Linux/Mac
.\runTests.ps1       # Windows
```

## Test Coverage

| Metric | Minimum | Current |
|--------|---------|---------|
| Statements | 80% | TBD |
| Branches | 80% | TBD |
| Functions | 80% | TBD |
| Lines | 80% | TBD |

## Test Files

### Unit Tests

- **piecesClient.test.ts** - Port discovery (1000, 39300, 5323), API methods, retry logic, error handling
- **activityMonitor.test.ts** - Typing velocity, flow state detection, error tracking, idle detection
- **interruptionManager.test.ts** - 30-minute rule, 3-strike dismissal, focus mode, quiet hours
- **suggestionEngine.test.ts** - Suggestion generation, template rendering, fix application
- **storageManager.test.ts** - CRUD operations, persistence, change listeners

### Integration Tests

- **extension.test.ts** - Activation, command registration, service initialization
- **commands.test.ts** - Command execution, keyboard shortcuts

## Mock Data

### VS Code Mocks (`mocks/vscode.ts`)

- Complete mock of VS Code API
- Mock TextEditor, TextDocument, Range, Position, Selection
- Mock workspace, window, commands, languages namespaces

### Pieces OS Mocks (`mocks/piecesResponses.ts`)

- Mock workstream summaries
- Mock vision events
- Mock conversations
- Mock copilot responses
- Mock health check responses
- Mock error responses

## Test Helpers (`utils/testHelpers.ts`)

### Mock Creation
- `createMockExtensionContext()` - Mock VS Code extension context
- `createMockTextEditor()` - Mock text editor
- `createMockLogger()` - Mock logger
- `createMockActivityContext()` - Mock activity context
- `createMockSuggestion()` - Mock suggestion

### Simulation Helpers
- `simulateTyping(editor, text, delayMs)` - Simulate typing
- `simulateError(editor, message, line)` - Add diagnostic
- `waitFor(ms)` - Async delay
- `waitForCondition(condition, timeoutMs)` - Wait for condition

### Data Generators
- `generateTypingSequence()` - Generate typing events
- `createFlowStateSequence()` - Create state transitions

## Writing Tests

See `docs/TESTING.md` for detailed guide on writing tests.

Example:

```typescript
import * as assert from 'assert';
import { ActivityMonitor } from '../../services/activityMonitor';
import { createMockExtensionContext, createMockLogger } from '../utils/testHelpers';

describe('ActivityMonitor', () => {
  let monitor: ActivityMonitor;
  let mockContext: ReturnType<typeof createMockExtensionContext>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockContext = createMockExtensionContext();
    mockLogger = createMockLogger();
    monitor = new ActivityMonitor(mockContext, mockLogger);
  });

  afterEach(() => {
    monitor.dispose();
  });

  it('should detect idle state after no activity', () => {
    (monitor as any).typingMetrics.lastActivityTime = Date.now() - 6 * 60 * 1000;
    const newState = (monitor as any).calculateFlowState();
    assert.strictEqual(newState, 'idle');
  });
});
```

## CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run compile
      - run: npm test
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Troubleshooting

1. **Tests fail to start**: Ensure TypeScript is compiled (`npm run compile`)
2. **Coverage issues**: Check `.nycrc.json` configuration
3. **VS Code errors**: Tests run in a special VS Code instance
4. **Timeouts**: Increase timeout in `suite/index.ts` if needed

## Documentation

- Full testing guide: `docs/TESTING.md`
- Architecture: `ARCHITECTURE.md`
- API documentation: Generated from JSDoc comments
