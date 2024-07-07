import { StyleSheet, ImageBackground } from "react-native";
import React, { useEffect, useState } from "react";

import { Colors } from "@/constants/Colors";
import { ThemedView } from "@/components/atomic/ThemedView";
import { ThemedText } from "@/components/atomic/ThemedText";

import images from "@/constants/images";
import { useDatabase } from "@/hooks/useDatabase";
import { getUserImage } from "@/services/bucketService";

const UserCard = ({ item, theme, loadingItem }) => {
  const [userImageUrl, setUserImageUrl] = useState("");
  const { data, loading, refetch } = useDatabase(() =>
    getUserImage(item.profilePic)
  );

  useEffect(() => {
    if (data) {
      try {
        setUserImageUrl(data.toString()); // Assuming the data returned is the URL or can be converted to a string URL
      } catch (error) {
        console.error("Failed to process user image URL", error);
      }
    }
  }, [data]);

  if (loading || loadingItem) {
    return (
      <ThemedView style={styles.card}>
        <ThemedView style={styles.loading}>
          <ThemedText>Loading...</ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

  return (
    <ImageBackground
      source={{ uri: userImageUrl }}
      style={styles.card}
      resizeMode="cover"
      imageStyle={styles.imageBackground}
    >
      <ThemedView
        style={{
          width: "100%",
          backgroundColor: Colors[theme].background,
          opacity: 0.8,
          padding: 8,
          alignItems: "center",
        }}
      >
        <ThemedText style={{ fontSize: 18, fontWeight: "bold", opacity: 1 }}>
          {item.name}
        </ThemedText>
        <ThemedText style={{ fontSize: 14 }}>{item.country}</ThemedText>
        <ThemedText style={{ fontSize: 14 }}>{item.username}</ThemedText>
      </ThemedView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  card: {
    flex: 1,
    margin: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    overflow: "hidden",
    minHeight: 200,
    justifyContent: "flex-end",
  },
  imageBackground: {
    width: "100%",
    height: "100%",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default UserCard;
