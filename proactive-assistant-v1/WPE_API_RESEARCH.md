# Pieces Workstream Pattern Engine (WPE) API - Research Report

## Executive Summary

The Pieces Workstream Pattern Engine (WPE) is a **screen capture/vision API** that tracks user activity on their desktop. It provides the richest context for understanding what users are working on, but **requires specific permissions and activation** to function properly. This document details the API endpoints, data structures, privacy settings, platform requirements, known issues, and code examples.

---

## 1. WPE API Documentation and Endpoints

### Primary API Class: `WorkstreamPatternEngineApi`

**Base URL**: `http://localhost:39300` (Windows/Mac) or `http://localhost:5323` (Linux)

### Core Vision Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/workstream_pattern_engine/processors/vision/status` | GET | Get WPE activation status |
| `/workstream_pattern_engine/processors/vision/activate` | POST | Activate WPE vision processing |
| `/workstream_pattern_engine/processors/vision/deactivate` | POST | Deactivate WPE vision processing |
| `/workstream_pattern_engine/processors/vision/data/events` | GET | Get all vision events (screen captures) |
| `/workstream_pattern_engine/processors/vision/data/events/{vision_event}` | GET | Get specific vision event by ID |
| `/workstream_pattern_engine/processors/vision/data/events/search` | POST | Search vision events with filters |
| `/workstream_pattern_engine/processors/vision/data/clear` | POST | Clear vision data for time ranges |
| `/workstream_pattern_engine/processors/vision/metadata` | GET | Get metadata (Qdrant collection size) |
| `/workstream_pattern_engine/processors/sources` | GET | Get tracked applications/sources |

### Source Management Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/workstream_pattern_engine/sources` | GET | Get all WPE sources |
| `/workstream_pattern_engine/sources/create` | POST | Create a new source |
| `/workstream_pattern_engine/sources/{source}/delete` | POST | Delete a specific source |
| `/workstream_pattern_engine/sources/search` | POST | Search sources |

### Calibration Endpoints (for UI positioning)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/workstream_pattern_engine/processors/vision/calibrations` | GET | Get all window calibrations |
| `/workstream_pattern_engine/processors/vision/calibrations/focused` | GET | Get calibration for focused window |
| `/workstream_pattern_engine/processors/vision/calibration/capture` | POST | Capture current window dimensions |

---

## 2. Querying Vision Events, OCR Data, and Screen Context

### Vision Event Data Structure

```typescript
interface WorkstreamPatternEngineVisionEvent {
  id: string;                          // UUID of the event
  created: GroupedTimestamp;           // When the event was captured
  source?: WorkstreamPatternEngineSource;  // Source application info
  textual?: WorkstreamPatternEngineVisionEventTextualValue;  // OCR + extracted text
}

interface WorkstreamPatternEngineSource {
  name?: string;       // DEPRECATED
  window?: string;     // Tab or open file name
  url?: string;        // URL if from browser
  application?: string; // Application name (foreground window)
  installation?: string; // Application installation path
}

interface WorkstreamPatternEngineVisionEventTextualValue {
  ocr?: TransferableString;           // OCR text from screen
  extracted?: TextuallyExtractedMaterial;  // Extracted structured content
}
```

### Code Example: Fetching Vision Events

```javascript
const pieces = require('@pieces.app/pieces-os-client');

// Configuration
const configuration = new pieces.Configuration({
  basePath: 'http://localhost:39300'  // or 5323 for Linux
});

const wpeApi = new pieces.WorkstreamPatternEngineApi(configuration);

// Get vision events with full data (transferables=true)
async function getVisionEvents(limit = 50) {
  try {
    const snapshot = await wpeApi.workstreamPatternEngineProcessorsVisionEventsSnapshot({
      transferables: true  // IMPORTANT: Required to get OCR text content
    });
    
    const events = snapshot.iterable || [];
    
    // Sort by timestamp (most recent first)
    const sortedEvents = events
      .sort((a, b) => {
        const dateA = a.created?.value ? new Date(a.created.value) : new Date(0);
        const dateB = b.created?.value ? new Date(b.created.value) : new Date(0);
        return dateB - dateA;
      })
      .slice(0, limit);

    // Extract meaningful data
    return sortedEvents.map(event => ({
      id: event.id,
      created: event.created?.value,
      application: event.source?.application || 'Unknown',
      window: event.source?.window || '',
      url: event.source?.url || '',
      // OCR text content
      ocrText: event.textual?.ocr?.raw || '',
      extractedText: event.textual?.extracted?.raw || ''
    }));
  } catch (error) {
    console.error('Error fetching vision events:', error.message);
    return [];
  }
}
```

