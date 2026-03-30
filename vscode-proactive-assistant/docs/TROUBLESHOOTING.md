# Troubleshooting Guide

Solutions to common issues with the Proactive AI Assistant.

---

## 🔍 Quick Diagnostic

### Check Extension Status

1. Open the Command Palette (`Ctrl+Shift+P`)
2. Run: **"Proactive Assistant: Show Extension Logs"**
3. Review recent log entries

### Status Bar Indicator

| Icon | Meaning | Action |
|------|---------|--------|
| 💡 | Active and working | None needed |
| 🔕 | Focus mode enabled | Toggle with `Ctrl+Shift+F` |
| 😴 | Snoozed | Wait or disable snooze |
| ⚠️ | Error state | Check logs |
| ❌ | Disabled | Enable in settings |

---

## 🚨 Common Issues

### Issue: Extension Not Activating

**Symptoms:**
- Status bar icon not visible
- Commands not found
- No suggestions appearing

**Solutions:**

1. **Verify Installation**
   ```bash
   # Check if extension is installed
   code --list-extensions | grep proactive
   
   # Should output: proactive-assistant.proactive-ai-assistant
   ```

2. **Check VS Code Version**
   - Required: VS Code 1.74 or higher
   - Check: Help → About

3. **Reload Window**
   ```
   Command Palette → "Developer: Reload Window"
   ```

4. **Check Extension Logs**
   ```
   Output Panel → "Proactive AI Assistant"
   ```

---

### Issue: No Suggestions Appearing

**Symptoms:**
- Extension appears active
- No suggestions shown after extended use
- Status bar shows 💡 but nothing happens

**Solutions:**

1. **Check Configuration**
   ```json
   {
     "proactiveAssistant.enabled": true,
     "proactiveAssistant.interruptionThreshold": 0.5
   }
   ```

2. **Disable Focus Mode**
   ```
   Command Palette → "Proactive Assistant: Toggle Focus Mode"
   ```

3. **Check Quiet Hours**
   ```json
   // If quiet hours are active, suggestions are suppressed
   {
     "proactiveAssistant.quietHours.enabled": false
   }
   ```

4. **Check Activity Tracking**
   ```json
   {
     "proactiveAssistant.activityTracking.enabled": true
   }
   ```

5. **Lower Threshold Temporarily**
   ```json
   {
     "proactiveAssistant.interruptionThreshold": 0.3
   }
   ```

---

### Issue: Pieces OS Connection Failed

**Symptoms:**
- Logs show "Failed to connect to Pieces OS"
- No AI-powered suggestions
- Status shows connection error

**Solutions:**

1. **Verify Pieces OS is Running**
   - Windows: Check system tray for Pieces icon
   - macOS: Check menu bar
   - Linux: Run `ps aux | grep pieces`

2. **Check Port Availability**
   ```bash
   # Windows
   netstat -an | findstr 5323
   
   # macOS/Linux
   lsof -i :5323
   ```

3. **Verify Configuration**
   ```json
   {
     "proactiveAssistant.piecesOs.enabled": true,
     "proactiveAssistant.piecesOs.host": "localhost",
     "proactiveAssistant.piecesOs.port": 5323
   }
   ```

4. **Restart Pieces OS**
   - Quit Pieces OS completely
   - Restart it
   - Reload VS Code window

5. **Check Firewall**
   - Ensure port 5323 is not blocked
   - Allow Pieces OS through firewall

---

### Issue: High CPU Usage

**Symptoms:**
- VS Code consuming excessive CPU
- Fan running constantly
- System sluggish

**Solutions:**

1. **Increase Sampling Interval**
   ```json
   {
     "proactiveAssistant.activityTracking.sampleInterval": 10000
   }
   ```

2. **Disable Activity Tracking**
   ```json
   {
     "proactiveAssistant.activityTracking.enabled": false
   }
   ```

3. **Lower Log Level**
   ```json
   {
     "proactiveAssistant.logging.level": "error"
   }
   ```

4. **Check for Error Loops**
   - View logs in Output panel
   - Look for repeated error messages
   - Report if found

---

### Issue: Suggestions Too Frequent

**Symptoms:**
- Constant interruptions
- Too many notifications
- Disrupts workflow

**Solutions:**

