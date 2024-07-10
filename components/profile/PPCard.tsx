import React from "react";
import { StyleSheet, Image, Pressable } from "react-native";

import { getFlagEmoji, getAge, lastSeen } from "@/constants/utils";
import { Colors } from "@/constants/Colors";
import images from "@/constants/images";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { ThemedButton } from "@/components/themed/atomic/ThemedButton";

const PPCard = ({ user }) => {
  const isLoading = false;
  const msgButton = true;
  return (
    <ThemedView style={styles.card}>
      <ThemedView style={styles.cardHeader}>
        <Pressable onPress={() => console.log("Preview profile picture")}>
          <Image
            source={images.profile}
            style={[
              styles.profilePic,
              user.contributors.length > 0 ? styles.contributor : {},
              user.sponsor ? styles.sponsor : {},
            ]}
            accessibilityLabel="Profile Picture"
          />
        </Pressable>
        <ThemedText style={styles.cardTitle}>{user.name}</ThemedText>
        <ThemedText style={styles.cardSubtitle}>
          {getAge(user.birthdate)} |{" "}
          {user.gender.charAt(0).toUpperCase() + user.gender.slice(1)} |{" "}
          {user.country} {getFlagEmoji(user.country)}
        </ThemedText>
        {lastSeen(user.lastSeen) !== "online" ? (
          <ThemedText style={styles.cardSubtitle}>
            Active {lastSeen(user.lastSeen)} ago
          </ThemedText>
        ) : (
          <ThemedText
            style={[styles.cardSubtitle, { color: Colors.light.primary }]}
          >
            Online
          </ThemedText>
        )}
      </ThemedView>
      {msgButton && (
        <ThemedView style={styles.cardContent}>
          <ThemedButton
            title="Send A Message 🚀"
            onPress={() => console.log("Button pressed")}
            style={styles.button}
          />
        </ThemedView>
      )}
    </ThemedView>
  );
};

export default PPCard;

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
  profilePic: {
    borderRadius: 10,
    width: 200,
    height: 200,
    marginBottom: 10,
  },
  contributor: {
    borderWidth: 3,
    borderColor: Colors.light.primary,
  },
  sponsor: {
    borderWidth: 3,
    borderColor: Colors.light.secondary,
  },
  cardTitle: {
    fontSize: 24,
    fontFamily: "Lexend-Bold",
    textAlign: "center",
  },
  cardSubtitle: {
    fontSize: 16,
    textAlign: "center",
  },
  cardContent: {
    padding: 20,
    alignItems: "center",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
  },
  spinner: {
    marginRight: 10,
  },
});
