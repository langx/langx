import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Image,
  Pressable,
  ActivityIndicator,
  ImageStyle,
} from "react-native";

import { getFlagEmoji, getAge, lastSeen } from "@/constants/utils";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/hooks/useAuth";
import { getUserImage } from "@/services/bucketService";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { ThemedButton } from "@/components/themed/atomic/ThemedButton";

const PPCard = ({ user }) => {
  const { currentUser } = useAuth();

  const [imageUri, setImageUri] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchImageUri = async () => {
      if (user?.profilePic) {
        console.log("Fetching image uri...", user.profilePic);
        const uri = await getUserImage(user.profilePic);
        setImageUri(uri.toString());
      }
      setIsLoading(false);
    };

    fetchImageUri();
  }, [user?.profilePic]);

  return (
    <ThemedView style={styles.card}>
      <ThemedView style={styles.cardHeader}>
        <Pressable onPress={() => console.log("Preview profile picture")}>
          <ThemedView style={styles.imageContainer}>
            {isLoading && (
              <ActivityIndicator
                style={styles.loadingIndicator}
                size="large"
                color={Colors.light.primary}
              />
            )}
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={[
                  styles.profilePic as ImageStyle,
                  ...(user.contributors?.length > 0
                    ? [styles.contributor as ImageStyle]
                    : []),
                  ...(user.sponsor ? [styles.sponsor as ImageStyle] : []),
                ]}
                accessibilityLabel="Profile Picture"
                onLoadStart={() => setIsLoading(true)}
                onLoadEnd={() => setIsLoading(false)}
              />
            ) : (
              <ActivityIndicator size="large" />
            )}
          </ThemedView>
        </Pressable>
        <ThemedText style={styles.cardTitle}>{user.name}</ThemedText>
        <ThemedText style={styles.cardSubtitle}>
          {getAge(user.birthdate)} |{" "}
          {user.gender.charAt(0).toUpperCase() + user.gender.slice(1)} |{" "}
          {user.country} {getFlagEmoji(user.countryCode)}
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
      {currentUser?.$id !== user?.$id && (
        <ThemedView style={styles.cardContent}>
          <ThemedButton
            title="Send A Message"
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
  imageContainer: {
    position: "relative",
    width: 200,
    height: 200,
    marginBottom: 10,
  },
  profilePic: {
    borderRadius: 10,
    width: "100%",
    height: "100%",
  },
  loadingIndicator: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -12.5 }, { translateY: -12.5 }],
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
