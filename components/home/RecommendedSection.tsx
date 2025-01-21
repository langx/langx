import { useEffect, forwardRef, useImperativeHandle, useCallback } from "react";
import {
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, Href } from "expo-router";

import { Colors } from "@/constants/Colors";
import { useDatabase } from "@/hooks/useDatabase";
import { listUsers } from "@/services/userService";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import UserCard from "@/components/home/UserCard";

interface RecommendedSectionProps {
  currentUserId: string;
  filterData?: string;
  searchText?: string;
}

const RecommendedSection = forwardRef((props: RecommendedSectionProps, ref) => {
  const { currentUserId, filterData = null, searchText = "" } = props;

  const {
    data: users,
    loading,
    loadMore,
    refetch,
    hasMore,
  } = useDatabase(listUsers, { userId: currentUserId, filterData, searchText });

  useEffect(() => {
    console.log("recommended users:", users?.length);
  }, [users]);

  useImperativeHandle(ref, () => ({
    refetch,
  }));

  const onEndReached = () => {
    if (hasMore && !loading) {
      loadMore();
    }
  };

  const renderFooter = useCallback(() => {
    if (!hasMore) return null;
    if (loading) {
      return (
        <ThemedView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </ThemedView>
      );
    }
  }, [hasMore, loading]);

  return (
    <ThemedView style={styles.card}>
      {/* Header Section */}
      <ThemedView style={styles.cardHeader}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText style={styles.cardTitle}>For You</ThemedText>
          <Pressable
            style={styles.infoButton}
            onPress={() => router.push("(home)/recommended" as Href)}
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
      {/* Body Section */}
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