1. **Increase Threshold**
   ```json
   {
     "proactiveAssistant.interruptionThreshold": 0.85
   }
   ```

2. **Enable Focus Mode**
   - Press `Ctrl+Shift+F`
   - Or click status bar icon

3. **Set Quiet Hours**
   ```json
   {
     "proactiveAssistant.quietHours.enabled": true,
     "proactiveAssistant.quietHours.start": "09:00",
     "proactiveAssistant.quietHours.end": "17:00"
   }
   ```

4. **Disable Specific Suggestion Types**
   (Coming in future version)

---

### Issue: Extension Crashes VS Code

**Symptoms:**
- VS Code freezes
- Extension host terminates
- Error notifications

**Solutions:**

1. **Check Logs**
   ```
   Help → Toggle Developer Tools → Console
   ```

2. **Disable Other Extensions**
   - Temporarily disable other extensions
   - Check for conflicts

3. **Clear Extension Storage**
   ```
   # Location varies by OS:
   # Windows: %APPDATA%\Code\User\globalStorage\proactive-assistant.proactive-ai-assistant
   # macOS: ~/Library/Application Support/Code/User/globalStorage/...
   # Linux: ~/.config/Code/User/globalStorage/...
   ```

4. **Reinstall Extension**
   - Uninstall the extension
   - Reload VS Code
   - Reinstall

---

## 🐛 Debug Mode

### Enable Debug Logging

```json
{
  "proactiveAssistant.logging.level": "debug"
}
```

Then reload the window to apply.

### View Debug Output

1. Open Output panel (`Ctrl+Shift+U`)
2. Select "Proactive AI Assistant" from dropdown
3. Look for detailed debug messages

### Developer Tools

Open VS Code Developer Tools:
```
Help → Toggle Developer Tools
```

Check:
- **Console**: JavaScript errors
- **Network**: API requests
- **Sources**: Extension code

---

## 📁 Log Locations

### Extension Logs

Access via: Output Panel → "Proactive AI Assistant"

Or find log files:

| OS | Location |
|----|----------|
| Windows | `%APPDATA%\Code\logs\` |
| macOS | `~/Library/Application Support/Code/logs/` |
| Linux | `~/.config/Code/logs/` |

### Pieces OS Logs

Check Pieces OS documentation for log locations.

---

## 🔧 Reset Extension

### Soft Reset

1. Reset settings to defaults:
   ```json
   {
     "proactiveAssistant.enabled": true,
     "proactiveAssistant.focusMode": false,
     "proactiveAssistant.interruptionThreshold": 0.7,
     "proactiveAssistant.quietHours.enabled": false,
     "proactiveAssistant.activityTracking.enabled": true
   }
   ```

2. Reload VS Code window

### Hard Reset

1. Uninstall extension
2. Clear extension storage (see above)
3. Reinstall extension
4. Reconfigure settings

---

## ❓ FAQ

**Q: Why isn't the extension showing any suggestions?**

A: Check:
1. Extension is enabled
2. Not in Focus Mode
3. Not in Quiet Hours
4. Activity tracking is enabled
5. Try lowering the interruption threshold

**Q: Can I use this without Pieces OS?**

A: Yes, but with limited functionality. Template-based suggestions will work, but AI-powered context awareness requires Pieces OS.

**Q: Does this extension send my code to the cloud?**

A: No. All processing happens locally via Pieces OS. No code is sent to external servers.

**Q: How do I completely disable the extension?**

A: Set `"proactiveAssistant.enabled": false` in settings, or uninstall the extension.

**Q: Why is my CPU usage high?**

A: Try increasing the `activityTracking.sampleInterval` or disabling activity tracking.

---

## 🆘 Getting More Help

If issues persist:

1. **Check Existing Issues**
   - [GitHub Issues](https://github.com/example/proactive-ai-assistant/issues)

2. **Create a New Issue**
   Include:
   - VS Code version
   - Extension version
   - OS version
   - Pieces OS version
   - Relevant log output
   - Steps to reproduce

3. **Enable Maximum Logging**
   ```json
   {
     "proactiveAssistant.logging.level": "debug"
   }
   ```
   Then reproduce the issue and share logs.

---

## 📚 Related Documentation

- [Installation Guide](INSTALLATION.md)
- [Configuration Reference](CONFIGURATION.md)
- [FAQ](FAQ.md)
