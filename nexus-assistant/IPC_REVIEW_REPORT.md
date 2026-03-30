# NEXUS Electron App - IPC Handler Review Report

## Executive Summary

This report identifies **15+ bugs and incomplete implementations** in the IPC communication layer of the NEXUS Electron application. Issues range from missing handlers to type mismatches and incomplete Pieces OS integration.

---

## 1. CRITICAL BUGS

### 1.1 Missing IPC Handlers (4 channels defined but not implemented)

| Channel | Location | Status | Impact |
|---------|----------|--------|--------|
| `CHAT_CLEAR` | types.ts:270 | ❌ No handler | Cannot clear chat from renderer |
| `CONTEXT_SUBSCRIBE` | types.ts:287 | ❌ No handler | Cannot subscribe to context updates |
| `CONTEXT_UNSUBSCRIBE` | types.ts:288 | ❌ No handler | Cannot unsubscribe from context updates |
| `PIECES_GET_ASSET` | types.ts:293 | ❌ No handler | Cannot retrieve specific Pieces asset |

**Evidence:**
```typescript
// types.ts lines 265-307 define these channels:
export const IPC_CHANNELS = {
  // ...
  CHAT_CLEAR: 'chat:clear',           // ← NO HANDLER in main.ts
  CONTEXT_SUBSCRIBE: 'context:subscribe',     // ← NO HANDLER
  CONTEXT_UNSUBSCRIBE: 'context:unsubscribe', // ← NO HANDLER
  PIECES_GET_ASSET: 'pieces:get-asset',       // ← NO HANDLER
  // ...
};
```

---

### 1.2 Missing Preload Exposures (3 channels)

| Channel | Defined in types.ts | Exposed in preload.ts | Impact |
|---------|--------------------|-----------------------|--------|
| `CHAT_CLEAR` | ✅ Yes | ❌ No | Renderer cannot call chat clear |
| `CONTEXT_SUBSCRIBE` | ✅ Yes | ❌ No | Renderer cannot subscribe to context |
| `CONTEXT_UNSUBSCRIBE` | ✅ Yes | ❌ No | Renderer cannot unsubscribe |
| `PIECES_GET_ASSET` | ✅ Yes | ❌ No | Cannot get specific Pieces asset |

**Evidence:**
```typescript
// preload.ts - ElectronAPI interface missing:
export interface ElectronAPI {
  // Chat - missing chatClear!
  sendChatMessage: (...) => Promise<void>;
  cancelChat: () => Promise<void>;
  // ❌ chatClear is missing!
  
  // Context - missing subscribe/unsubscribe!
  getContext: () => Promise<any>;
  // ❌ subscribeToContext missing!
  // ❌ unsubscribeFromContext missing!
  
  // Pieces - missing getAsset!
  getPiecesStatus: () => Promise<any>;
  searchPieces: (query: string) => Promise<any[]>;
  // ❌ getPiecesAsset missing!
}
```

---

### 1.3 Hardcoded Channel String (Security/Maintainability Issue)

**File:** `main.ts:183`, `preload.ts:113`

```typescript
// main.ts line 183 - HARDCODED STRING:
this.mainWindow?.webContents.send('app:open-settings');

// preload.ts line 113 - HARDCODED STRING:
onOpenSettings: createIpcListener('app:open-settings'),
```

**Problem:** Channel string `'app:open-settings'` is not defined in `IPC_CHANNELS` constant, creating a maintenance risk and potential for typos.

**Fix:** Add to IPC_CHANNELS:
```typescript
export const IPC_CHANNELS = {
  // ...
  APP_OPEN_SETTINGS: 'app:open-settings',  // ← ADD THIS
};
```

---

## 2. INCONSISTENT ERROR HANDLING

### 2.1 Handlers with Inconsistent Return Patterns

