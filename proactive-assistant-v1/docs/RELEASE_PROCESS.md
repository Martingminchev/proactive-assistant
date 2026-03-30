# Release Process

This document describes how to create and publish releases for the Proactive AI Assistant VS Code extension.

## Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.y.z): Breaking changes that require user action
- **MINOR** (x.Y.z): New features, backwards compatible
- **PATCH** (x.y.Z): Bug fixes, backwards compatible

### Pre-release Versions

- `-alpha`: Early testing versions
- `-beta`: Feature-complete but testing needed
- `-rc`: Release candidate, final testing

Example: `1.2.0-beta.1`

## Release Checklist

Before creating a release, ensure:

- [ ] All tests pass on CI
- [ ] CHANGELOG.md is updated with all changes
- [ ] Documentation is updated (README.md, docs/)
- [ ] Version in `package.json` is updated (or will be updated by CI)
- [ ] No breaking changes without proper deprecation warnings

## Creating a Release

### Automated Release (Recommended)

1. **Create and push a git tag:**

   ```bash
   git checkout main
   git pull origin main
   git tag -a v0.2.0 -m "Release version 0.2.0"
   git push origin v0.2.0
   ```

2. **The CI/CD pipeline will automatically:**
   - Run the full test suite
   - Update version in package.json
   - Generate changelog from git commits
   - Build and package the VSIX
   - Create a GitHub Release with the VSIX attached
   - Publish to VS Code Marketplace (if not a pre-release)
   - Publish to Open VSX Registry (if not a pre-release)

### Manual Release (Not Recommended)

If you need to release manually:

1. **Run the packaging script:**

   ```bash
   ./scripts/package.sh 0.2.0
   ```

2. **Test the VSIX locally:**

   ```bash
   code --install-extension proactive-ai-assistant-0.2.0.vsix
   ```

3. **Publish to marketplace:**

   ```bash
   export VSCE_PAT=your_token_here
   ./scripts/publish.sh marketplace
   ```

## Changelog Guidelines

### Format

```markdown
## [0.2.0] - 2024-01-15

### Added
- New feature description
- Another new feature

### Changed
- Change description

### Deprecated
- Feature that will be removed

### Removed
- Feature that was removed

### Fixed
- Bug fix description

### Security
- Security fix description
```

### Categories

- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Now removed features
- **Fixed**: Bug fixes
- **Security**: Security-related changes

## Post-Release Checklist

After a release is published:

- [ ] Verify the extension is available on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=proactive-assistant.proactive-ai-assistant)
- [ ] Verify the extension is available on [Open VSX](https://open-vsx.org/extension/proactive-assistant/proactive-ai-assistant)
- [ ] Test installing the extension from the marketplace
- [ ] Update the GitHub Release notes if needed
- [ ] Announce the release (if significant)
- [ ] Create a milestone for the next release
- [ ] Close the released milestone

## Hotfix Releases

For critical bug fixes:

1. Create a hotfix branch from the release tag:

   ```bash
   git checkout -b hotfix/v0.2.1 v0.2.0
   ```

2. Make the fix and commit

3. Update version and changelog

4. Create a new tag and push:

   ```bash
   git tag -a v0.2.1 -m "Hotfix release 0.2.1"
   git push origin v0.2.1
   ```

## Rolling Back a Release

If a release needs to be rolled back:

1. **Unpublish from marketplace** (within 72 hours):

   ```bash
   npx @vscode/vsce unpublish proactive-assistant.proactive-ai-assistant
   ```

2. **Create a GitHub issue** explaining the rollback

3. **Fix the issue and release a new version**

## Marketplace Access

### VS Code Marketplace

1. Create a publisher account at [https://marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage)
2. Get a Personal Access Token from [Azure DevOps](https://dev.azure.com/)
3. Add the token as `VSCE_PAT` in GitHub repository secrets

### Open VSX Registry

1. Create an account at [https://open-vsx.org/](https://open-vsx.org/)
2. Create an access token
3. Add the token as `OVSX_PAT` in GitHub repository secrets

## Troubleshooting

### Common Issues

**"Version already exists"**

- Increment the version number in package.json

**"Invalid vsce token"**

- Verify the VSCE_PAT secret is set correctly
- The token may have expired; create a new one

**"Tests fail during release"**

- Check that all tests pass locally
- Verify the test environment has the required dependencies

**"Changelog not generated"**

- Ensure git tags exist and follow the `v*` pattern
- Check that the repository has a proper git history

## Related Documentation

- [VS Code Extension Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Open VSX Publishing](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions)
- [Semantic Versioning](https://semver.org/)
