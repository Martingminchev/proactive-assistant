# Changelog

All notable changes to the "Proactive AI Assistant" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Initial release of Proactive AI Assistant
- Pieces OS integration for intelligent workflow assistance
- Activity tracking with privacy-first local processing
- Smart interruption system with confidence scoring
- Seven suggestion categories: stuck, error_fix, wellness, celebration, context_recovery, productivity, learning
- Focus mode for deep work sessions
- Quiet hours configuration (customizable time ranges)
- VS Code panel integration with dedicated sidebar view
- Configurable suggestion thresholds (0.0 - 1.0)
- Keyboard shortcuts for common actions
- Activity statistics and insights
- Snooze functionality with customizable duration
- Dismissal reason tracking for ML improvement
- Multiple suggestion templates per category
- Tone customization (formal, casual, enthusiastic)
- Type-aware suggestion generation
- Real-time Pieces OS connectivity monitoring

### Changed
- N/A (initial release)

### Deprecated
- N/A (initial release)

### Removed
- N/A (initial release)

### Fixed
- N/A (initial release)

### Security
- All data processing happens locally via Pieces OS
- No cloud API calls or data transmission
- Extension storage uses VS Code's secure storage API

---

## [0.1.0] - 2024-01-29

### Added
- 🎉 **Initial beta release**
- Core proactive suggestion engine with flow state detection
- Basic Pieces OS connectivity and status monitoring
- Activity monitoring and context analysis
- Focus mode with configurable suppression rules
- Settings and configuration UI through VS Code preferences
- Command palette integration (11 commands)
- Status bar indicator for assistant state
- Output channel logging with 4 verbosity levels
- Webview panel for detailed suggestions
- Keyboard shortcut bindings for power users
- Welcome page for first-time users
- Snooze and dismiss actions on suggestions
- Error detection and fix suggestions

### Technical
- TypeScript 5.x with strict mode
- VS Code Extension API 1.74+
- WebSocket communication for Pieces OS
- Service-oriented architecture
- Disposable pattern for resource management
- Event-driven flow state changes
- Result type for error handling

---

## Release Notes Template

When adding a new release, use this format:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes to existing functionality

### Deprecated
- Soon-to-be removed features

### Removed
- Now removed features

### Fixed
- Bug fixes

### Security
- Security fixes
```

---

## Version History Legend

| Symbol | Meaning |
|--------|---------|
| 🎉 | Major release |
| ✨ | New feature |
| 🐛 | Bug fix |
| 🔧 | Improvement |
| 📖 | Documentation |
| ⚡ | Performance |
| 🔒 | Security |

---

## Upcoming Roadmap

### [0.2.0] - Planned
- Custom suggestion templates
- Export/import settings
- Additional keyboard shortcuts
- Improved activity visualization

### [0.3.0] - Planned
- Machine learning-based suggestion ranking
- Integration with more AI providers
- Team/collaboration features
- Advanced statistics dashboard

### [1.0.0] - Planned
- Stable API
- Full documentation
- Multi-language support
- Community template marketplace

---

For the complete list of changes, see the [commit history](https://github.com/example/proactive-ai-assistant/commits/main).
