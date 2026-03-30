# Notification System Examples

## Integration Examples

### 1. Add Notification Panel to Dashboard

Update `client/src/components/Dashboard.jsx`:

```jsx
import { NotificationPanel } from './NotificationPanel';

function Dashboard() {
  return (
    <div className="dashboard">
      <div className="dashboard-sidebar">
        <NotificationPanel maxNotifications={3} />
      </div>
      {/* rest of dashboard */}
    </div>
  );
}
```

### 2. Add Toast Container to App

Update `client/src/App.jsx`:

```jsx
import { NotificationToastContainer } from './components/NotificationPanel';

function App() {
  return (
    <>
      <Router>
        {/* routes */}
      </Router>
      <NotificationToastContainer position="top-right" />
    </>
  );
}
```

### 3. Send Notification from Proactive Assistant

Update `server/jobs/proactiveAssistantJob.js`:

```javascript
const notificationService = require('../services/notificationService');

// When detecting stuck user
async function checkIfStuck(context) {
  if (context.errorRate > 0.5 && context.timeOnTask > 20 * 60 * 1000) {
    await notificationService.sendStuckNotification({
      topic: context.currentFile,
      duration: '20 minutes',
      file: context.currentFile
    });
  }
}

// When suggesting wellness break
async function checkWellness(context) {
  if (context.timeSinceBreak > 2 * 60 * 60 * 1000) {
    await notificationService.sendWellnessNotification('break', {
      duration: '2 hours'
    });
  }
}
```

### 4. Handle Stuck Detection API

Update `server/routes/userCenteredRoutes.js`:

```javascript
const notificationService = require('../services/notificationService');

router.get('/stuck-check', async (req, res) => {
  try {
    // ... existing stuck detection logic ...
    
    const isStuck = detectionResult.isStuck;
    
    // Send notification if stuck
    if (isStuck && detectionResult.confidence > 0.7) {
      await notificationService.sendStuckNotification({
        topic: detectionResult.topic || 'this error',
        duration: detectionResult.duration || 'a while',
        file: detectionResult.file
      });
    }
    
    res.json(detectionResult);
  } catch (error) {
    // ... error handling ...
  }
});
```

### 5. Celebration on Goal Achievement

Update `server/routes/preferencesRoutes.js`:

```javascript
const notificationService = require('../services/notificationService');

router.post('/goals/:id/complete', async (req, res) => {
  try {
    // ... mark goal as complete ...
    
    // Send celebration
    await notificationService.sendCelebration({
      text: 'Goal completed: ' + goal.title
    });
    
    res.json({ success: true });
  } catch (error) {
    // ... error handling ...
  }
});
```

### 6. Context Recovery on App Focus

Create `client/src/hooks/useContextRecovery.js`:

```javascript
import { useEffect } from 'react';
import notificationClient from '../services/notificationClient';

export function useContextRecovery() {
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // Check if we've been away for a while
        const awayTime = parseInt(sessionStorage.getItem('awayTime') || '0');
        const now = Date.now();
        
        if (now - awayTime > 30 * 60 * 1000) { // 30 minutes
          // Get context from server
          const response = await fetch('/api/assistant/context-recovery');
          const context = await response.json();
          
          if (context.hasContext) {
            await notificationClient.sendNotification({
              type: 'contextRecovery',
              title: 'Continue where you left off?',
              body: `You were working on ${context.file}. ${context.todos} TODOs remaining.`,
              priority: 'normal',
              data: context
            });
          }
        }
        
        sessionStorage.removeItem('awayTime');
      } else {
        sessionStorage.setItem('awayTime', Date.now().toString());
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
}
```

### 7. Custom Action Handler for "Apply Suggestion"

In `server/services/notificationService.js`:

```javascript
// Add to registerDefaultHandlers()
this.registerHandler('apply_suggestion', async (notification, action) => {
  const suggestionId = notification.data?.suggestionId;
  
  // Apply the suggestion
  await applySuggestion(suggestionId);
  
  return { 
    type: 'suggestion_applied', 
    data: { suggestionId, appliedAt: new Date().toISOString() } 
  };
});
```