| Handler | Returns on Success | Returns on Error | Inconsistency |
|---------|-------------------|------------------|---------------|
| `SETTINGS_GET` | `AppSettings` | `DEFAULT_SETTINGS` | ✅ Consistent |
| `SETTINGS_UPDATE` | `updated` | `throws` | ⚠️ Throws instead of returning error |
| `CONVERSATION_GET_ALL` | `array` | `[]` | ✅ Consistent |
| `CONVERSATION_GET` | `conversation \| null` | `null` | ✅ Consistent |
| `CONVERSATION_CREATE` | `conversation \| null` | `null` | ✅ Consistent |
| `CONVERSATION_DELETE` | `true` | `true` (silent) | ❌ **Always returns true even on failure** |
| `PIECES_SEARCH` | `assets[]` | `[]` | ❌ **Empty array hides errors** |
| `PIECES_STATUS` | `{available}` | `{available: false}` | ✅ Consistent |

**Critical Issue in CONVERSATION_DELETE:**
```typescript
// main.ts:418-420
ipcMain.handle(IPC_CHANNELS.CONVERSATION_DELETE, (_, id: string) => wrapHandler('CONVERSATION_DELETE', () => {
  this.conversationStore?.delete(id);  // ← Returns boolean but ignored!
  return true;  // ← Always returns true!
}));
```

**Should be:**
```typescript
ipcMain.handle(IPC_CHANNELS.CONVERSATION_DELETE, (_, id: string) => wrapHandler('CONVERSATION_DELETE', () => {
  const result = this.conversationStore?.delete(id);
  if (!result) {
    throw new Error(`Conversation not found: ${id}`);
  }
  return true;
}));
```

---

### 2.2 Missing try-catch in Several Handlers

These handlers don't have explicit try-catch blocks for unexpected errors:
- `WINDOW_*` handlers (lines 265-291)
- `APP_QUIT`, `APP_VERSION`, `APP_OPEN_EXTERNAL` (lines 294-304)

While the `wrapHandler` helper catches errors, individual handlers don't handle their specific error cases.

---

## 3. TYPE SAFETY ISSUES

### 3.1 `any` Types in Preload Script

```typescript
// preload.ts lines 28-38 - Using any instead of proper types
export interface ElectronAPI {
  getSettings: () => Promise<any>;           // ❌ Should be Promise<AppSettings>
  updateSettings: (settings: any) => Promise<any>;  // ❌ Should be Promise<AppSettings>
  resetSettings: () => Promise<any>;        // ❌ Should be Promise<AppSettings>
  
  getAllConversations: () => Promise<any[]>;  // ❌ Should be Promise<Conversation[]>
  getConversation: (id: string) => Promise<any>;   // ❌ Should be Promise<Conversation | null>
  createConversation: () => Promise<any>;     // ❌ Should be Promise<Conversation>
  updateConversation: (conversation: any) => Promise<any>;  // ❌ Should be typed
}
```

### 3.2 Missing Type Exports

The preload script imports `IpcChannel` from types but doesn't use it to type the API methods properly.

---

## 4. INCOMPLETE PIECES OS INTEGRATION

### 4.1 Handler Missing for getAsset

**File:** `pieces-client.ts:127-145` has `getAsset()` method but no IPC handler.

**Missing in main.ts:**
```typescript
// This handler is NOT implemented:
ipcMain.handle(IPC_CHANNELS.PIECES_GET_ASSET, (_, id: string) => wrapHandler('PIECES_GET_ASSET', async () => {
  if (!this.piecesClient) return null;
  return this.piecesClient.getAsset(id);
}));
```

**Missing in preload.ts:**
```typescript
// This exposure is NOT implemented:
getPiecesAsset: createIpcInvoker(IPC_CHANNELS.PIECES_GET_ASSET),
```

### 4.2 No IPC Exposure for QGPT Analysis

The `PiecesClient.analyzeContext()` method (lines 151-173) is completely inaccessible from the renderer - no IPC channel exists for it.

---

## 5. CONTEXT MONITORING ISSUES

### 5.1 Subscribe/Unsubscribe Handlers Missing

The `ContextMonitor` class supports event subscriptions via EventEmitter, but there's no IPC bridge to allow the renderer to subscribe.

**What's missing in main.ts:**
```typescript
// Missing handlers for context subscriptions
ipcMain.handle(IPC_CHANNELS.CONTEXT_SUBSCRIBE, () => {
  // Should subscribe and forward events to renderer
});

ipcMain.handle(IPC_CHANNELS.CONTEXT_UNSUBSCRIBE, () => {
  // Should unsubscribe
});
```

