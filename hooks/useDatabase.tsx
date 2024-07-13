import { Alert } from "react-native";
import { useEffect, useState, useCallback } from "react";

import { PAGINATION_LIMIT } from "@/constants/config";

export function useDatabase(
  fn: Function,
  userId: string,
  filterData: Object = {},
  initialOffset: number = 0
) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(initialOffset);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchData = async (currentOffset) => {
    setLoading(true);
    try {
      const res = await fn(userId, filterData, currentOffset);
      if (currentOffset === 0) {
        setData(res);
      } else {
        setData((prevData) => [...prevData, ...res]);
      }
      setHasMore(res.length > 0);
    } catch (error) {
      Alert.alert("Error", error.message);
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
