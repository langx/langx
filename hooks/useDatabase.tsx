import { Alert } from "react-native";
import { useEffect, useState } from "react";

export function useDatabase(fn: Function, initialOffset: number = 0) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(initialOffset);

  const fetchData = async (currentOffset: number) => {
    setLoading(true);
    try {
      const res = await fn(currentOffset);
      setData(res);
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(offset);
  }, [offset]);

  const refetch = () => fetchData(offset);

  return { data, loading, refetch, setOffset };
}