### Code Example: Searching Vision Events

```javascript
// Search vision events with query and time filters
async function searchVisionEvents(query, fromDate, toDate) {
  try {
    const searchInput = {
      engines: {
        vision: true,
        // Other search engines as needed
      },
      query: query,  // Search query string
      temporal: {
        created: {
          from: fromDate ? { value: fromDate.toISOString() } : undefined,
          to: toDate ? { value: toDate.toISOString() } : undefined
        }
      }
    };

    const results = await wpeApi.workstreamPatternEngineProcessorsVisionEventsSearch({
      transferables: true,
      searchInput: searchInput
    });

    return results.iterable || [];
  } catch (error) {
    console.error('Error searching vision events:', error.message);
    return [];
  }
}
```

### Code Example: Getting OCR Analyses

```javascript
const ocrApi = new pieces.OCRAnalysesApi(configuration);

async function getOCRAnalyses(limit = 20) {
  try {
    const snapshot = await ocrApi.ocrAnalysesSnapshot({
      transferables: true  // Required to get actual OCR text
    });
    
    const analyses = snapshot.iterable || [];
    
    return analyses.slice(0, limit).map(analysis => ({
      id: analysis.id,
      created: analysis.created?.value,
      // The extracted text from the image
      text: analysis.raw?.string?.raw || '',
      // Confidence score if available
      confidence: analysis.confidence,
      // Associated image analysis
      imageId: analysis.image
    }));
  } catch (error) {
    console.error('Error fetching OCR analyses:', error.message);
    return [];
  }
}
```

---

## 3. Privacy Settings That Block WPE Data Collection

### Critical Permission Requirements

The WPE requires specific OS-level permissions to function:

```typescript
interface OSProcessingPermissions {
  vision?: boolean;        // Screen capture/recording permission
  accessibility?: boolean;  // Accessibility API access
}
```

### Platform-Specific Permission Requirements

#### macOS
- **Screen Recording Permission**: Required for WPE to capture screen content
- **Accessibility Permission**: Required to detect active window/application
- **Permission Check Endpoint**: `GET /os/permissions`
- **Request Permission**: `POST /os/permissions/request`

#### Windows
- **Screen Capture Permission**: Usually granted by default
- **Accessibility Permission**: May be required for some window detection features

#### Linux
- **X11/Wayland Permissions**: Screen capture depends on display server
- **Note**: WPE functionality may be limited on Linux compared to macOS/Windows

### Checking Permissions

```javascript
const osApi = new pieces.OSApi(configuration);

async function checkPermissions() {
  try {
    const permissions = await osApi.osPermissions();
    
    return {
      visionGranted: permissions.processing?.vision || false,
      accessibilityGranted: permissions.processing?.accessibility || false,
      canCollectData: permissions.processing?.vision && permissions.processing?.accessibility
    };
  } catch (error) {
    console.error('Error checking permissions:', error.message);
    // Linux may not support this endpoint
    return { visionGranted: false, accessibilityGranted: false, canCollectData: false };
  }
}
```

### WPE Activation Status

```typescript
interface WorkstreamPatternEngineVisionStatus {
  activation?: AnonymousTemporalRange;    // When/how long WPE is active
  deactivation?: AnonymousTemporalRange;  // When/how long WPE is deactivated
  degraded?: boolean;                     // Hardware limitations affecting performance
  migration?: MigrationProgress;          // Data migration status
}

interface AnonymousTemporalRange {
  from?: GroupedTimestamp;    // Start time
  to?: GroupedTimestamp;      // End time
  between?: boolean;          // Is this a range between times
  continuous?: boolean;       // Is this continuous (indefinite)
}
```

