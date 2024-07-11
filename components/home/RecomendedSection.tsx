import React, { useEffect, forwardRef, useImperativeHandle } from "react";
import {
  FlatList,
  ActivityIndicator,
  View,
  StyleSheet,
  Pressable,
} from "react-native";
import { useDatabase } from "@/hooks/useDatabase";
import { listUsers } from "@/services/userService";
import UserCard from "@/components/home/UserCard";
import { Colors } from "@/constants/Colors";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { Ionicons } from "@expo/vector-icons";

const RecomendedSection = forwardRef((props, ref) => {
  const {
    data: users,
    loading,
    loadMore,
    refetch,
    hasMore,
  } = useDatabase(listUsers);

  useImperativeHandle(ref, () => ({
    refetch,
  }));

  useEffect(() => {
    loadMore(); // Initial load
  }, []);

  const renderFooter = () => {
    if (!hasMore) return null;
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
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
        renderItem={({ item }) => (
          <UserCard item={item} loadingItem={loading} />
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
      />
    </ThemedView>
  );
});

export default RecomendedSection;

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
});
