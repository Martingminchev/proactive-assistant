import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

/**
 * Hook for managing goals
 */
export function useGoals() {
  const [goals, setGoals] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchGoals = useCallback(async (activeOnly = true) => {
    try {
      const data = activeOnly 
        ? await api.goals.getActive()
        : await api.goals.getAll();
      setGoals(data.goals || []);
      return data;
    } catch (err) {
      console.error('Failed to fetch goals:', err);
      setError('Failed to load goals');
      return null;
    }
  }, []);

  const addGoal = useCallback(async (goal) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.goals.create(goal);
      await fetchGoals();
      return result;
    } catch (err) {
      setError('Failed to add goal');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchGoals]);

  const removeGoal = useCallback(async (id) => {
    try {
      await api.goals.delete(id);
      setGoals(prev => prev.filter(g => g._id !== id));
    } catch (err) {
      console.error('Failed to delete goal:', err);
      setError('Failed to delete goal');
    }
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  return {
    goals,
    isLoading,
    error,
    fetchGoals,
    addGoal,
    removeGoal,
  };
}