### Activating/Deactivating WPE

```javascript
// Activate WPE
async function activateWPE() {
  try {
    const status = await wpeApi.workstreamPatternEngineProcessorsVisionActivate({
      workstreamPatternEngineStatus: {
        vision: {
          activation: {
            continuous: true  // Activate indefinitely
          }
        }
      }
    });
    return status;
  } catch (error) {
    console.error('Error activating WPE:', error.message);
    throw error;
  }
}

// Deactivate WPE
async function deactivateWPE() {
  try {
    const status = await wpeApi.workstreamPatternEngineProcessorsVisionDeactivate({
      workstreamPatternEngineStatus: {
        vision: {
          deactivation: {
            continuous: true  // Deactivate indefinitely
          }
        }
      }
    });
    return status;
  } catch (error) {
    console.error('Error deactivating WPE:', error.message);
    throw error;
  }
}
```

---

## 4. Platform-Specific Requirements

### Port Differences

| Platform | Default Port | Notes |
|----------|-------------|-------|
| macOS | 39300 | Full WPE support |
| Windows | 39300 | Full WPE support |
| Linux | 5323 | Limited WPE functionality |

### Platform Limitations

#### macOS
- **Full Support**: Complete WPE functionality
- **Permissions**: Requires explicit user consent for screen recording
- **Performance**: Best performance with Metal GPU acceleration

#### Windows
- **Full Support**: Complete WPE functionality
- **Permissions**: Generally fewer permission prompts than macOS
- **Performance**: Good performance with DirectX

#### Linux
- **Limited Support**: WPE functionality may be restricted
- **Display Server**: X11 vs Wayland affects screen capture capability
- **Note**: Some WPE endpoints may return errors or empty results on Linux

### Code Example: Platform Detection

```javascript
const os = require('os');

function getPiecesConfig() {
  const platform = os.platform();
  const isLinux = platform === 'linux';
  
  return {
    basePath: `http://localhost:${isLinux ? 5323 : 39300}`,
    platform: platform,
    wpeSupported: !isLinux  // WPE has limited support on Linux
  };
}
```

---

## 5. Known Issues and Common Problems

### Issue 1: WPE Returns Empty Events

**Symptoms**: `visionEvents` is empty array `[]`

**Causes**:
1. WPE not activated
2. Screen recording permissions denied
3. Beta feature not enabled (was beta-only until ~April 2024)
4. User manually disabled WPE in Pieces OS settings

**Solutions**:
```javascript
// Check and report detailed status
async function diagnoseWPE() {
  const status = await wpeApi.workstreamPatternEngineProcessorsVisionStatus();
  const permissions = await osApi.osPermissions().catch(() => null);
  
  console.log('WPE Vision Active:', !!status.vision?.activation);
  console.log('Vision Permission:', permissions?.processing?.vision);
  console.log('Accessibility Permission:', permissions?.processing?.accessibility);
  console.log('Degraded Mode:', status.vision?.degraded);
  
  if (!status.vision?.activation) {
    console.log('⚠️ WPE is not activated. Call activateWPE() first.');
  }
  
  if (permissions && !permissions.processing?.vision) {
    console.log('⚠️ Screen recording permission not granted.');
  }
}
```

### Issue 2: OCR Text is Empty

**Symptoms**: Events returned but `ocrText` is empty

**Causes**:
1. Missing `transferables: true` parameter
2. OCR analysis not complete
3. Screen content not text-rich

**Solutions**:
```javascript
// Always use transferables: true
const snapshot = await wpeApi.workstreamPatternEngineProcessorsVisionEventsSnapshot({
  transferables: true  // REQUIRED for OCR content
});
```

### Issue 3: Permission Denied Errors

**Symptoms**: API calls fail with permission errors

**Causes**:
1. OS-level permissions not granted
2. Pieces OS not running with proper privileges

**Solutions**:
- macOS: Check System Preferences > Security & Privacy > Screen Recording
- Windows: Check Privacy settings
- Request permissions via API: `POST /os/permissions/request`

### Issue 4: Linux Limitations

**Symptoms**: WPE endpoints return errors or empty data on Linux

**Cause**: Linux display server differences (X11 vs Wayland)

**Workaround**:
```javascript
// Graceful degradation for Linux
async function getContextWithFallback() {
  const isLinux = os.platform() === 'linux';
  
  let visionEvents = [];
  if (!isLinux) {
    try {
      visionEvents = await getVisionEvents();
    } catch (e) {
      console.log('WPE not available, using fallback context');
    }
  }
  
  // Always available regardless of WPE
  const [assets, activities, summaries] = await Promise.all([
    getRecentAssets(),
    getRecentActivities(),
    getWorkstreamSummaries()
  ]);
  
  return { visionEvents, assets, activities, summaries };
}
```

### Issue 5: Data Cleanup and Retention

**Symptoms**: Old events still appearing or need to clear data

**Solution**:
```javascript
// Clear vision data for specific time range
async function clearVisionData(fromDate, toDate) {
  const cleanupRequest = {
    ranges: [{
      from: { value: fromDate.toISOString() },
      to: { value: toDate.toISOString() }
    }]
  };
  
  await wpeApi.workstreamPatternEngineProcessorsVisionDataClear({
    workstreamPatternEngineDataCleanupRequest: cleanupRequest
  });
}

