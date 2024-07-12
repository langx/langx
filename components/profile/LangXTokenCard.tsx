import React, { useEffect, useState } from "react";
import { StyleSheet, Image, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import images from "@/constants/images";
import { Colors } from "@/constants/Colors";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { useDatabase } from "@/hooks/useDatabase";
import { getWallet } from "@/services/walletService";
import { sampleWallet } from "@/constants/sampleWallet";
import { bigNumber } from "@/constants/utils";

const LangXTokenCard = ({ userId, isGuestIn }) => {
  const [wallet, setWallet] = useState({ balance: 0 });
  const { data: realWallet, loading } = useDatabase(() => getWallet(userId), 0);

  useEffect(() => {
    if (isGuestIn) {
      setWallet(sampleWallet);
    } else if (realWallet) {
      setWallet(realWallet[0] || { balance: 0 });
    }
  }, [isGuestIn, realWallet]);

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
            {loading ? (
              <ThemedText style={styles.balance}>
                <ActivityIndicator size="small" color={Colors.light.primary} />
              </ThemedText>
            ) : wallet.balance ? (
              <ThemedText style={styles.balance}>
                {bigNumber(wallet.balance)}
              </ThemedText>
            ) : (
              <ThemedText style={styles.noBalance}>
                No balance available
              </ThemedText>
            )}
          </ThemedView>
        </Pressable>

        <Pressable
          style={[styles.item, styles.hasIcon]}
          onPress={openTokenLeaderboard}
        >
          <Ionicons
            name="analytics-outline"
            size={24}
            color={Colors.light.primary}
            style={styles.icon}
          />
          <ThemedText style={styles.leaderboardLabel}>Checkouts</ThemedText>
          <Ionicons
            name="chevron-forward-outline"
            size={24}
            color={Colors.light.primary}
            style={styles.detailIcon}
          />
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
          <Ionicons
            name="chevron-forward-outline"
            size={24}
            color={Colors.light.primary}
            style={styles.detailIcon}
          />
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
  titleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoButton: {
    padding: 5,
  },
  cardContent: {
    padding: 20,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 20,
  },
  labelContainer: {
    flex: 1,
  },
  balance: {
    fontSize: 24,
    fontWeight: "bold",
  },
  noBalance: {
    fontSize: 16,
  },
  hasIcon: {
    marginTop: 10,
  },
  icon: {
    marginRight: 20,
  },
  leaderboardLabel: {
    fontSize: 16,
    flex: 1,
  },
  detailIcon: {
    marginLeft: 10,
  },
});
