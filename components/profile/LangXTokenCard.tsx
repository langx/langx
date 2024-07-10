import React from "react";
import { StyleSheet, Image, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import images from "@/constants/images";

import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";

const mockWallet = {
  balance: 12345.67,
};

const LangXTokenCard = ({ wallet = mockWallet }) => {
  const openPage = (url) => {
    console.log("Open page:", url);
  };

  const openTokenDetails = () => {
    console.log("Open token details");
  };

  const openTokenLeaderboard = () => {
    console.log("Open token leaderboard");
  };

  return (
    <ThemedView style={styles.card}>
      <ThemedView style={styles.cardHeader}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText style={styles.cardTitle}>LangX Token</ThemedText>
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
          Your LangX Token Balance
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.cardContent}>
        <Pressable style={styles.item} onPress={openTokenDetails}>
          <Image
            source={images.token}
            style={styles.thumbnail}
            accessibilityLabel="Token Image"
          />
          <ThemedView style={styles.labelContainer}>
            {wallet.balance ? (
              <ThemedText style={styles.balance}>{wallet.balance}</ThemedText>
            ) : (
              <ThemedText style={styles.noBalance}>
                No balance available
              </ThemedText>
            )}
          </ThemedView>
          <ThemedView style={styles.metadataEndWrapper}></ThemedView>
        </Pressable>
        <Pressable
          style={[styles.item, styles.hasIcon]}
          onPress={openTokenLeaderboard}
        >
          <Ionicons
            name="trophy-outline"
            size={24}
            color={Colors.light.primary}
            style={styles.icon}
          />
          <ThemedText style={styles.leaderboardLabel}>Leaderboard</ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
};

export default LangXTokenCard;

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
  },
  metadataEndWrapper: {},
  hasIcon: {
    marginTop: 10,
  },
  icon: {
    marginRight: 20,
  },
  leaderboardLabel: {
    fontSize: 16,
  },
});
