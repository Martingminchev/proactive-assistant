import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';

/**
 * Hook for managing briefs data and operations
 */
export function useBriefs() {
  const [todayBrief, setTodayBrief] = useState(null);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  
  // Use ref to track polling interval
  const pollRef = useRef(null);

  const fetchToday = useCallback(async () => {
    try {
      const data = await api.briefs.getToday();
      if (!data.message) {
        setTodayBrief(data);
        return data;
      }
      return null;
    } catch (err) {
      console.error('Failed to fetch today\'s brief:', err);
      return null;
    }
  }, []);

  const fetchHistory = useCallback(async (limit = 10) => {
    try {
      const data = await api.briefs.getHistory(limit);
      setHistory(data.briefs || []);
      return data;
    } catch (err) {
      console.error('Failed to fetch history:', err);
      return null;
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.briefs.getStats();
      setStats(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      return null;
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([fetchToday(), fetchHistory(), fetchStats()]);
    } catch (err) {
      setError('Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchToday, fetchHistory, fetchStats]);

  const generate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const result = await api.briefs.generate();
      
      if (result.status === 'running') {
        setError('Brief generation already in progress');
        setIsGenerating(false);
        return;
      }

      // Poll for completion
      let attempts = 0;
      const maxAttempts = 30;
      
      // Clear any existing poll
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
      
      pollRef.current = setInterval(async () => {
        attempts++;
        const brief = await fetchToday();
        await fetchStats();
        
        if (brief || attempts >= maxAttempts) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setIsGenerating(false);
          
          if (attempts >= maxAttempts && !brief) {
            setError('Generation is taking longer than expected. Please check back in a moment.');
          }
        }
      }, 2000);
      
    } catch (err) {
      setError('Failed to generate brief. Please try again.');
      setIsGenerating(false);
    }
  }, [fetchToday, fetchStats]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, []);

  // Initial load
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  return {
    todayBrief,
    history,
    stats,
    isLoading,
    isGenerating,
    error,
    setError,
    fetchToday,
    fetchHistory,
    fetchStats,
    refreshAll,
    generate,
  };
}
