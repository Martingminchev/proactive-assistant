# Settings and Configuration Bugs Report

## Executive Summary
This report documents critical bugs and inconsistencies found in the settings and configuration system across the proactive-assistant codebase. These issues affect both the server (Node.js/Express) and the Nexus Assistant (Electron) components.

---

## 1. CRITICAL: piecesPort Default Value Inconsistency (39300 vs 1000)

### Problem
There is a **major inconsistency** in the default port value for Pieces OS across the codebase:

| File | Line | Value | Issue |
|------|------|-------|-------|
| `nexus-assistant/src/shared/types.ts` | 286 | `39300` | DEFAULT_SETTINGS |
| `nexus-assistant/src/renderer/components/SettingsModal.tsx` | 576 | `1000` | Fallback in parseInt |
| `nexus-assistant/src/renderer/components/SettingsModal.tsx` | 586 | "1000" | Comment says "Default port is 1000" |
| `server/models/Settings.js` | 89 | `39300` | Mongoose schema default |
| `server/routes/settingsRoutes.js` | 163 | `39300` | Test endpoint fallback |
| `client/src/components/Settings.jsx` | 335 | `39300` | UI fallback |

### Impact
- Users may experience connection failures to Pieces OS due to incorrect port defaults
- The UI displays misleading information about the default port
- Different components may use different ports, causing inconsistent behavior

