# Pieces OS "Disconnected" Debug Analysis

## Problem Summary
The VS Code extension webview was showing **"Pieces OS: Disconnected"** even though the connection logic appeared to be working. No console errors were shown because the issue was a **missing data flow** - not a connection error.

---

## Root Cause Analysis

### The Core Issue: Missing Data Flow
The Pieces OS connection status was **never being sent from the extension to the webview**.

### Data Flow Diagram (BEFORE - Broken)
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   piecesClient  │────▶│  SuggestionOrchestrator │────▶│  (used for AI)  │
│   (connection   │     │  (checks isAvailable()) │     │                 │
│    logic)       │     └─────────────────┘     └─────────────────┘
└─────────────────┘              │
         │                       │
         │ onStatusChanged       │ piecesClient.isAvailable()
         │ (fires events)        │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│   ❌ NO ONE     │     │  PanelProvider  │
│   LISTENING!    │     │  (webview comms)│
└─────────────────┘     └────────┬────────┘
                                 │
                                 │ sendStateToWebview()
                                 │ ❌ Missing isPiecesConnected
                                 ▼
                          ┌─────────────────┐
                          │     Webview     │
                          │  CurrentStatus  │
                          │   component     │
                          │                 │
                          │ Shows: "Disconnected"
                          │ (isPiecesConnected is undefined)
                          └─────────────────┘
```

---

## Detailed Findings

### 1. piecesClient.ts - Working Correctly ✅
- Health check endpoint: `/.well-known/health`
- Tries ports: `[1000, 39300, 5323]`
- Fires `onStatusChanged` events
- Has `isAvailable()` method

### 2. extension.ts - Partial Connection ⚠️
- Created `piecesClient` ✅
- Called `piecesClient.initialize()` ✅
- Passed to `SuggestionOrchestrator` ✅
- **Missing**: Subscription to `onStatusChanged` to update UI ❌

### 3. panelProvider.ts - MISSING THE STATUS ❌
**Problem**: The `request-status` handler (lines 404-418) was NOT including `isPiecesConnected` in the response payload.

```typescript
// BEFORE (Broken):
case 'request-status':
  this.panel?.webview.postMessage({
    type: 'status',
    payload: {
      view: this.currentView,
      currentFile: { ... },
      suggestion: this.currentSuggestion,
      flowState: ...,
      // ❌ MISSING: isPiecesConnected!
    },
  });
```

### 4. Webview (App.tsx) - Not Handling Updates ⚠️
**Problem**: The `stateUpdate` handler preserved the old `isPiecesConnected` value instead of using the new one from state.

```typescript
// BEFORE (Broken):
setStatus(prev => ({
  ...prev,
  isPiecesConnected: prev?.isPiecesConnected ?? false,  // ❌ Never updates!
  // ...
}));
```

### 5. CurrentStatus.tsx - Display Logic ✅
- Working correctly - displays based on `isPiecesConnected` value
- Problem was that the value was always `undefined`/`false`

---

## Fixes Applied

### Fix 1: panelProvider.ts - Add Status Tracking
**Changes**:
1. Added `ConnectionStatus` import
2. Added `piecesConnectionStatus` private field
3. Added `updatePiecesConnectionStatus()` method
4. Updated `AppState` interface to include `isPiecesConnected`
5. Updated `sendStateToWebview()` to include `isPiecesConnected`
6. Updated `request-status` handler to include `isPiecesConnected`
7. Updated `ready`/`panelReady` handler to include `isPiecesConnected`

```typescript
// NEW: Status tracking field
private piecesConnectionStatus: ConnectionStatus = 'disconnected';

// NEW: Public method to update status
updatePiecesConnectionStatus(status: ConnectionStatus): void {
  this.logger.debug(`PanelProvider: Pieces OS status updated to '${status}'`);
  this.piecesConnectionStatus = status;
  if (this.panel) {
    this.sendStateToWebview();
  }
}
```

### Fix 2: extension.ts - Wire Up Status Changes
**Changes**: Subscribe to `piecesClient.onStatusChanged` and update `panelProvider`

```typescript
const panelProvider = getPanel(services);

