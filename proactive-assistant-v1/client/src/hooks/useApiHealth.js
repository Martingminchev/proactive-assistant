import { useState, useEffect } from 'react';
import { api } from '../api/client';

/**
 * Hook for monitoring API health
 */
export function useApiHealth(checkInterval = 30000) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'connected' | 'disconnected'
  const [healthData, setHealthData] = useState(null);

  useEffect(() => {
    let mounted = true;

    const checkHealth = async () => {
      try {
        const data = await api.health.check();
        if (mounted) {
          setStatus(data.status === 'ok' ? 'connected' : 'disconnected');
          setHealthData(data);
        }
      } catch (err) {
        if (mounted) {
          setStatus('disconnected');
          setHealthData(null);
        }
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, checkInterval);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [checkInterval]);

  const retry = async () => {
    setStatus('checking');
    try {
      const data = await api.health.check();
      setStatus(data.status === 'ok' ? 'connected' : 'disconnected');
      setHealthData(data);
    } catch (err) {
      setStatus('disconnected');
      setHealthData(null);
    }
  };

  return { status, healthData, retry };
}
