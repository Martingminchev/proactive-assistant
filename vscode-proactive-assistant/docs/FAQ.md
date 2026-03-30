# Frequently Asked Questions

Common questions about the Proactive AI Assistant.

---

## General Questions

### What is Proactive AI Assistant?

Proactive AI Assistant is a VS Code extension that monitors your coding workflow and provides contextual suggestions at the right moment. It detects when you're stuck, idle, or might need help, then offers relevant assistance powered by Pieces OS.

### How is this different from other AI assistants?

Unlike reactive assistants that wait for you to ask questions, Proactive AI Assistant:
- **Watches your workflow** and detects patterns
- **Interrupts intelligently** only when truly helpful
- **Uses local AI** via Pieces OS (no cloud data sharing)
- **Respects your focus** with configurable quiet hours and focus mode

### Is my code safe?

**Yes.** All processing happens locally:
- Your code never leaves your machine
- Pieces OS runs locally on your computer
- No data is sent to external AI services
- Extension storage is local only

### Does it work offline?

**Partially.** Template-based suggestions work offline. AI-powered suggestions require Pieces OS to be running (which works offline once installed).

---

## Installation & Setup

### What are the requirements?

- VS Code 1.74 or higher
- Pieces OS installed and running
- Windows 10/11, macOS 10.15+, or Linux

### How do I install Pieces OS?

