import React from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  ActivityIndicator,
} from "react-native";

import { getFlagEmoji, getAge, lastSeen } from "@/constants/utils";

import { Colors } from "@/constants/Colors";
import images from "@/constants/images";

const PPCard = ({ user }) => {
  const isLoading = false;
  const msgButton = true;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
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
        <Text style={styles.cardTitle}>{user.name}</Text>
        <Text style={styles.cardSubtitle}>
          {getAge(user.birthdate)} |{" "}
          {user.gender.charAt(0).toUpperCase() + user.gender.slice(1)} |{" "}
          {user.country} {getFlagEmoji(user.country)}
        </Text>
        {lastSeen(user.lastSeen) !== "online" ? (
          <Text style={styles.cardSubtitle}>
            Active {lastSeen(user.lastSeen)} ago
          </Text>
        ) : (
          <Text style={[styles.cardSubtitle, { color: Colors.light.primary }]}>
            Online
          </Text>
        )}
      </View>
      {msgButton && (
        <View style={styles.cardContent}>
          <Pressable
            style={styles.button}
            onPress={() => console.log("Send a message")}
            disabled={isLoading}
          >
            {isLoading && <ActivityIndicator style={styles.spinner} />}
            <Text style={styles.buttonText}>Send A Message 🚀</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

export default PPCard;

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
    fontWeight: "bold",
    textAlign: "center",
  },
  cardSubtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#555",
  },
  cardContent: {
    padding: 20,
    alignItems: "center",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.primary,
    padding: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
  },
  spinner: {
    marginRight: 10,
  },
});
