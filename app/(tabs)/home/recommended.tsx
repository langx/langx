import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import _ from "lodash";

import { Colors } from "@/constants/Colors";
import { useDatabase } from "@/hooks/useDatabase";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useAuth } from "@/hooks/useAuth";
import { listUsers } from "@/services/userService";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import UserCard from "@/components/home/UserCard";

const breakpoints = {
  xs: 0,
  sm: 320,
  md: 480,
  lg: 768,
  xl: 1024,
  xxl: 1440,
  mobile: 640,
};
const getNumColumns = (width) => {
  if (width < breakpoints.sm) return 2; // xs
  else if (width >= breakpoints.sm && width < breakpoints.md) return 2; // sm
  else if (width >= breakpoints.md && width < breakpoints.lg) return 3; // md
  else if (width >= breakpoints.lg && width < breakpoints.xl) return 4; // lg
  else if (width >= breakpoints.xl && width < breakpoints.xxl) return 6; // xl
  else if (width >= breakpoints.xxl) return 8; // xxl
};

export default function RecomendedScreen() {
  const theme = useColorScheme() ?? "light";
  const { currentUser } = useAuth();

  const [filters, setFilters] = useState(null);
  const isFirstRun = useRef(true);

  const {
    data: users,
    loading,
    loadMore,
    refetch,
    hasMore,
  } = useDatabase(listUsers, { userId: currentUser.$id, filterData: filters });

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const savedFilters = await AsyncStorage.getItem("filters");

        if (!_.isEqual(filters, savedFilters)) {
          setFilters(savedFilters);
        }
      } catch (error) {
        console.error("Failed to load filters", error);
      }
    };

    loadFilters();
  }, []);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    console.log("Filters changed", filters);

    if (filters) refetch();
  }, [filters]);

  const [screenWidth, setScreenWidth] = useState(
    Dimensions.get("window").width
  );
  const [numColumns, setNumColumns] = useState(getNumColumns(screenWidth));
  useEffect(() => {
    const updateLayout = () => {
      const newWidth = Dimensions.get("window").width;
      setScreenWidth(newWidth);
      console.log("Screen width changed to", newWidth);
    };

    // Subscribe to dimension changes
    const subscription = Dimensions.addEventListener("change", updateLayout);

    // Return a cleanup function that removes the event listener
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    setNumColumns(getNumColumns(screenWidth));
  }, [screenWidth]);

  useEffect(() => {
    console.log("recommended page:", users?.length);
  }, [users]);

  const onEndReached = () => {
    if (hasMore && !loading) {
      loadMore();
    }
  };

  const renderFooter = useCallback(() => {
    if (!hasMore)
      return (
        <ThemedText style={{ justifyContent: "center", alignItems: "center" }}>
          All items has been loaded
        </ThemedText>
      );
    if (loading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </ThemedView>
      );
    }
  }, [hasMore, loading]);

  return (
    <ThemedView style={{ flex: 1 }}>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={users}
        keyExtractor={(item) => item.$id.toString()}
        key={numColumns}
        numColumns={numColumns}
        renderItem={({ item }) => <UserCard item={item} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
