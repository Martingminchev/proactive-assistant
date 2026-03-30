# Contributing to Proactive AI Assistant

First off, thank you for considering contributing to Proactive AI Assistant! 🎉 It's people like you that make this extension a great tool for the VS Code community.

---

## 📋 Code of Conduct

This project and everyone participating in it is governed by our commitment to:

- **Be respectful and inclusive** — Treat everyone with respect. Healthy debate is encouraged, but harassment is not tolerated.
- **Welcome newcomers** — Everyone was new once. Help others learn and grow.
- **Focus on constructive feedback** — Criticize ideas, not people. Offer suggestions for improvement.
- **Respect different viewpoints** — Diversity of thought strengthens the project.

---

## 🚀 Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18.x or higher
- [VS Code](https://code.visualstudio.com/) 1.74 or higher
- [Pieces OS](https://pieces.app) installed and running
- Git

### Quick Start

```bash
# 1. Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/proactive-ai-assistant.git
cd proactive-ai-assistant/vscode-proactive-assistant

# 2. Install dependencies
npm install

# 3. Compile TypeScript
npm run compile

# 4. Open in VS Code
code .

# 5. Press F5 to launch Extension Development Host
```

### Development Scripts

| Command | Description |
|---------|-------------|
| `npm run compile` | Compile TypeScript to JavaScript |
| `npm run watch` | Compile in watch mode (auto-rebuild on changes) |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |
| `npm test` | Run test suite |
| `npm run package` | Create VSIX package |

---

## 🌿 Branching Strategy

We use a simplified Git flow:

```
main
  │
  ├── feature/suggestion-templates
  ├── fix/activity-tracking-bug
  ├── docs/update-readme
  └── refactor/panel-provider
```

### Branch Naming Convention

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New features | `feature/focus-mode-improvements` |
| `fix/` | Bug fixes | `fix/memory-leak-panel` |
| `docs/` | Documentation | `docs/api-reference` |
| `refactor/` | Code refactoring | `refactor/suggestion-engine` |
| `test/` | Test additions/changes | `test/interruption-manager` |
| `chore/` | Maintenance tasks | `chore/update-dependencies` |

### Workflow

1. Create a new branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit following [Conventional Commits](#commit-message-format)

3. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

4. Open a Pull Request against `main`

---

## 💬 Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/) for clear commit history and automatic changelog generation.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code style (formatting, semicolons, etc) |
| `refactor` | Code refactoring |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `chore` | Build process or auxiliary tool changes |

### Scopes

Common scopes for this project:

- `suggestions` — Suggestion engine and templates
- `activity` — Activity tracking
- `pieces` — Pieces OS integration
- `panel` — VS Code panel UI
- `commands` — Command implementations
- `config` — Configuration handling
- `utils` — Utility functions

### Examples

```bash
# Feature addition
feat(suggestions): add celebration templates for milestones

# Bug fix
fix(activity): correct flow state detection threshold

# Documentation
docs(readme): update installation instructions

# Breaking change
feat(config): restructure settings layout

BREAKING CHANGE: settings keys have been reorganized
```

---

## 🔍 Pull Request Process

### Before Submitting

1. **Update documentation** if your changes affect usage or configuration
2. **Add tests** for new features or bug fixes
3. **Run the full test suite**:
   ```bash
   npm run verify
   ```
4. **Ensure linting passes**:
   ```bash
   npm run lint
   ```

### PR Template

When opening a PR, please include:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How was this tested?

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests pass
```

### Review Process

1. **Automated checks** must pass (CI, linting, tests)
2. **Code review** from at least one maintainer
3. **Address feedback** promptly and professionally
4. **Maintainer merges** once approved

---

## 🧪 Testing Requirements

### Test Coverage

Aim for good coverage of:

- Core services (suggestion engine, activity monitor)
- Command implementations
- Utility functions

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode during development
npm run test:watch
```

### Writing Tests

```typescript
// Example test structure
describe('SuggestionEngine', () => {
  describe('generateSuggestion', () => {
    it('should generate suggestion for stuck state', () => {
      // Arrange
      const context = createMockContext({ flowState: 'stuck' });
      
      // Act
      const result = engine.generateSuggestion('stuck', context);
      
      // Assert
      expect(result.isOk()).toBe(true);
      expect(result.value.priority).toBe('high');
    });
  });
});
```

---

## 📝 Code Style Guidelines

### TypeScript

- Use **strict mode** TypeScript
- Prefer `interface` over `type` for object definitions
- Use meaningful variable names (`isFocusModeEnabled` vs `flag`)
- Add JSDoc comments for public APIs
- Keep functions focused and small (< 50 lines ideally)

### Example

```typescript
/**
 * Generates a contextual suggestion based on current flow state
 * @param context - Current activity and flow context
 * @returns Result containing suggestion or error
 */
export function generateForFlowState(
  context: SuggestionContext
): Result<Suggestion> {
  const type = selectSuggestionType(context);
  return generateSuggestion(type, context);
}
```

### Formatting

We use Prettier with the following key settings:

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

---

## 🎯 Areas for Contribution

### Good First Issues

Look for issues labeled `good first issue` or `help wanted`:

- Documentation improvements
- Additional suggestion templates
- Test coverage
- Translation support

### Feature Requests

Before implementing a major feature:

1. Open an issue to discuss the proposal
2. Wait for maintainer feedback
3. Reference the issue in your PR

### Bug Reports

When reporting bugs, please include:

- VS Code version
- Extension version
- Pieces OS version
- Steps to reproduce
- Expected vs actual behavior
- Relevant log output

---

## 🏆 Recognition

Contributors will be:

- Listed in the README.md contributors section
- Mentioned in release notes for significant contributions
- Added to the project's hall of fame (coming soon!)

---

## 📞 Getting Help

- **GitHub Discussions**: For questions and ideas
- **GitHub Issues**: For bug reports and feature requests
- **Discord**: [Join our community](https://discord.gg/example) (coming soon!)

---

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for helping make Proactive AI Assistant better! 🚀