### Recommended Fix
Standardize on **39300** as the default (it's the modern default for Pieces OS 2.0+), but update the UI fallback and comment in SettingsModal.tsx:

```typescript
// In SettingsModal.tsx line 576:
piecesPort: parseInt(e.target.value) || 39300  // Changed from 1000

// In SettingsModal.tsx line 586:
// Default port is 39300. Change only if you've configured Pieces OS to use a different port.
```

---

## 2. HIGH: Settings Changes Don't Trigger Service Re-initialization (Server)

### Problem
When settings are updated via the API, the following services are **NOT** re-initialized with new values:

| Service | Hardcoded Value | Settings Field | File |
|---------|-----------------|----------------|------|
| Daily Brief Job cron | `'0 8 * * *'` | `briefSchedule` | `server/jobs/dailyBriefJob.js:11` |
| Proactive Job cron | `'*/10 * * * *'` | `proactiveInterval` | `server/jobs/proactiveAssistantJob.js:12` |
| AI Provider | `process.env.AI_PROVIDER` | `aiProvider` | Multiple files |

### Impact
- Changing `briefSchedule` in settings has no effect until server restart
- Changing `proactiveInterval` in settings has no effect until server restart
- Users expect real-time settings updates but don't get them

### Recommended Fix
Implement a settings change listener pattern:

```javascript
// In server.js or a settings manager
Settings.watch().on('change', async (change) => {
  console.log('Settings changed, reconfiguring jobs...');
  dailyBriefJob.reconfigure(change.fullDocument.briefSchedule);
  proactiveAssistantJob.reconfigure(change.fullDocument.proactiveInterval);
});
```

---

## 3. MEDIUM: Missing Fields in allowedFields Array

### Problem
The `focusMode` setting exists in the schema but is missing from the allowed fields list:

**File:** `server/routes/settingsRoutes.js` (lines 36-41)
```javascript
const allowedFields = [
  'aiProvider', 'zaiApiKey', 'zaiModel', 'geminiApiKey', 'geminiModel',
  'newsApiKey', 'piecesPort', 'usePiecesSummary', 'briefSchedule',
  'autoGenerate', 'historyDepth', 'maxRecommendations', 'enabledCategories',
  'proactiveInterval', 'proactiveEnabled', 'theme'
  // MISSING: 'focusMode'
];
```

### Impact
- Users cannot update `focusMode` via the settings API
- The PATCH endpoint uses a different validation path, creating inconsistency

### Recommended Fix
Add `'focusMode'` to the allowedFields array.

---

## 4. MEDIUM: Settings Migration Logic Missing

### Problem
There is **no migration system** for settings. When new fields are added:
- Existing users don't get new default values
- The deep merge in settingsStore.ts only handles top-level fields
- No version tracking for settings schema

**File:** `nexus-assistant/src/renderer/stores/settingsStore.ts` (lines 92-97)
```typescript
const mergedSettings = { 
  ...DEFAULT_SETTINGS, 
  ...settings,
  trackedDirectories: settings.trackedDirectories || DEFAULT_SETTINGS.trackedDirectories,
};
```

### Impact
- New features may not work for existing users until they reset settings
- Inconsistent behavior between new and existing installations

### Recommended Fix
Implement a settings migration system:

```typescript
// In shared/types.ts
export const SETTINGS_VERSION = 2;

export interface AppSettings {
  // ... existing fields
  _version?: number;
}

// Migration function
export function migrateSettings(settings: any): AppSettings {
  const version = settings._version || 1;
  let migrated = { ...settings };
  
  if (version < 2) {
    // Add new fields from v2
    migrated.trackFileChanges = DEFAULT_SETTINGS.trackFileChanges;
  }
  
  migrated._version = SETTINGS_VERSION;
  return migrated;
}
```

---

## 5. MEDIUM: Settings Mismatch Between Server and Nexus

### Problem
The settings schemas are **not synchronized** between server and Nexus:

| Setting | Server | Nexus | Issue |
|---------|--------|-------|-------|
| `zaiApiKey` | ✓ | ✗ | Nexus doesn't support z.ai |
| `geminiApiKey` | ✓ | ✗ | Nexus uses Kimi instead |
| `newsApiKey` | ✓ | ✗ | Nexus doesn't have news |
| `kimiApiKey` | ✗ | ✓ | Server doesn't support Kimi |
| `kimiBaseUrl` | ✗ | ✓ | Server doesn't support Kimi |
| `usePiecesSummary` | ✓ | ✗ | Nexus always uses Pieces if enabled |
| `briefSchedule` | ✓ | ✗ | Nexus doesn't have brief generation |
| `autoGenerate` | ✓ | ✗ | Nexus doesn't have brief generation |
| `historyDepth` | ✓ | ✗ | Nexus doesn't track history |
| `maxRecommendations` | ✓ | ✗ | Nexus doesn't generate recommendations |
| `enabledCategories` | ✓ | ✗ | Nexus doesn't have categories |
| `proactiveInterval` | ✓ | ✗ | Nexus doesn't have proactive job |
| `proactiveEnabled` | ✓ | ✗ | Nexus doesn't have proactive job |
| `focusMode` | ✓ | ✗ | Nexus doesn't support focus mode |

### Impact
- Two completely different settings systems that don't interoperate
- Confusion for users who might expect settings to sync

### Recommended Fix
Either:
1. **Unify the settings schemas** with a shared types package
2. **Document the differences** clearly in README files
3. **Rename one of the systems** to avoid confusion (e.g., "ServerSettings" vs "NexusSettings")

---

## 6. LOW: UI Shows Setting Not in Schema (trackFileChanges)

### Problem
The `trackFileChanges` setting is defined in DEFAULT_SETTINGS but there's **no UI control** for it in SettingsModal.tsx. Only `trackActiveWindow` and `trackClipboard` have UI controls.

**File:** `nexus-assistant/src/renderer/components/SettingsModal.tsx` (lines 810-850)

### Impact
- Users cannot control file change tracking from the UI
- Feature exists but is inaccessible

### Recommended Fix
Add a toggle for `trackFileChanges` in the Context tab, or remove it from DEFAULT_SETTINGS if not needed.

---

## 7. LOW: Client-Side Theme Storage Bypasses Server Settings

### Problem
The theme is stored in **two places**:
- Server: `settings.theme` (MongoDB)
- Client: `localStorage.getItem('proactive-assistant-theme')` 

**File:** `client/src/hooks/useTheme.js` (line 4)

### Impact
- Theme changes on client don't persist to server
- Inconsistent theme experience across devices

### Recommended Fix
Sync theme with server settings:

```javascript
// In useTheme.js
useEffect(() => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
  
  // Sync to server
  fetch(`${API_BASE}/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme })
  }).catch(console.error);
}, [theme]);
```

---

## 8. LOW: Insecure Encryption Key Derivation

### Problem
The encryption for API keys uses a **static salt** with scrypt:

**File:** `server/models/Settings.js` (lines 8-12)
```javascript
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'proactive-assistant-default-key-32';
// ...
const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);  // Static salt!
```

### Impact
- Same passwords always produce the same key
- Weak security if default key is used

### Recommended Fix
Use a random IV and proper key derivation:

```javascript
function encrypt(text) {
  if (!text) return '';
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(16);  // Random salt
    const key = crypto.scryptSync(ENCRYPTION_KEY, salt, 32);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);  // Use GCM mode
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();
    return salt.toString('hex') + ':' + iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex');
  } catch (e) {
    console.error('Encryption error:', e.message);
    return text;
  }
}
```

---

## 9. LOW: Missing Validation for Numeric Settings

### Problem
Several numeric settings lack validation:

| Setting | Min | Max | Current Validation |
|---------|-----|-----|-------------------|
| `piecesPort` | 1 | 65535 | None in routes |
| `proactiveInterval` | 1 | 60 | Mongoose only |
| `maxRecommendations` | 3 | 15 | Mongoose only |

### Impact
- Invalid values can be saved via API
- May cause runtime errors

### Recommended Fix
Add validation middleware:

```javascript
// In settingsRoutes.js
const validateSettings = (req, res, next) => {
  const errors = [];
  
  if (req.body.piecesPort !== undefined) {
    const port = parseInt(req.body.piecesPort);
    if (port < 1 || port > 65535) {
      errors.push('piecesPort must be between 1 and 65535');
    }
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', errors });
  }
  
  next();
};

