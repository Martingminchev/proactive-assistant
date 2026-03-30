# GitHub Infrastructure Setup

This document summarizes the GitHub infrastructure created for the Proactive AI Assistant VS Code extension.

## Overview

A complete, professional-grade GitHub infrastructure has been set up to enable open-source collaboration, automated testing, and streamlined releases.

## Files Created

### GitHub Actions Workflows (`.github/workflows/`)

| File | Purpose | Triggers |
|------|---------|----------|
| `ci.yml` | Continuous Integration - lint, test, build, package | Push/PR to main/develop |
| `release.yml` | Automated releases with marketplace publishing | Git tags (v*) |
| `nightly.yml` | Nightly tests with VS Code Insiders | Daily at 2 AM UTC |
| `docs.yml` | Documentation deployment to GitHub Pages | Changes to docs/ |
| `security.yml` | CodeQL analysis, dependency scanning, secret detection | Push/PR + weekly |
| `sync-labels.yml` | Sync label definitions from labels.yml | Changes to labels.yml |

### Issue Templates (`.github/ISSUE_TEMPLATE/`)

| File | Purpose |
|------|---------|
| `bug_report.yml` | Structured bug report form with environment fields |
| `feature_request.yml` | Feature request form with use case sections |
| `question.yml` | Question/support template |
| `config.yml` | Issue template configuration with external links |

### Repository Configuration (`.github/`)

| File | Purpose |
|------|---------|
| `CODEOWNERS` | Code ownership for automatic review assignment |
| `dependabot.yml` | Automated dependency update configuration |
| `labels.yml` | Standardized label definitions |
| `pull_request_template.md` | PR template with checklist |

### Packaging Scripts (`scripts/`)

| File | Purpose |
|------|---------|
| `package.sh` | Bash script for building VSIX (Linux/macOS) |
| `package.ps1` | PowerShell script for building VSIX (Windows) |
| `publish.sh` | Script for publishing to marketplaces |

### Documentation (`docs/`)

| File | Purpose |
|------|---------|
| `RELEASE_PROCESS.md` | Complete release process documentation |
| `DEVELOPMENT.md` | Developer setup and workflow guide |

### Other Files

| File | Purpose |
|------|---------|
| `vscode-proactive-assistant/.vscodeignore` | Files to exclude from VSIX package |
| `CHANGELOG.md` | Project changelog template |
| `CONTRIBUTING.md` | Contribution guidelines |
| `LICENSE` | MIT License file |

## Package.json Scripts Added

```json
{
  "lint:fix": "eslint src --ext ts --fix",
  "format": "prettier --write \"src/**/*.ts\"",
  "format:check": "prettier --check \"src/**/*.ts\"",
  "test:coverage": "nyc npm test",
  "package": "vsce package --no-dependencies",
  "package:pre": "vsce package --pre-release --no-dependencies",
  "publish:pre": "vsce publish --pre-release",
  "publish:ovsx": "ovsx publish",
  "clean": "rimraf out",
  "clean:all": "rimraf out node_modules",
  "rebuild": "npm run clean && npm install && npm run compile",
  "verify": "npm run lint && npm run compile && npm test"
}
```

## Required GitHub Secrets

To use the full CI/CD pipeline, add these secrets in your GitHub repository:

| Secret | Purpose | How to Get |
|--------|---------|------------|
| `VSCE_PAT` | VS Code Marketplace publishing | [Azure DevOps](https://dev.azure.com/) |
| `OVSX_PAT` | Open VSX Registry publishing | [Open VSX](https://open-vsx.org/) |
| `SNYK_TOKEN` | Security scanning (optional) | [Snyk](https://snyk.io/) |

## Features Implemented

### CI/CD Pipeline
- ✅ Multi-OS testing (Ubuntu, Windows, macOS)
- ✅ Multi-Node version support (18, 20)
- ✅ Caching for faster builds
- ✅ Concurrency control to cancel outdated runs
- ✅ Artifact upload and retention
- ✅ Automated VSIX packaging

### Release Automation
- ✅ Automatic version bumping from git tags
- ✅ Changelog generation from commits
- ✅ GitHub Release creation with VSIX
- ✅ Marketplace publishing (VS Code + Open VSX)
- ✅ Pre-release support (alpha, beta, rc)

### Security
- ✅ CodeQL analysis for TypeScript
- ✅ Dependency vulnerability scanning
- ✅ Secret detection with TruffleHog
- ✅ Snyk integration (optional)

### Community
- ✅ Structured issue templates
- ✅ Pull request template with checklist
- ✅ CODEOWNERS for review assignment
- ✅ Dependabot for automated updates
- ✅ Standardized labels
- ✅ Contribution guidelines

### Documentation
- ✅ Release process documentation
- ✅ Development setup guide
- ✅ Changelog template
- ✅ MIT License

## Usage

### Creating a Release

```bash
# Create and push a tag
git tag -a v0.2.0 -m "Release version 0.2.0"
git push origin v0.2.0

# The CI will automatically:
# - Run tests
# - Build the extension
# - Create a GitHub Release
# - Publish to marketplaces
```

### Local Packaging

```bash
# Using the provided script
./scripts/package.sh 0.2.0

# Or manually
cd vscode-proactive-assistant
npm run package
```

### Running Tests

```bash
cd vscode-proactive-assistant
npm run verify    # Lint, compile, and test
```

## Next Steps

1. **Update CODEOWNERS**: Replace placeholder usernames with actual team members
2. **Add GitHub Secrets**: Add VSCE_PAT and OVSX_PAT for marketplace publishing
3. **Customize Issue Templates**: Update URLs in config.yml to point to your actual repository
4. **Update README**: Add badges for CI status, version, etc.
5. **Enable GitHub Pages**: If you want to use the docs deployment

## Badges for README.md

Add these badges to your README.md:

```markdown
![CI](https://github.com/YOUR_ORG/proactive-ai-assistant/workflows/CI/badge.svg)
![Security](https://github.com/YOUR_ORG/proactive-ai-assistant/workflows/Security/badge.svg)
![Version](https://img.shields.io/visual-studio-marketplace/v/proactive-assistant.proactive-ai-assistant)
![Installs](https://img.shields.io/visual-studio-marketplace/i/proactive-assistant.proactive-ai-assistant)
![License](https://img.shields.io/github/license/YOUR_ORG/proactive-ai-assistant)
```

## Support

For questions about the GitHub infrastructure, see:
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [VS Code Extension Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
