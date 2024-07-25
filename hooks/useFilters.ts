import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import _ from 'lodash';

export function useFilters(FILTERS_KEY: string) {
  const [filters, setFilters] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadFilters = useCallback(async () => {
    setLoading(true);
    try {
      const savedFilters = await AsyncStorage.getItem(FILTERS_KEY);
      const parsedFilters = savedFilters ? JSON.parse(savedFilters) : null;
      if (!_.isEqual(filters, parsedFilters)) {
        setFilters(parsedFilters);
      }
    } catch (error) {
      console.error('Failed to load filters', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const saveFilters = useCallback(async (newFilters) => {
    setLoading(true);
    try {
      await AsyncStorage.setItem(FILTERS_KEY, JSON.stringify(newFilters));
      setFilters(newFilters);
    } catch (error) {
      console.error('Failed to save filters', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  return {
    filters,
    loading,
    loadFilters,
    saveFilters,
  };
}
