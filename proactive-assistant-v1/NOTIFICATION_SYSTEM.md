# Notification System

A rich notification system for the Proactive Assistant that sends native OS notifications with action buttons. Supports Windows, macOS, and Linux.

## Features

- **Cross-platform native notifications** using OS-specific APIs
- **Rich notification templates** for common scenarios
- **Action buttons** that trigger handlers on the server
- **WebSocket support** for real-time notification delivery to the client
- **In-app notification panel** for when the app is open
- **Do Not Disturb detection** respecting OS settings
- **Smart throttling** to prevent notification spam
- **Notification history** and statistics

## Quick Start

### Server Setup

1. Install dependencies:
```bash
cd server
npm install
```

2. The notification service is automatically initialized when the server starts.

### Client Setup

1. The notification client is already integrated. Import it in your components:

```javascript
import notificationClient from './services/notificationClient';
import { useNotifications } from './hooks/useNotifications';
import { NotificationPanel, NotificationToastContainer } from './components/NotificationPanel';
```

## Notification Templates

### 1. Stuck Detection
```javascript
await notificationService.sendStuckNotification({
  topic: 'useEffect',
  duration: '25 minutes',
  error: 'undefined is not a function',
  file: 'src/components/App.jsx'
});
```

**Result:**
- Title: "Stuck on useEffect?"
- Body: "You've been debugging for 25 minutes. I have a solution."
- Actions: Show Fix, I'm Fine, Snooze

### 2. Context Recovery
```javascript
await notificationService.sendContextRecovery({
  file: 'auth.ts',
  todos: '2 TODOs'
});
```

**Result:**
- Title: "Continue where you left off?"
- Body: "You were working on auth.ts. 2 TODOs remaining."
- Actions: Open File, Dismiss

### 3. Wellness
```javascript
await notificationService.sendWellnessNotification('break', { duration: '2 hours' });
```

**Result:**
- Title: "Time for a break?"
- Body: "You've been coding for 2 hours."
- Actions: 5 Min Break, Snooze 30min, Not Now

### 4. Celebration
```javascript
await notificationService.sendCelebration({
  text: '3-day coding streak!'
});
```

**Result:**
- Title: "🔥 You're on fire!"
- Body: "3-day coding streak! Keep it up!"
- Actions: View Stats, Dismiss

## API Endpoints

### Send Custom Notification
```http
POST /api/notifications/send
Content-Type: application/json

{
  "type": "custom",
  "title": "Hello",
  "body": "This is a test",
  "priority": "normal",
  "actions": [
    { "id": "ok", "label": "OK", "type": "primary" }
  ]
}
```

### Template Endpoints
- `POST /api/notifications/stuck` - Send stuck notification
- `POST /api/notifications/context-recovery` - Send context recovery
- `POST /api/notifications/wellness` - Send wellness notification
- `POST /api/notifications/celebration` - Send celebration
- `POST /api/notifications/suggestion` - Send suggestion
- `POST /api/notifications/focus-complete` - Send focus complete

### Action Endpoint
```http
POST /api/notifications/:id/action
Content-Type: application/json

{
  "actionId": "show_fix"
}
```

### Settings & History
- `GET /api/notifications/settings` - Get settings
- `PUT /api/notifications/settings` - Update settings
- `GET /api/notifications/history` - Get history
- `DELETE /api/notifications/history` - Clear history
- `GET /api/notifications/stats` - Get statistics
- `GET /api/notifications/dnd-status` - Check Do Not Disturb
- `GET /api/notifications/templates` - Get template info

## React Hooks

### useNotifications
```javascript
import { useNotifications } from './hooks/useNotifications';

function MyComponent() {
  const {
    notifications,      // Array of in-app notifications
    unreadCount,        // Number of unread notifications
    isConnected,        // WebSocket connection status
    permission,         // Browser notification permission
    markAsRead,         // Function to mark as read
    dismiss,            // Function to dismiss
    clearAll,           // Function to clear all
    handleAction,       // Function to handle action
    requestPermission,  // Function to request permission
    sendTestNotification // Function to send test
  } = useNotifications();
  
  // ...
}
```