### 8. Focus Session Complete Notification

In `server/jobs/dailyBriefJob.js` or a new focus job:

```javascript
const notificationService = require('../services/notificationService');

class FocusSessionJob {
  async onSessionComplete(duration) {
    await notificationService.sendFocusComplete(duration);
  }
}
```

### 9. Notification Settings UI

Create `client/src/components/NotificationSettings.jsx`:

```jsx
import { useNotificationSettings } from '../hooks/useNotifications';

export function NotificationSettings() {
  const { settings, loading, updateSettings } = useNotificationSettings();
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div className="notification-settings">
      <h3>Notification Settings</h3>
      
      <label>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={e => updateSettings({ enabled: e.target.checked })}
        />
        Enable notifications
      </label>
      
      <label>
        <input
          type="checkbox"
          checked={settings.soundEnabled}
          onChange={e => updateSettings({ soundEnabled: e.target.checked })}
        />
        Play sounds
      </label>
      
      <label>
        <input
          type="checkbox"
          checked={settings.respectDoNotDisturb}
          onChange={e => updateSettings({ respectDoNotDisturb: e.target.checked })}
        />
        Respect Do Not Disturb
      </label>
      
      <label>
        Max per hour:
        <input
          type="number"
          value={settings.maxPerHour}
          onChange={e => updateSettings({ maxPerHour: parseInt(e.target.value) })}
          min={1}
          max={50}
        />
      </label>
      
      <label>
        Minimum priority:
        <select
          value={settings.minPriority}
          onChange={e => updateSettings({ minPriority: e.target.value })}
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </label>
    </div>
  );
}
```

### 10. Test Notification Button

Add to `client/src/components/Settings.jsx`:

```jsx
import { useNotifications } from '../hooks/useNotifications';

function Settings() {
  const { sendTestNotification } = useNotifications();
  
  return (
    <div className="settings">
      {/* other settings */}
      
      <div className="settings-section">
        <h3>Notifications</h3>
        <button onClick={sendTestNotification}>
          Send Test Notification
        </button>
      </div>
    </div>
  );
}
```

## Advanced Usage

### Custom Notification Template

```javascript
// In server/services/notificationService.js

const CUSTOM_TEMPLATES = {
  deploymentComplete: {
    title: '🚀 Deployment Complete!',
    body: '{project} has been deployed to {environment}',
    priority: 'normal',
    actions: [
      { id: 'view', label: 'View Site', type: 'primary' },
      { id: 'logs', label: 'View Logs', type: 'link' },
      { id: 'dismiss', label: 'Dismiss', type: 'dismiss' }
    ]
  }
};

// Usage
await notificationService.send({
  type: 'deploymentComplete',
  title: CUSTOM_TEMPLATES.deploymentComplete.title,
  body: CUSTOM_TEMPLATES.deploymentComplete.body
    .replace('{project}', 'MyApp')
    .replace('{environment}', 'production'),
  priority: CUSTOM_TEMPLATES.deploymentComplete.priority,
  actions: CUSTOM_TEMPLATES.deploymentComplete.actions,
  data: { project: 'MyApp', environment: 'production' }
});
```

### Batch Notifications

```javascript
// Send multiple notifications at once (throttled)
const notifications = [
  { type: 'wellness', title: 'Break time', body: '5 min break suggested' },
  { type: 'suggestion', title: 'Code review', body: '3 PRs need review' },
  { type: 'celebration', title: 'Achievement!', body: '100 commits this month' }
];

for (const notif of notifications) {
  await notificationService.send(notif);
  // Each will be throttled appropriately
}
```

### Conditional Notifications

```javascript
async function notifyIfAppropriate(type, data) {
  // Check DND
  const isDnd = await notificationService.checkDoNotDisturb();
  if (isDnd) {
    console.log('DND is on, queuing for later');
    // Queue for later
    return;
  }
  
  // Check time since last notification
  const stats = notificationService.getStats();
  if (stats.lastHour >= notificationService.settings.maxPerHour) {
    console.log('Max notifications reached for this hour');
    return;
  }
  
  // Send notification
  await notificationService.send({ type, ...data });
}
```