// Clear all vision data
async function clearAllVisionData() {
  const cleanupRequest = {
    ranges: [{
      to: { value: new Date().toISOString() }
      // from is unset = clear everything before 'to'
    }]
  };
  
  await wpeApi.workstreamPatternEngineProcessorsVisionDataClear({
    workstreamPatternEngineDataCleanupRequest: cleanupRequest
  });
}
```

### Issue 6: Silent Failures

**Symptoms**: No errors but no data returned

**Diagnostic Approach**:
```javascript
// Comprehensive WPE health check
async function checkWPEHealth() {
  const checks = {
    piecesOSRunning: false,
    wpeApiAccessible: false,
    permissionsGranted: false,
    wpeActivated: false,
    hasEvents: false,
    eventCount: 0
  };
  
  try {
    // 1. Check Pieces OS health
    const health = await wellKnownApi.getWellKnownHealth();
    checks.piecesOSRunning = health.startsWith('ok');
    
    // 2. Check WPE status
    const status = await wpeApi.workstreamPatternEngineProcessorsVisionStatus();
    checks.wpeApiAccessible = true;
    checks.wpeActivated = !!status.vision?.activation;
    
    // 3. Check permissions
    const permissions = await osApi.osPermissions();
    checks.permissionsGranted = permissions.processing?.vision && 
                                permissions.processing?.accessibility;
    
    // 4. Check for events
    const metadata = await wpeApi.workstreamPatternEngineProcessorsVisionMetadata();
    checks.hasEvents = (metadata.events?.count || 0) > 0;
    checks.eventCount = metadata.events?.count || 0;
    
  } catch (error) {
    console.error('Health check failed:', error.message);
  }
  
  return checks;
}
```

---

## 6. Best Practices for Using WPE

### 1. Always Check Status First

```javascript
async function ensureWPEActive() {
  const status = await wpeApi.workstreamPatternEngineProcessorsVisionStatus();
  
  if (!status.vision?.activation) {
    console.log('WPE not active, activating...');
    await activateWPE();
  }
  
  return status;
}
```

### 2. Use Transferables for Full Data

```javascript
// Always pass transferables: true when you need content
const events = await wpeApi.workstreamPatternEngineProcessorsVisionEventsSnapshot({
  transferables: true
});
```

### 3. Handle Linux Gracefully

```javascript
const wpeSupported = os.platform() !== 'linux';

if (!wpeSupported) {
  console.log('WPE has limited support on Linux, using fallback context sources');
}
```

### 4. Cache and Batch Requests

```javascript
// Fetch all context in parallel
const [visionEvents, ocrData, sources] = await Promise.all([
  getVisionEvents().catch(() => []),
  getOCRAnalyses().catch(() => []),
  getVisionSources().catch(() => [])
]);
```

### 5. Respect Privacy

```javascript
// Always inform users what data is being collected
console.log(`Collecting screen context: ${visionEvents.length} recent events`);
```

---

## 7. Complete Integration Example

```javascript
const pieces = require('@pieces.app/pieces-os-client');
const os = require('os');

