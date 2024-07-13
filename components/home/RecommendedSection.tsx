import React, { useEffect, forwardRef, useImperativeHandle } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Pressable,
} from "react-native";

import { useDatabase } from "@/hooks/useDatabase";
import { listUsers } from "@/services/userService";
import { Colors } from "@/constants/Colors";
import UserCard from "@/components/home/UserCard";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";

interface RecommendedSectionProps {
  currentUserId: string;
  filterData?: any;
}

const RecommendedSection = forwardRef((props: RecommendedSectionProps, ref) => {
  const { currentUserId, filterData = {} } = props;

  const {
    data: users,
    loading,
    loadMore,
    refetch,
    hasMore,
  } = useDatabase(listUsers, { userId: currentUserId });

  useEffect(() => {
    console.log("users", users?.length);
  }, [users]);

  useImperativeHandle(ref, () => ({
    refetch,
  }));

  const onEndReached = () => {
    if (hasMore && !loading) {
      loadMore();
    }
  };

  const renderFooter = () => {
    if (!hasMore) return null;
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.card}>
      {/* Header Section */}
      <ThemedView style={styles.cardHeader}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText style={styles.cardTitle}>For You</ThemedText>
          <Pressable
            style={styles.infoButton}
            onPress={() => console.log("Button pressed")}
          >
            <Ionicons
              name="ellipsis-horizontal-circle-outline"
              size={20}
              color={Colors.light.primary}
            />
          </Pressable>
        </ThemedView>
        <ThemedText style={styles.cardSubtitle}>Recommended Users</ThemedText>
      </ThemedView>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        horizontal
        data={users}
        keyExtractor={(item) => item.$id}
        renderItem={({ item }) => <UserCard item={item} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
      />
    </ThemedView>
  );
});

export default RecommendedSection;

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 10,
    overflow: "hidden",
    margin: 10,
  },
  cardHeader: {
    padding: 20,
    alignItems: "center",
  },
  titleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 24,
    fontFamily: "Lexend-Bold",
  },
  cardSubtitle: {
    fontSize: 16,
    marginTop: 5,
  },
  infoButton: {
    padding: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cardBody: {
    height: "auto",
    display: "flex",
  },
});
