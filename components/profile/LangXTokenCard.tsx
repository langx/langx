import React from "react";
import { StyleSheet, View, Text, Image, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import images from "@/constants/images";

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
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.titleContainer}>
          <Text style={styles.cardTitle}>LangX Token</Text>
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
        <Text style={styles.cardSubtitle}>Your LangX Token Balance</Text>
      </View>
      <View style={styles.cardContent}>
        <Pressable style={styles.item} onPress={openTokenDetails}>
          <Image
            source={images.token}
            style={styles.thumbnail}
            accessibilityLabel="Token Image"
          />
          <View style={styles.labelContainer}>
            {wallet.balance ? (
              <Text style={styles.balance}>{wallet.balance}</Text>
            ) : (
              <Text style={styles.noBalance}>No balance available</Text>
            )}
          </View>
          <View style={styles.metadataEndWrapper}></View>
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
          <Text style={styles.leaderboardLabel}>Leaderboard</Text>
        </Pressable>
      </View>
    </View>
  );
};

export default LangXTokenCard;

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
  hasIcon: {
    marginTop: 10,
  },
  icon: {
    marginRight: 20,
  },
  leaderboardLabel: {
    fontSize: 16,
    color: "#555",
  },
});
