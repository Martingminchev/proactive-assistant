# Configuration Reference

Complete reference for all Proactive AI Assistant settings.

---

## 🎯 Core Settings

### `proactiveAssistant.enabled`

| | |
|---|---|
| **Type** | `boolean` |
| **Default** | `true` |
| **Scope** | Application |

Enable or disable the Proactive AI Assistant entirely.

```json
{
  "proactiveAssistant.enabled": true
}
```

When disabled:
- Activity tracking stops
- No suggestions are shown
- Status bar indicator is hidden
- Panel shows disabled state

---

### `proactiveAssistant.focusMode`

| | |
|---|---|
| **Type** | `boolean` |
| **Default** | `false` |
| **Scope** | Resource |

When enabled, suppresses non-critical suggestions.

```json
{
  "proactiveAssistant.focusMode": false
}
```

**Allowed in Focus Mode:**
- Error fixes (urgent priority)
- Critical notifications

**Suppressed in Focus Mode:**
- Wellness reminders
- Productivity tips
- Celebrations
- Learning suggestions
- Context recovery

---

### `proactiveAssistant.interruptionThreshold`

| | |
|---|---|
| **Type** | `number` |
| **Default** | `0.7` |
| **Minimum** | `0` |
| **Maximum** | `1` |
| **Scope** | Resource |

Confidence threshold for showing suggestions. Higher values = fewer but more relevant suggestions.

```json
{
  "proactiveAssistant.interruptionThreshold": 0.7
}
```

| Value | Behavior |
|-------|----------|
| `0.3` | Very frequent suggestions |
| `0.5` | Moderate frequency |
| `0.7` | Balanced (default) |
| `0.9` | Rare, high-confidence only |

---

### `proactiveAssistant.snoozeDuration`

| | |
|---|---|
| **Type** | `number` |
| **Default** | `30` |
| **Minimum** | `5` |
| **Maximum** | `240` |
| **Unit** | minutes |
| **Scope** | Resource |

Default duration when snoozing suggestions.

```json
{
  "proactiveAssistant.snoozeDuration": 30
}
```

Quick reference:
- `15` - Short break
- `30` - Standard (default)
- `60` - Hour-long focus session
- `120` - Half day

---

### `proactiveAssistant.askDismissalReason`

| | |
|---|---|
| **Type** | `boolean` |
| **Default** | `true` |
| **Scope** | Resource |

Ask for a reason when dismissing suggestions. Helps improve future recommendations.

```json
{
  "proactiveAssistant.askDismissalReason": true
}
```

**Dismissal reasons:**
- "Not relevant to my work"
- "Bad timing"
- "I already know this"
- "Other"

---

## 🌙 Quiet Hours Settings

### `proactiveAssistant.quietHours.enabled`

| | |
|---|---|
| **Type** | `boolean` |
| **Default** | `false` |
| **Scope** | Resource |

Enable quiet hours to suppress suggestions during specific times.

```json
{
  "proactiveAssistant.quietHours.enabled": true
}
```

---

### `proactiveAssistant.quietHours.start`

| | |
|---|---|
| **Type** | `string` |
| **Default** | `"22:00"` |
| **Pattern** | `^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$` |
| **Scope** | Resource |

Start time for quiet hours in 24-hour format.

```json
{
  "proactiveAssistant.quietHours.start": "22:00"
}
```

Examples:
- `"22:00"` - 10 PM
- `"18:30"` - 6:30 PM
- `"00:00"` - Midnight

---

### `proactiveAssistant.quietHours.end`

| | |
|---|---|
| **Type** | `string` |
| **Default** | `"08:00"` |
| **Pattern** | `^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$` |
| **Scope** | Resource |

End time for quiet hours in 24-hour format.

```json
{
  "proactiveAssistant.quietHours.end": "08:00"
}
```

**Note:** Quiet hours can span midnight (e.g., 22:00 to 08:00).

---

## 🔌 Pieces OS Integration

### `proactiveAssistant.piecesOs.enabled`

| | |
|---|---|
| **Type** | `boolean` |
| **Default** | `true` |
| **Scope** | Resource |

Enable Pieces OS integration for AI-powered suggestions.

```json
{
  "proactiveAssistant.piecesOs.enabled": true
}
```

When disabled:
- Only template-based suggestions
- No context-aware intelligence
- No LTM (Long-Term Memory) access

---

### `proactiveAssistant.piecesOs.host`

| | |
|---|---|
| **Type** | `string` |
| **Default** | `"localhost"` |
| **Scope** | Resource |

Pieces OS server host address.

```json
{
  "proactiveAssistant.piecesOs.host": "localhost"
}
```

Change this if:
- Running Pieces OS on a different machine
- Using a custom network configuration
- Connecting through a proxy

---

### `proactiveAssistant.piecesOs.port`

| | |
|---|---|
| **Type** | `number` |
| **Default** | `5323` |
| **Scope** | Resource |

Pieces OS server port.

```json
{
  "proactiveAssistant.piecesOs.port": 5323
}
```

Default Pieces OS ports:
- `5323` - Standard port
- Change if port is already in use

---

## 📊 Activity Tracking Settings

### `proactiveAssistant.activityTracking.enabled`