// NEW: Subscribe to Pieces OS connection status changes
const piecesStatusDisposable = piecesClient.onStatusChanged((status) => {
  logger?.info(`[Extension] Pieces OS status changed to: ${status}`);
  panelProvider.updatePiecesConnectionStatus(status);
});
// Set initial status
panelProvider.updatePiecesConnectionStatus(piecesClient.status);
context.subscriptions.push(piecesStatusDisposable);
```

### Fix 3: piecesClient.ts - Enhanced Logging
**Changes**: Added detailed logging for debugging connection issues

```typescript
this.logger.info('[PiecesOSClient] Initializing...');
this.logger.info(`[PiecesOSClient] Will try ports: ${this.config.ports.join(', ')}`);
// ... more detailed logs for each port attempt
```

### Fix 4: webview/App.tsx - Handle State Updates
**Changes**: Fixed `stateUpdate` handler to use new `isPiecesConnected` value

```typescript
const state = message.payload as { 
  currentFile?: { path: string | null; duration: number };
  flowState?: string;
  isPiecesConnected?: boolean;  // NEW: Added to type
};
setStatus(prev => ({
  ...prev,
  // FIXED: Use new value from state, fallback to previous
  isPiecesConnected: state.isPiecesConnected ?? prev?.isPiecesConnected ?? false,
  // ...
}));
```

---

## Data Flow Diagram (AFTER - Fixed)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   piecesClient  │────▶│  SuggestionOrchestrator │────▶│  (used for AI)  │
│   (connection   │     │  (checks isAvailable()) │     │                 │
│    logic)       │     └─────────────────┘     └─────────────────┘
└─────────────────┘              │
         │                       │
         │ onStatusChanged       │ piecesClient.isAvailable()
         │ (fires events)        │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│   extension.ts  │     │  PanelProvider  │
│   (subscribes   │────▶│  (webview comms)│
│    to events)   │     │                 │
└─────────────────┘     │ updatePiecesConnectionStatus()
                        │ (stores status) │
                        └────────┬────────┘
                                 │
                                 │ sendStateToWebview()
                                 │ ✅ Includes isPiecesConnected
                                 ▼
                          ┌─────────────────┐
                          │     Webview     │
                          │  CurrentStatus  │
                          │   component     │
                          │                 │
                          │ Shows: "Connected"
                          │ (when pieces is available)
                          └─────────────────┘
```

---

## How to Verify the Fix

### 1. Check Extension Logs
Open the Output panel and select "Proactive Assistant" to see:
```
[PiecesOSClient] Initializing...
[PiecesOSClient] Will try ports: 1000, 39300, 5323
[PiecesOSClient] Trying port 1000...
[PiecesOSClient] Trying port 39300...
[PiecesOSClient] ✅ Connected to Pieces OS on port 39300
[Extension] Pieces OS status changed to: connected
```

### 2. Check Webview
Open the Proactive Assistant panel and look at:
- **Current Status** section should show "Pieces OS: Connected" (with green dot)

### 3. If Still Disconnected
Run the **"Proactive Assistant: Diagnose Pieces OS Connection"** command from the Command Palette to see detailed diagnostics.

---

## Files Modified

1. **src/ui/panelProvider.ts**
   - Added `piecesConnectionStatus` field
   - Added `updatePiecesConnectionStatus()` method
   - Updated `AppState` interface
   - Updated `sendStateToWebview()` method
   - Updated message handlers

2. **src/extension.ts**
   - Added subscription to `piecesClient.onStatusChanged`
   - Added initial status sync

3. **src/services/piecesClient.ts**
   - Enhanced logging for debugging

4. **webview/src/App.tsx**
   - Fixed `stateUpdate` handler to use `isPiecesConnected` from state

---

## Additional Debugging Tips

If Pieces OS still shows as "Disconnected":

1. **Check if Pieces OS is running**: Look for the Pieces OS app in your system tray/taskbar

2. **Check the ports**: Pieces OS should be available on one of:
   - Port 1000 (older versions)
   - Port 39300 (current default)
   - Port 5323 (alternative)

3. **Test manually**: Open a browser and try:
   - `http://localhost:39300/.well-known/health`
   - Should return "ok" or JSON with status

4. **Check firewall**: Ensure your firewall isn't blocking localhost connections

5. **Restart Pieces OS**: Sometimes a simple restart resolves connection issues
