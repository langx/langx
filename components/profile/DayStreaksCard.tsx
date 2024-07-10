import React from "react";
import { StyleSheet, Image, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import images from "@/constants/images";

import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";

const mockStreak = {
  daystreak: 15,
};

const DayStreaksCard = ({ streak = mockStreak }) => {
  const openPage = (url) => {
    console.log("Open page:", url);
  };

  const openLeaderboard = () => {
    console.log("Open leaderboard");
  };

  return (
    <ThemedView style={styles.card}>
      <ThemedView style={styles.cardHeader}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText style={styles.cardTitle}>Day Streaks</ThemedText>
          <Pressable
            style={styles.infoButton}
            onPress={() => openPage("infoURL")}
          >
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={Colors.light.primary}
            />
          </Pressable>
        </ThemedView>
        <ThemedText style={styles.cardSubtitle}>
          Your Progress in Streak
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.cardContent}>
        <Pressable style={styles.item} onPress={openLeaderboard}>
          <Image
            source={images.chain}
            style={styles.thumbnail}
            accessibilityLabel="Day Streaks Badge"
          />
          <ThemedView style={styles.labelContainer}>
            {streak ? (
              <ThemedText style={styles.balance}>{streak.daystreak}</ThemedText>
            ) : (
              <ThemedText style={styles.noBalance}>
                No streaks available
              </ThemedText>
            )}
          </ThemedView>
          <ThemedView style={styles.metadataEndWrapper}></ThemedView>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
};

export default DayStreaksCard;

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    overflow: "hidden",
    margin: 10,
  },
  cardHeader: {
    padding: 20,
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
  infoButton: {
    padding: 5,
  },
  cardSubtitle: {
    fontSize: 16,
    marginTop: 5,
  },
  cardContent: {
    padding: 20,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  thumbnail: {
    width: 75,
    height: 75,
    borderRadius: 10,
    marginRight: 20,
  },
  labelContainer: {
    flex: 1,
  },
  balance: {
    fontSize: 20,
    fontWeight: "bold",
  },
  noBalance: {
    fontSize: 16,
    color: "#555",
  },
  metadataEndWrapper: {},
});