| | |
|---|---|
| **Type** | `boolean` |
| **Default** | `true` |
| **Scope** | Resource |

Enable activity tracking for context-aware suggestions.

```json
{
  "proactiveAssistant.activityTracking.enabled": true
}
```

Tracks:
- File changes
- Editor activity
- Error patterns
- Time spent coding

**Privacy note:** All tracking is local only. No data leaves your machine.

---

### `proactiveAssistant.activityTracking.sampleInterval`

| | |
|---|---|
| **Type** | `number` |
| **Default** | `5000` |
| **Minimum** | `1000` |
| **Maximum** | `60000` |
| **Unit** | milliseconds |
| **Scope** | Resource |

Interval between activity samples.

```json
{
  "proactiveAssistant.activityTracking.sampleInterval": 5000
}
```

| Interval | Effect |
|----------|--------|
| `1000` | High precision, more CPU usage |
| `5000` | Balanced (default) |
| `10000` | Lower precision, less CPU |
| `30000` | Minimal CPU, delayed detection |

---

## 📝 Logging Settings

### `proactiveAssistant.logging.level`

| | |
|---|---|
| **Type** | `string` |
| **Default** | `"info"` |
| **Enum** | `debug`, `info`, `warn`, `error` |
| **Scope** | Resource |

Logging verbosity level.

```json
{
  "proactiveAssistant.logging.level": "info"
}
```

| Level | Output |
|-------|--------|
| `debug` | Everything including detailed debug info |
| `info` | Informational messages and above |
| `warn` | Warnings and errors only |
| `error` | Errors only |

**View logs:** Output panel → "Proactive AI Assistant"

---

## 📋 Complete Settings.json Example

```jsonc
{
  // Core settings
  "proactiveAssistant.enabled": true,
  "proactiveAssistant.focusMode": false,
  "proactiveAssistant.interruptionThreshold": 0.7,
  "proactiveAssistant.snoozeDuration": 30,
  "proactiveAssistant.askDismissalReason": true,

  // Quiet hours (evening to morning)
  "proactiveAssistant.quietHours.enabled": true,
  "proactiveAssistant.quietHours.start": "22:00",
  "proactiveAssistant.quietHours.end": "08:00",

  // Pieces OS (defaults usually fine)
  "proactiveAssistant.piecesOs.enabled": true,
  "proactiveAssistant.piecesOs.host": "localhost",
  "proactiveAssistant.piecesOs.port": 5323,

  // Activity tracking
  "proactiveAssistant.activityTracking.enabled": true,
  "proactiveAssistant.activityTracking.sampleInterval": 5000,

  // Logging
  "proactiveAssistant.logging.level": "info"
}
```

---

## 🔧 Per-Workspace Configuration

Override settings per workspace by adding to `.vscode/settings.json`:

```json
{
  "proactiveAssistant.focusMode": true,
  "proactiveAssistant.interruptionThreshold": 0.9
}
```

Useful for:
- Different projects needing different sensitivity
- Team shared settings
- Temporary configuration changes

---

## 📊 Settings Quick Reference Table

| Setting | Type | Default | Min | Max |
|---------|------|---------|-----|-----|
| `enabled` | boolean | `true` | - | - |
| `focusMode` | boolean | `false` | - | - |
| `interruptionThreshold` | number | `0.7` | `0` | `1` |
| `snoozeDuration` | number | `30` | `5` | `240` |
| `askDismissalReason` | boolean | `true` | - | - |
| `quietHours.enabled` | boolean | `false` | - | - |
| `quietHours.start` | string | `"22:00"` | - | - |
| `quietHours.end` | string | `"08:00"` | - | - |
| `piecesOs.enabled` | boolean | `true` | - | - |
| `piecesOs.host` | string | `"localhost"` | - | - |
| `piecesOs.port` | number | `5323` | - | - |
| `activityTracking.enabled` | boolean | `true` | - | - |
| `activityTracking.sampleInterval` | number | `5000` | `1000` | `60000` |
| `logging.level` | enum | `"info"` | - | - |

---

## 🎯 Recommended Configurations

### Minimal Interruptions
```json
{
  "proactiveAssistant.interruptionThreshold": 0.9,
  "proactiveAssistant.quietHours.enabled": true,
  "proactiveAssistant.quietHours.start": "09:00",
  "proactiveAssistant.quietHours.end": "17:00"
}
```

### Maximum Assistance
```json
{
  "proactiveAssistant.interruptionThreshold": 0.4,
  "proactiveAssistant.askDismissalReason": true,
  "proactiveAssistant.activityTracking.sampleInterval": 2000
}
```

### Night Owl
```json
{
  "proactiveAssistant.quietHours.enabled": true,
  "proactiveAssistant.quietHours.start": "02:00",
  "proactiveAssistant.quietHours.end": "14:00"
}
```

### Performance Optimized
```json
{
  "proactiveAssistant.activityTracking.sampleInterval": 10000,
  "proactiveAssistant.logging.level": "error",
  "proactiveAssistant.askDismissalReason": false
}
```

---

## 📚 Related Documentation

- [Installation Guide](INSTALLATION.md)
- [Usage Guide](USAGE.md)
- [Troubleshooting](TROUBLESHOOTING.md)
