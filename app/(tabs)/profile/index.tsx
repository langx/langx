import React from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import images from "@/constants/images";

const mockUser = {
  name: "John Doe",
  profilePic: images.profile,
  birthdate: "1990-01-01",
  gender: "male",
  country: "US",
  lastSeen: "2024-07-01T12:00:00Z",
  contributors: [1, 2, 3],
  sponsor: true,
};

const getAge = (birthdate: string) => {
  const birthDate = new Date(birthdate);
  const ageDiffMs = Date.now() - birthDate.getTime();
  const ageDate = new Date(ageDiffMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

const lastSeen = (lastSeenDate: string) => {
  const lastSeenTime = new Date(lastSeenDate).getTime();
  const currentTime = new Date().getTime();
  const diffMinutes = Math.floor((currentTime - lastSeenTime) / (1000 * 60));

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} minutes`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hours`;
  return `${Math.floor(diffMinutes / 1440)} days`;
};

const getFlagEmoji = (country: string) => {
  const codePoints = country
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

export default function ProfileCard() {
  const user = mockUser;
  const isLoading = false;
  const msgButton = true;

  return (
    <>
      <StatusBar />
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
            <Text
              style={[styles.cardSubtitle, { color: Colors.light.primary }]}
            >
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
    </>
  );
}

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