class WPEContextProvider {
  constructor() {
    const port = os.platform() === 'linux' ? 5323 : 39300;
    this.configuration = new pieces.Configuration({
      basePath: `http://localhost:${port}`
    });
    
    this.wpeApi = new pieces.WorkstreamPatternEngineApi(this.configuration);
    this.osApi = new pieces.OSApi(this.configuration);
  }

  async getRichContext() {
    const isLinux = os.platform() === 'linux';
    
    if (isLinux) {
      console.log('⚠️ WPE has limited support on Linux');
      return { visionEvents: [], ocrAnalyses: [], sources: [] };
    }

    try {
      // Check WPE status
      const status = await this.wpeApi.workstreamPatternEngineProcessorsVisionStatus();
      
      if (!status.vision?.activation) {
        console.log('⚠️ WPE not activated. Some context may be missing.');
      }

      // Fetch all WPE data in parallel
      const [visionEvents, ocrAnalyses, sources, metadata] = await Promise.all([
        this.wpeApi.workstreamPatternEngineProcessorsVisionEventsSnapshot({
          transferables: true
        }).then(s => s.iterable || []).catch(() => []),
        
        new pieces.OCRAnalysesApi(this.configuration).ocrAnalysesSnapshot({
          transferables: true
        }).then(s => s.iterable || []).catch(() => []),
        
        this.wpeApi.workstreamPatternEngineProcessorsSources()
          .then(s => s.iterable || []).catch(() => []),
          
        this.wpeApi.workstreamPatternEngineProcessorsVisionMetadata()
          .catch(() => null)
      ]);

      console.log(`✓ WPE Context: ${visionEvents.length} events, ${ocrAnalyses.length} OCR, ${sources.length} sources`);
      console.log(`  Metadata: ${metadata?.events ? metadata.events.count + ' total events' : 'N/A'}`);

      return {
        visionEvents: visionEvents.slice(0, 30).map(e => ({
          id: e.id,
          created: e.created?.value,
          application: e.source?.application,
          window: e.source?.window,
          url: e.source?.url,
          ocrText: e.textual?.ocr?.raw?.substring(0, 500) // Truncate long text
        })),
        ocrAnalyses: ocrAnalyses.slice(0, 10).map(a => ({
          id: a.id,
          text: a.raw?.string?.raw?.substring(0, 500)
        })),
        sources: sources.map(s => ({
          name: s.name,
          application: s.application
        })),
        wpeActive: !!status.vision?.activation,
        totalEvents: metadata?.events?.count || 0
      };

    } catch (error) {
      console.error('✗ Error fetching WPE context:', error.message);
      return { visionEvents: [], ocrAnalyses: [], sources: [], error: error.message };
    }
  }
}

module.exports = WPEContextProvider;
```

---

## 8. Summary Checklist for WPE Implementation

- [ ] **Check Platform**: WPE has limited Linux support
- [ ] **Verify Permissions**: Screen recording and accessibility permissions granted
- [ ] **Activate WPE**: Call activate endpoint if not already active
- [ ] **Use Transferables**: Always pass `transferables: true` for content
- [ ] **Handle Failures**: Gracefully fall back to other context sources
- [ ] **Respect Privacy**: Inform users about data collection
- [ ] **Monitor Status**: Check activation status before relying on WPE data
- [ ] **Batch Requests**: Use Promise.all for multiple WPE queries

---

## Key Takeaways

1. **WPE is the richest context source** but requires activation and permissions
2. **Silent failures are common** - always check status and handle errors
3. **Linux has limited support** - implement graceful degradation
4. **transferables: true is required** to get actual OCR text content
5. **Permissions are OS-level** - macOS requires explicit screen recording consent
6. **Privacy-first design** - users can disable WPE at any time in Pieces OS settings
