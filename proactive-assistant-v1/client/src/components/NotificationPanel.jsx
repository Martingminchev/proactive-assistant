/**
 * Notification Panel Component
 * Displays in-app notifications with action buttons
 */

import React, { useState, useEffect, useCallback } from 'react';
import notificationClient from '../services/notificationClient';
import './NotificationPanel.css';

// Notification type icons
const typeIcons = {
  stuck: '🔧',
  suggestion: '💡',
  wellness: '☕',
  celebration: '🎉',
  contextRecovery: '📂',
  focus: '🎯',
  custom: '📬',
  test: '🧪'
};

// Priority styles
const priorityStyles = {
  critical: 'notification-critical',
  high: 'notification-high',
  normal: 'notification-normal',
  low: 'notification-low'
};

/**
 * Single Notification Item
 */
function NotificationItem({ notification, onDismiss, onAction }) {
  const [isExiting, setIsExiting] = useState(false);
  const [isActioning, setIsActioning] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(notification.clientId);
    }, 300);
  }, [notification.clientId, onDismiss]);

  const handleAction = useCallback(async (action) => {
    setIsActioning(true);
    try {
      await onAction(notification.id, action.id);
      
      // Dismiss after action if it's a dismiss-type action
      if (action.type === 'dismiss' || action.type === 'primary') {
        handleDismiss();
      }
    } finally {
      setIsActioning(false);
    }
  }, [notification.id, action, onAction, handleDismiss]);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const icon = typeIcons[notification.type] || typeIcons.custom;
  const priorityClass = priorityStyles[notification.priority] || priorityStyles.normal;

  return (
    <div 
      className={`notification-item ${priorityClass} ${isExiting ? 'exiting' : ''} ${notification.read ? 'read' : ''}`}
    >
      <div className="notification-header">
        <span className="notification-icon">{icon}</span>
        <span className="notification-type">{notification.type}</span>
        <span className="notification-time">{formatTime(notification.receivedAt)}</span>
        <button 
          className="notification-close" 
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      
      <h4 className="notification-title">{notification.title}</h4>
      {notification.body && (
        <p className="notification-body">{notification.body}</p>
      )}
      
      {notification.actions && notification.actions.length > 0 && (
        <div className="notification-actions">
          {notification.actions.map(action => (
            <button
              key={action.id}
              className={`notification-action ${action.type}`}
              onClick={() => handleAction(action)}
              disabled={isActioning}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Notification Panel
 */
export function NotificationPanel({ maxNotifications = 5, className = '' }) {
  const [notifications, setNotifications] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load notifications on mount
  useEffect(() => {
    const loadNotifications = () => {
      const notifs = notificationClient.getInAppNotifications({ limit: maxNotifications });
      setNotifications(notifs.filter(n => !n.dismissed));
      setUnreadCount(notifs.filter(n => !n.read && !n.dismissed).length);
    };

    loadNotifications();

    // Subscribe to events
    const unsubscribers = [
      notificationClient.on('inAppNotification', loadNotifications),
      notificationClient.on('notificationRead', loadNotifications),
      notificationClient.on('notificationDismissed', loadNotifications),
      notificationClient.on('notificationsCleared', loadNotifications)
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [maxNotifications]);

  const handleDismiss = useCallback((clientId) => {
    notificationClient.dismissInApp(clientId);
  }, []);

  const handleAction = useCallback(async (notificationId, actionId) => {
    return notificationClient.handleAction(notificationId, actionId);
  }, []);

  const handleClearAll = useCallback(() => {
    notificationClient.clearInApp();
  }, []);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Mark all as read when panel is opened
  useEffect(() => {
    if (isExpanded) {
      notifications.forEach(n => {
        if (!n.read) {
          notificationClient.markAsRead(n.clientId);
        }
      });
    }
  }, [isExpanded, notifications]);

  const visibleNotifications = isExpanded 
    ? notifications 
    : notifications.slice(0, 1);

  if (notifications.length === 0) {
    return (
      <div className={`notification-panel empty ${className}`}>
        <div className="notification-empty">
          <span className="notification-empty-icon">📭</span>
          <p>No notifications</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`notification-panel ${isExpanded ? 'expanded' : ''} ${className}`}>
      <div className="notification-panel-header" onClick={toggleExpanded}>
        <h3>
          <span className="notification-bell">🔔</span>
          Notifications
          {unreadCount > 0 && (
            <span className="notification-badge">{unreadCount}</span>
          )}
        </h3>
        <button className="notification-toggle">
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      <div className="notification-list">
        {visibleNotifications.map(notification => (
          <NotificationItem
            key={notification.clientId}
            notification={notification}
            onDismiss={handleDismiss}
            onAction={handleAction}
          />
        ))}

        {!isExpanded && notifications.length > 1 && (
          <button 
            className="notification-show-more"
            onClick={toggleExpanded}
          >
            + {notifications.length - 1} more
          </button>
        )}
      </div>

      {isExpanded && notifications.length > 0 && (
        <div className="notification-footer">
          <button 
            className="notification-clear-all"
            onClick={handleClearAll}
          >
            Clear All
          </button>
          <span className="notification-count">
            {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Notification Toast
 * Floating toast notification
 */
export function NotificationToast({ notification, onClose, duration = 5000 }) {
  const [progress, setProgress] = useState(100);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (!duration) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (elapsed >= duration) {
        clearInterval(interval);
        handleClose();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const handleAction = async (action) => {
    await notificationClient.handleAction(notification.id, action.id);
    if (action.type === 'dismiss' || action.type === 'primary') {
      handleClose();
    }
  };

  const icon = typeIcons[notification.type] || typeIcons.custom;

  return (
    <div className={`notification-toast ${isExiting ? 'exiting' : ''}`}>
      <div 
        className="notification-toast-progress"
        style={{ width: `${progress}%` }}
      />
      <div className="notification-toast-content">
        <span className="notification-toast-icon">{icon}</span>
        <div className="notification-toast-text">
          <h4>{notification.title}</h4>
          {notification.body && <p>{notification.body}</p>}
        </div>
        <button className="notification-toast-close" onClick={handleClose}>
          ×
        </button>
      </div>
      {notification.actions && (
        <div className="notification-toast-actions">
          {notification.actions.slice(0, 2).map(action => (
            <button
              key={action.id}
              className={`notification-toast-action ${action.type}`}
              onClick={() => handleAction(action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Notification Toast Container
 * Manages multiple toast notifications
 */
export function NotificationToastContainer({ position = 'top-right' }) {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleNotification = (notification) => {
      // Only show toast for high priority notifications
      if (notification.priority === 'high' || notification.priority === 'critical') {
        setToasts(prev => [...prev, { ...notification, toastId: Date.now() }]);
      }
    };

    const unsubscribe = notificationClient.on('notification', handleNotification);
    return unsubscribe;
  }, []);

  const removeToast = (toastId) => {
    setToasts(prev => prev.filter(t => t.toastId !== toastId));
  };

  return (
    <div className={`notification-toast-container ${position}`}>
      {toasts.map(toast => (
        <NotificationToast
          key={toast.toastId}
          notification={toast}
          onClose={() => removeToast(toast.toastId)}
        />
      ))}
    </div>
  );
}

export default NotificationPanel;
