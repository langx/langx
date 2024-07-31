import { useEffect, useState, useCallback } from 'react';

import { PAGINATION_LIMIT } from '@/constants/config';
import { showToast } from '@/constants/toast';

interface Params {
  userId?: string;
  roomId?: string;
  filterData?: Object;
  searchText?: string;
  initialOffset?: number;
}

export function useDatabase(fn: Function, params: Params = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(params.initialOffset || 0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchData = async (currentOffset) => {
    setLoading(true);
    try {
      const res = await fn({ ...params, currentOffset });
      if (currentOffset === 0) {
        setData(res);
      } else {
        setData((prevData) => [...prevData, ...res]);
      }
      setHasMore(res.length > 0);
    } catch (error) {
      showToast('error', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(offset);
  }, [offset]);

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      setIsLoadingMore(true);
      setOffset((prevOffset) => prevOffset + PAGINATION_LIMIT);
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore]);

  const refetch = () => {
    setOffset(0);
    fetchData(0);
  };

  return { data, loading, loadMore, refetch, setOffset, hasMore };
}
