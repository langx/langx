import { FlatList, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import UserCard from "@/components/home/UserCard";
import { Colors } from "@/constants/Colors";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { ThemedView } from "@/components/themed/atomic/ThemedView";

const FeaturedSection = ({ users, loading }) => {
  return (
    <ThemedView
      style={{
        flex: 1,
      }}
    >
      {/* Header Section */}
      <ThemedView style={styles.cardHeader}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText style={styles.cardTitle}>Enthusiastics</ThemedText>
          <Pressable
            style={styles.infoButton}
            onPress={() => console.log("Button pressed")}
          >
            <Ionicons
              name="list-circle-outline"
              size={20}
              color={Colors.light.primary}
            />
          </Pressable>
        </ThemedView>
        <ThemedText style={styles.cardSubtitle}>Completed Profiles</ThemedText>
      </ThemedView>

      {/* List Section */}
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        horizontal
        data={users}
        keyExtractor={(item) => item.$id}
        renderItem={({ item }) => (
          <UserCard item={item} loadingItem={loading} />
        )}
        style={{ flex: 1 }}
      />
    </ThemedView>
  );
};

export default FeaturedSection;

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
  cardContent: {
    padding: 20,
  },
  infoButton: {
    padding: 5,
  },
});
