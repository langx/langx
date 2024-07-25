import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StyleSheet,
} from "react-native";

import { useDatabase } from "@/hooks/useDatabase";
import { useAuth } from "@/hooks/useAuth";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { listUsers } from "@/services/userService";
import UserCard from "./UserCard";
import { getNumColumns } from "@/constants/responsive";
import { Colors } from "@/constants/Colors";

const ListUserCard = () => {
  const { currentUser } = useAuth();
  const filters = null;
  // States

  const {
    data: users,
    loading,
    loadMore,
    refetch,
    hasMore,
  } = useDatabase(listUsers, {
    userId: currentUser.$id,
    filterData: filters,
  });

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

  useEffect(() => {
    console.log("recommended page:", users?.length);
  }, [users]);

  const onEndReached = () => {
    if (hasMore && !loading) {
      loadMore();
    }
  };

  // Responsive layout
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

  return (
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
  );
};

export default ListUserCard;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
});