router.put('/', validateSettings, async (req, res) => {
  // ... existing handler
});
```

---

## 10. INFO: Environment Variable Precedence Over Settings

### Problem
The `AI_PROVIDER` environment variable overrides settings without any indication to the user:

**File:** `server/jobs/dailyBriefJob.js` (line 33)
```javascript
const provider = process.env.AI_PROVIDER || 'pieces';
```

### Impact
- Users may change settings but see no effect
- Confusing behavior

### Recommended Fix
Document this behavior or add a warning:

```javascript
const provider = process.env.AI_PROVIDER || settings.aiProvider || 'pieces';
if (process.env.AI_PROVIDER) {
  console.warn('⚠️ AI_PROVIDER environment variable is overriding settings.aiProvider');
}
```

---

## Priority Action Items

1. **Immediate (P0):** Fix piecesPort default inconsistency (Bug #1)
2. **High (P1):** Implement settings change listeners for cron jobs (Bug #2)
3. **High (P1):** Add missing `focusMode` to allowedFields (Bug #3)
4. **Medium (P2):** Implement settings migration system (Bug #4)
5. **Medium (P2):** Document or unify server/Nexus settings divergence (Bug #5)
6. **Low (P3):** Add UI for trackFileChanges or remove setting (Bug #6)
7. **Low (P3):** Sync theme between client and server (Bug #7)
8. **Low (P3):** Improve encryption security (Bug #8)
9. **Low (P3):** Add numeric validation (Bug #9)
10. **Info (P4):** Document environment variable precedence (Bug #10)

---

## Files Requiring Changes

### Server (`/server`)
- `models/Settings.js` - Encryption fix, validation
- `routes/settingsRoutes.js` - allowedFields, validation middleware
- `jobs/dailyBriefJob.js` - Use settings instead of hardcoded values
- `jobs/proactiveAssistantJob.js` - Use settings instead of hardcoded values

### Nexus Assistant (`/nexus-assistant`)
- `src/shared/types.ts` - Add migration version
- `src/renderer/components/SettingsModal.tsx` - Fix port fallback, add trackFileChanges
- `src/renderer/stores/settingsStore.ts` - Add migration logic

### Client (`/client`)
- `src/hooks/useTheme.js` - Sync with server
- `src/components/Settings.jsx` - Verify port defaults

---

*Report generated: 2026-01-29*
*Scope: proactive-assistant codebase*