### 5.2 Context Updates Not Broadcasted

When context updates occur, only the `emit('update', ...)` is called, but there's no mechanism to forward these to the renderer process.

**Current code (context-monitor.ts:148):**
```typescript
this.emit('update', this.currentContext);  // Only emits locally in main process
```

---

## 6. STORE INTEGRATION ISSUES

### 6.1 appStore.ts - Missing Error Handling Pattern

Some IPC calls don't have consistent error handling:

```typescript
// appStore.ts:372-381 - No try-catch for getPiecesStatus
const piecesStatus = await window.electronAPI?.getPiecesStatus();
```

While this is wrapped in a try-catch at line 371, the pattern is inconsistent with other calls that use `logIpcCall/logIpcResponse`.

### 6.2 settingsStore.ts - API Connection Status Logic Flaw

```typescript
// appStore.ts:25-26, 383-385
isApiConnected: false,
// ...
// API connection is determined by whether we can make successful requests
// This will be set based on successful responses
```

**Problem:** `isApiConnected` is never actually set to `true` anywhere in the codebase!

**Should be set:**
1. After successful API key validation
2. After successful chat completion
3. When settings are loaded with a valid API key

---

## 7. RECOMMENDED FIXES

### Priority 1: Critical (App Functionality)

1. **Add missing IPC handlers in main.ts:**
```typescript
// Add these handlers:
ipcMain.handle(IPC_CHANNELS.CHAT_CLEAR, (_, conversationId: string) => 
  wrapHandler('CHAT_CLEAR', () => {
    const conversation = this.conversationStore?.get(conversationId);
    if (conversation) {
      conversation.messages = [];
      this.conversationStore?.update(conversation);
    }
    return true;
  }));

ipcMain.handle(IPC_CHANNELS.PIECES_GET_ASSET, (_, id: string) => 
  wrapHandler('PIECES_GET_ASSET', async () => {
    if (!this.piecesClient) return null;
    return this.piecesClient.getAsset(id);
  }));
```

2. **Fix CONVERSATION_DELETE to return proper error:**
```typescript
ipcMain.handle(IPC_CHANNELS.CONVERSATION_DELETE, (_, id: string) => 
  wrapHandler('CONVERSATION_DELETE', () => {
    const result = this.conversationStore?.delete(id);
    if (!result) {
      throw new Error(`Conversation not found: ${id}`);
    }
    return true;
  }));
```

3. **Add APP_OPEN_SETTINGS to IPC_CHANNELS:**
```typescript
export const IPC_CHANNELS = {
  // ... existing channels
  APP_OPEN_SETTINGS: 'app:open-settings',
} as const;
```

### Priority 2: Type Safety

4. **Update preload.ts with proper types:**
```typescript
import { AppSettings, Conversation, PiecesAsset } from '../shared/types';

export interface ElectronAPI {
  getSettings: () => Promise<AppSettings>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  // ... etc
}
```

### Priority 3: Feature Completion

5. **Implement or remove unused context subscription channels:**
   - Option A: Implement handlers and preload exposures
   - Option B: Remove from IPC_CHANNELS if not needed

6. **Fix isApiConnected tracking in appStore.ts:**
```typescript
// Add to checkConnectionStatus or call after successful operations
set({ isApiConnected: true });
```

---

## 8. SUMMARY TABLE

| Category | Count | Severity |
|----------|-------|----------|
| Missing IPC handlers | 4 | High |
| Missing preload exposures | 4 | High |
| Type safety issues | 6 | Medium |
| Inconsistent error handling | 3 | Medium |
| Hardcoded strings | 1 | Low |
| Incomplete integration | 2 | Medium |
| **TOTAL** | **20** | - |

---

## Files Requiring Changes

1. `src/shared/types.ts` - Add APP_OPEN_SETTINGS channel
2. `src/main/main.ts` - Add missing handlers, fix error handling
3. `src/main/preload.ts` - Add missing exposures, fix types
4. `src/renderer/stores/appStore.ts` - Fix isApiConnected tracking
5. `src/renderer/stores/settingsStore.ts` - Review validation logic (optional)
