# Development Guide

Welcome to the Proactive AI Assistant development team! This guide will help you set up your development environment and contribute to the project.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setting Up Development Environment](#setting-up-development-environment)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Commit Message Conventions](#commit-message-conventions)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or higher
- [npm](https://www.npmjs.com/) 8 or higher
- [VS Code](https://code.visualstudio.com/) 1.74.0 or higher
- [Git](https://git-scm.com/)

## Setting Up Development Environment

### 1. Fork and Clone the Repository

```bash
# Fork the repository on GitHub first, then clone your fork
git clone https://github.com/YOUR_USERNAME/proactive-ai-assistant.git
cd proactive-ai-assistant
```

### 2. Install Dependencies

```bash
cd vscode-proactive-assistant
npm install
```

### 3. Open in VS Code

```bash
code .
```

### 4. Run the Extension

Press `F5` to open a new VS Code window with the extension loaded.

## Project Structure

```
vscode-proactive-assistant/
├── src/
│   ├── commands/       # Command implementations
│   ├── services/       # Core services (Pieces OS, activity tracking, etc.)
│   ├── types/          # TypeScript type definitions
│   ├── ui/             # UI components and webview
│   ├── utils/          # Utility functions
│   └── extension.ts    # Extension entry point
├── test/               # Test files
├── resources/          # Icons, images, and other assets
├── webview/            # Webview UI code (if separate)
├── out/                # Compiled JavaScript (generated)
├── package.json        # Extension manifest
└── tsconfig.json       # TypeScript configuration
```

## Development Workflow

We follow the [GitHub Flow](https://docs.github.com/en/get-started/quickstart/github-flow) branching strategy.

### Creating a Branch

```bash
# Update main branch
git checkout main
git pull origin main

# Create a feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### Branch Naming Conventions

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions/improvements
- `chore/description` - Maintenance tasks

### Making Changes

1. Make your changes in the appropriate files
2. Write or update tests as needed
3. Update documentation if needed
4. Run linting and tests locally

### Before Committing

```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Compile TypeScript
npm run compile

# Run tests
npm test
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

Tests are located in the `test/` directory. We use the VS Code Test framework.

Example test structure:

```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    test('Sample test', () => {
        assert.strictEqual([1, 2, 3].indexOf(5), -1);
    });
});
```

### Manual Testing

1. Press `F5` to launch the extension
2. Test your changes in the new VS Code window
3. Check the Debug Console for logs

## Commit Message Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation only changes
- **style**: Code style changes (formatting, semicolons, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Build process or auxiliary tool changes

### Examples

```bash
feat(suggestions): add confidence scoring for interruptions

fix(pieces): handle connection timeout gracefully

docs(readme): update installation instructions

refactor(tracking): simplify activity event handling

test(services): add unit tests for pieces client
```

### Scopes

Common scopes for this project:

- `extension` - Extension lifecycle
- `commands` - Command implementations
- `services` - Core services
- `ui` - User interface components
- `webview` - Webview-related code
- `pieces` - Pieces OS integration
- `tracking` - Activity tracking
- `settings` - Configuration/settings
- `docs` - Documentation

## Pull Request Process

### Before Creating a PR

1. Ensure all tests pass
2. Run linting and fix any issues
3. Update documentation if needed
4. Update CHANGELOG.md if user-facing changes
5. Rebase on the latest main branch

### Creating a PR

1. Push your branch to your fork
2. Create a PR against the `main` branch of the original repository
3. Fill out the PR template completely
4. Link any related issues

### PR Review Process

1. Automated checks must pass (CI, linting)
2. At least one maintainer approval is required
3. Address any review comments
4. Once approved, a maintainer will merge

### After Merge

- Delete your feature branch
- Pull the latest changes to your local main branch

## Code Style

### TypeScript Guidelines

- Use TypeScript strict mode
- Add type annotations for function parameters and return types
- Use interfaces for object shapes
- Avoid `any` type when possible

### Formatting

We use Prettier for formatting:

```bash
# Check formatting
npx prettier --check "src/**/*.ts"

# Fix formatting
npx prettier --write "src/**/*.ts"
```

### Linting

We use ESLint:

```bash
# Check for linting issues
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

### VS Code Settings

Recommended workspace settings (`.vscode/settings.json`):

```json
{
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.codeActionsOnSave": {
        "source.fixAll.eslint": "explicit"
    },
    "typescript.preferences.importModuleSpecifier": "relative"
}
```

## Debugging

### Extension Debugging

1. Set breakpoints in your code
2. Press `F5` to launch the extension
3. Interact with the extension
4. Execution will pause at breakpoints

### Debug Console

Use `console.log()` or VS Code's output channels for debugging:

```typescript
const channel = vscode.window.createOutputChannel('Proactive Assistant');
channel.appendLine('Debug message');
channel.show();
```

### Settings for Debugging

Add to your settings while debugging:

```json
{
    "proactiveAssistant.logging.level": "debug"
}
```

## Getting Help

- Check the [README](../README.md) for basic information
- Review existing [issues](https://github.com/example/proactive-ai-assistant/issues)
- Start a [discussion](https://github.com/example/proactive-ai-assistant/discussions)
- Join our community chat (if available)

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Pieces OS SDK Documentation](https://docs.pieces.app/)
