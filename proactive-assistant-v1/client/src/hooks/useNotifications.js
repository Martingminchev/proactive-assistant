/**
 * useNotifications Hook
 * React hook for working with notifications
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import notificationClient from '../services/notificationClient';

/**
 * Hook for notification functionality
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [permission, setPermission] = useState('default');
  
  // Use ref to track if we've initialized
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Set initial permission
    setPermission(notificationClient.permission);

    // Subscribe to events
    const unsubscribers = [
      notificationClient.on('connected', () => setIsConnected(true)),
      notificationClient.on('disconnected', () => setIsConnected(false)),
      
      notificationClient.on('inAppNotification', (notification) => {
        setNotifications(prev => [notification, ...prev]);
        updateUnreadCount();
      }),
      
      notificationClient.on('notificationRead', () => updateUnreadCount()),
      notificationClient.on('notificationDismissed', () => updateUnreadCount()),
      notificationClient.on('notificationsCleared', () => {
        setNotifications([]);
        setUnreadCount(0);
      })
    ];

    // Load initial notifications
    loadNotifications();

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  const updateUnreadCount = useCallback(() => {
    const unread = notificationClient.getInAppNotifications({ unreadOnly: true });
    setUnreadCount(unread.length);
  }, []);

  const loadNotifications = useCallback(() => {
    const notifs = notificationClient.getInAppNotifications();
    setNotifications(notifs);
    updateUnreadCount();
  }, [updateUnreadCount]);

  const markAsRead = useCallback((clientId) => {
    notificationClient.markAsRead(clientId);
    loadNotifications();
  }, [loadNotifications]);

  const dismiss = useCallback((clientId) => {
    notificationClient.dismissInApp(clientId);
    loadNotifications();
  }, [loadNotifications]);

  const clearAll = useCallback(() => {
    notificationClient.clearInApp();
  }, []);

  const handleAction = useCallback(async (notificationId, actionId) => {
    return notificationClient.handleAction(notificationId, actionId);
  }, []);

  const requestPermission = useCallback(async () => {
    await notificationClient.requestPermission();
    setPermission(notificationClient.permission);
  }, []);

  const sendTestNotification = useCallback(async () => {
    return notificationClient.sendNotification({
      type: 'test',
      title: 'Test Notification',
      body: 'This is a test notification from Proactive Assistant',
      priority: 'normal'
    });
  }, []);

  return {
    notifications,
    unreadCount,
    isConnected,
    permission,
    markAsRead,
    dismiss,
    clearAll,
    handleAction,
    requestPermission,
    sendTestNotification,
    refresh: loadNotifications
  };
}

/**
 * Hook for a single notification's state
 */
export function useNotification(clientId) {
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const notifs = notificationClient.getInAppNotifications();
    const found = notifs.find(n => n.clientId === clientId);
    setNotification(found);

    const unsubscribe = notificationClient.on('inAppNotification', (notif) => {
      if (notif.clientId === clientId) {
        setNotification(notif);
      }
    });

    return unsubscribe;
  }, [clientId]);

  const markAsRead = useCallback(() => {
    if (notification) {
      notificationClient.markAsRead(notification.clientId);
    }
  }, [notification]);

  const dismiss = useCallback(() => {
    if (notification) {
      notificationClient.dismissInApp(notification.clientId);
    }
  }, [notification]);

  const handleAction = useCallback((actionId) => {
    if (notification) {
      return notificationClient.handleAction(notification.id, actionId);
    }
  }, [notification]);

  return {
    notification,
    markAsRead,
    dismiss,
    handleAction
  };
}

/**
 * Hook for notification settings
 */
export function useNotificationSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await notificationClient.getSettings();
      setSettings(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      setLoading(true);
      const data = await notificationClient.updateSettings(newSettings);
      setSettings(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    settings,
    loading,
    error,
    updateSettings,
    refresh: loadSettings
  };
}

/**
 * Hook for notification history/stats
 */
export function useNotificationStats() {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await notificationClient.getStats();
      setStats(data);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (options = {}) => {
    try {
      setLoading(true);
      const data = await notificationClient.getHistory(options);
      setHistory(data);
    } finally {
      setLoading(false);
    }
  };

  return {
    stats,
    history,
    loading,
    loadStats,
    loadHistory
  };
}