### useNotificationSettings
```javascript
import { useNotificationSettings } from './hooks/useNotifications';

function SettingsComponent() {
  const { settings, loading, error, updateSettings } = useNotificationSettings();
  
  // ...
}
```

## Components

### NotificationPanel
```jsx
import { NotificationPanel } from './components/NotificationPanel';

function App() {
  return (
    <NotificationPanel 
      maxNotifications={5}
      className="my-notifications"
    />
  );
}
```

### NotificationToastContainer
```jsx
import { NotificationToastContainer } from './components/NotificationPanel';

function App() {
  return (
    <>
      {/* Your app content */}
      <NotificationToastContainer position="top-right" />
    </>
  );
}
```

Positions: `top-right`, `top-left`, `bottom-right`, `bottom-left`

## Custom Action Handlers

### Server-side
```javascript
const notificationService = require('./services/notificationService');

// Register custom handler
notificationService.registerHandler('my_action', async (notification, action) => {
  console.log('Handling my_action for:', notification.id);
  
  // Do something
  await doSomething(notification.data);
  
  // Return result
  return { type: 'my_action_completed', data: { success: true } };
});
```

### Client-side
```javascript
import notificationClient from './services/notificationClient';

// Register custom handler
notificationClient.registerActionHandler('my_action', (data) => {
  console.log('My action triggered:', data);
  // Update UI, etc.
});
```

## Settings

### Server Settings
```javascript
{
  enabled: true,              // Master switch
  soundEnabled: true,         // Play sounds
  respectDoNotDisturb: true,  // Check OS DND
  minPriority: 'low',         // Minimum priority to show
  maxPerHour: 10,             // Max notifications per hour
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00'
  }
}
```

Update via API:
```http
PUT /api/notifications/settings
Content-Type: application/json

{
  "enabled": true,
  "maxPerHour": 15
}
```

### Client Settings
```javascript
// Enable/disable in-app notifications
notificationClient.setInAppEnabled(true);

// Enable/disable native notifications
notificationClient.setNativeEnabled(true);
```

## Platform-Specific Notes

### Windows
- Uses PowerShell to show notifications
- Checks Focus Assist status
- Notifications appear in Action Center

### macOS
- Uses `osascript` for notifications
- Checks Do Not Disturb via defaults
- Notifications appear in Notification Center

### Linux
- Uses `notify-send` for notifications
- Checks GNOME notification settings
- Supports urgency levels

## WebSocket

The client automatically connects to the WebSocket endpoint at `ws://localhost:3001/notifications` to receive real-time notifications.

### Reconnection
- Max 5 reconnection attempts
- 3-second delay between attempts
- Events: `connected`, `disconnected`, `error`

## Testing

Send a test notification:
```javascript
// Via API
await notificationClient.sendTestNotification();

// Via hook
const { sendTestNotification } = useNotifications();
await sendTestNotification();

// Via server
await notificationService.send({
  type: 'test',
  title: 'Test',
  body: 'Testing notifications'
});
```

## Architecture

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│  Client (React) │◄──────────────────►│  Server (Node)  │
│                 │                    │                 │
│ - Notification  │                    │ - Notification  │
│   Panel         │      HTTP API      │   Service       │
│ - Toast         │◄──────────────────►│ - Templates     │
│   Container     │                    │ - Action        │
│ - useNotifications                  │   Handlers      │
│                 │                    │                 │
└─────────────────┘                    └────────┬────────┘
                                                │
                    ┌───────────────────────────┼───────────┐
                    │                           │           │
               Native OS                    History    Do Not Disturb
               Notifications                & Stats    Check
```

## Files

### Server
- `server/services/notificationService.js` - Core notification service
- `server/routes/notificationRoutes.js` - API routes

### Client
- `client/src/services/notificationClient.js` - Client service
- `client/src/hooks/useNotifications.js` - React hooks
- `client/src/components/NotificationPanel.jsx` - UI components
- `client/src/components/NotificationPanel.css` - Styles
