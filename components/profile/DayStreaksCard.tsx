import React from "react";
import { StyleSheet, View, Text, Image, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import images from "@/constants/images";

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
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.titleContainer}>
          <Text style={styles.cardTitle}>Day Streaks</Text>
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
        </View>
        <Text style={styles.cardSubtitle}>Your Progress in Streak</Text>
      </View>
      <View style={styles.cardContent}>
        <Pressable style={styles.item} onPress={openLeaderboard}>
          <Image
            source={images.chain}
            style={styles.thumbnail}
            accessibilityLabel="Day Streaks Badge"
          />
          <View style={styles.labelContainer}>
            {streak ? (
              <Text style={styles.balance}>{streak.daystreak}</Text>
            ) : (
              <Text style={styles.noBalance}>No streaks available</Text>
            )}
          </View>
          <View style={styles.metadataEndWrapper}></View>
        </Pressable>
      </View>
    </View>
  );
};

export default DayStreaksCard;

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    overflow: "hidden",
    margin: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
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
    fontWeight: "bold",
  },
  infoButton: {
    padding: 5,
  },
  cardSubtitle: {
    fontSize: 16,
    color: "#555",
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