1. Visit [pieces.app](https://pieces.app)
2. Download for your platform
3. Run the installer
4. Launch Pieces OS (it runs in the background)

### Can I use this without Pieces OS?

Yes, but with limited functionality. You'll get:
- ✅ Template-based suggestions
- ✅ Activity tracking
- ✅ Basic flow detection
- ❌ AI-powered context analysis
- ❌ Advanced code suggestions

### How do I update the extension?

Updates are automatic through VS Code:
1. Extensions view shows update indicator
2. Click **Update**
3. Reload VS Code

Or use the CLI:
```bash
code --install-extension proactive-assistant.proactive-ai-assistant
```

---

## Usage Questions

### How do suggestions appear?

Suggestions appear as notifications in VS Code when the extension detects:
- You're stuck on an error
- You've been working for extended periods
- You might benefit from a tip
- You've achieved something worth celebrating

### Can I control when suggestions appear?

**Yes!** Several ways:
1. **Focus Mode**: Suppress non-urgent suggestions (`Ctrl+Shift+F`)
2. **Quiet Hours**: Set times when no suggestions appear
3. **Threshold**: Adjust how confident the AI needs to be
4. **Snooze**: Temporarily pause all suggestions

### What is Focus Mode?

Focus Mode suppresses non-critical suggestions so you can work without interruption. Only urgent items like error fixes will appear.

Enable with:
- Keyboard: `Ctrl+Shift+F` / `Cmd+Shift+F`
- Status bar: Click the 💡 icon
- Command: "Toggle Focus Mode"

### How do I snooze suggestions?

When a suggestion appears:
1. Click the **Snooze** button
2. Or use Command Palette → "Snooze Suggestions"

Default snooze duration is 30 minutes (configurable).

### What are Quiet Hours?

Quiet Hours let you specify times when you don't want any interruptions (e.g., during sleep).

Configure in settings:
```json
{
  "proactiveAssistant.quietHours.enabled": true,
  "proactiveAssistant.quietHours.start": "22:00",
  "proactiveAssistant.quietHours.end": "08:00"
}
```

---

## Suggestion Questions

### What types of suggestions will I get?

| Type | When | Example |
|------|------|---------|
| **Error Fix** | Errors detected | "Fix: Type mismatch on line 42" |
| **Stuck Help** | Struggling | "Search for solutions?" |
| **Wellness** | Extended work | "Time for a break?" |
| **Celebration** | Achievements | "🔥 3-day streak!" |
| **Context Recovery** | Return from break | "Continue where you left off?" |
| **Productivity** | Optimization | "Create a snippet from this code?" |
| **Learning** | Educational | "Did you know? VS Code tip..." |

### Why am I not getting suggestions?

Check:
1. Extension is enabled in settings
2. Not in Focus Mode
3. Not in Quiet Hours
4. Activity tracking is enabled
5. Try lowering `interruptionThreshold` (default: 0.7)

### Why am I getting too many suggestions?

Increase the threshold in settings:
```json
{
  "proactiveAssistant.interruptionThreshold": 0.85
}
```

Higher values = fewer, more confident suggestions.

### Can I disable specific suggestion types?

Not yet, but this feature is planned. Currently, you can:
- Use Focus Mode to suppress non-urgent types
- Adjust the overall threshold
- Snooze when needed

### What does "confidence" mean?

Confidence (0-1) indicates how certain the AI is that a suggestion is relevant. The `interruptionThreshold` setting controls the minimum confidence required to show a suggestion.

---

## Configuration Questions

### Where are settings located?

VS Code Settings → Search for "Proactive Assistant"

Or edit `settings.json` directly:
```json
{
  "proactiveAssistant.enabled": true,
  "proactiveAssistant.interruptionThreshold": 0.7
}
```

### What's the best threshold setting?

- **0.3-0.5**: Frequent suggestions (exploratory)
- **0.6-0.8**: Balanced (recommended)
- **0.9+**: Rare, high-confidence only (minimal interruptions)

Start with 0.7 and adjust based on your preference.

### How do I reset all settings?

Remove all `proactiveAssistant.*` entries from settings.json, or set:
```json
{
  "proactiveAssistant.enabled": true,
  "proactiveAssistant.focusMode": false,
  "proactiveAssistant.interruptionThreshold": 0.7,
  "proactiveAssistant.quietHours.enabled": false,
  "proactiveAssistant.activityTracking.enabled": true
}
```

### Can I have different settings per workspace?

Yes! Add settings to `.vscode/settings.json` in your project:
```json
{
  "proactiveAssistant.interruptionThreshold": 0.9
}
```

---

## Privacy & Security

### Is my code sent to the cloud?

**No.** All processing is local:
- Code analysis happens on your machine
- Pieces OS runs locally
- No external API calls with your code

### What data is collected?

Only local data:
- Activity patterns (file switches, typing, etc.)
- Flow state transitions
- Suggestion acceptance/dismissal rates

All stored locally in VS Code's storage.

### Can I disable activity tracking?

Yes:
```json
{
  "proactiveAssistant.activityTracking.enabled": false
}
```

Note: This reduces the quality of suggestions.

### Who can see my data?

Only you. The data never leaves your machine.

---

## Troubleshooting

### Extension won't activate

1. Check VS Code version (need 1.74+)
2. Verify Pieces OS is running
3. Reload VS Code window
4. Check Output panel for errors

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for more.

### Pieces OS won't connect

1. Verify Pieces OS is running
2. Check port 5323 is available
3. Restart Pieces OS
4. Check firewall settings

### Suggestions are annoying

1. Increase `interruptionThreshold` to 0.8 or 0.9
2. Enable Focus Mode during deep work
3. Set Quiet Hours for your off times
4. Enable snooze when needed

---

## Feature Questions

### Can I create custom suggestions?

Not yet, but custom templates are planned for a future release.

### Will this work with my programming language?

Yes! The extension is language-agnostic. It monitors:
- File changes
- Editor activity
- Error patterns (via diagnostics)

Not specific syntax.

### Can I export my activity data?

Not currently, but data export is on the roadmap.

### Is there a dark mode?

The extension automatically follows VS Code's theme.

---

## Contributing

### How can I contribute?

See [CONTRIBUTING.md](../CONTRIBUTING.md) for:
- Bug reports
- Feature requests
- Code contributions
- Documentation improvements

### Where is the source code?

[GitHub Repository](https://github.com/example/proactive-ai-assistant)

### How do I report a bug?

1. Check [existing issues](https://github.com/example/proactive-ai-assistant/issues)
2. Create a new issue with:
   - VS Code version
   - Extension version
   - Steps to reproduce
   - Expected vs actual behavior

---

## Roadmap

### Coming Soon

- Custom suggestion templates
- Data export
- Team features
- More AI providers
- Custom thresholds per suggestion type

### Planned

- Machine learning-based ranking
- Voice notifications
- Mobile companion app
- IDE integrations (JetBrains, etc.)

---

## Still Have Questions?

- 📖 Check the [full documentation](.)
- 🐛 Report issues on [GitHub](https://github.com/example/proactive-ai-assistant/issues)
- 💡 Suggest features via GitHub Discussions

---

**Last Updated:** January 2024
