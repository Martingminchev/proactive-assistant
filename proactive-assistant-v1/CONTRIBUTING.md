# Contributing to Proactive AI Assistant

Thank you for your interest in contributing to the Proactive AI Assistant! This document provides guidelines and information for contributors.

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to:

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Respect different viewpoints and experiences

## How Can I Contribute?

### Reporting Bugs

Before creating a bug report, please:

1. Check if the issue already exists in the [issue tracker](https://github.com/example/proactive-ai-assistant/issues)
2. Update to the latest version to see if the issue is resolved
3. Collect information about the bug (VS Code version, OS, extension version)

When creating a bug report, please use our [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml).

### Suggesting Features

Feature suggestions are welcome! Please:

1. Check if the feature has already been suggested
2. Provide a clear use case
3. Explain why the feature would be useful

Use our [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml).

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting
5. Commit with a clear message following our conventions
6. Push to your fork
7. Open a Pull Request

## Development Setup

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for detailed setup instructions.

Quick start:

```bash
git clone https://github.com/YOUR_USERNAME/proactive-ai-assistant.git
cd proactive-ai-assistant/vscode-proactive-assistant
npm install
```

## Style Guidelines

### Git Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style (formatting, missing semi colons, etc)
- `refactor:` Code refactoring
- `perf:` Performance improvements
- `test:` Adding or updating tests
- `chore:` Build process or auxiliary tool changes

Example: `feat(suggestions): add confidence threshold slider`

### TypeScript Style Guide

- Use TypeScript strict mode
- Prefer `interface` over `type` for object definitions
- Use meaningful variable names
- Add JSDoc comments for public APIs
- Keep functions focused and small

### Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Aim for good code coverage

## Review Process

1. Automated CI checks must pass
2. At least one maintainer review is required
3. Address any review feedback
4. Maintainers will merge when approved

## Release Process

See [docs/RELEASE_PROCESS.md](docs/RELEASE_PROCESS.md) for details on creating releases.

## Questions?

- Check our [discussions](https://github.com/example/proactive-ai-assistant/discussions)
- Open an issue with the `question` label

## Recognition

Contributors will be recognized in our README.md file and release notes.

Thank you for contributing! 🎉
