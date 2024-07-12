import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Image,
  Pressable,
  ScrollView,
  ActivityIndicator,
  ImageStyle,
} from "react-native";

import { Colors } from "@/constants/Colors";
import { getUserImage } from "@/services/bucketService";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";

const PhotosGalleryCard = ({ user }) => {
  const otherPics = user?.otherPics || [];
  const [imageUris, setImageUris] = useState(
    Array(otherPics.length).fill(null)
  );
  const [loadingStates, setLoadingStates] = useState(
    Array(otherPics.length).fill(true)
  );

  useEffect(() => {
    const fetchImageUris = async () => {
      const uris = await Promise.all(
        otherPics.map(async (picId) => {
          const uri = await getUserImage(picId);
          return uri.toString();
        })
      );
      setImageUris(uris);
    };

    if (otherPics.length > 0) {
      fetchImageUris();
    }
  }, [otherPics]);

  const handleImagePress = (index) => {
    console.log(`Image pressed: ${index}`);
  };

  const handleLoadEnd = (index) => {
    setLoadingStates((prevStates) => {
      const newStates = [...prevStates];
      newStates[index] = false;
      return newStates;
    });
  };

  return (
    <ThemedView style={styles.card}>
      {otherPics.length > 0 && (
        <>
          <ThemedView style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Photos Gallery</ThemedText>
            <ThemedText style={styles.cardSubtitle}>User Collection</ThemedText>
          </ThemedView>
          <ScrollView contentContainerStyle={styles.cardContent}>
            <ThemedView style={styles.grid}>
              {imageUris.map((uri, index) => (
                <Pressable key={index} onPress={() => handleImagePress(index)}>
                  <ThemedView style={styles.imageContainer}>
                    {loadingStates[index] && (
                      <ActivityIndicator
                        style={styles.loadingIndicator}
                        size="large"
                        color={Colors.light.primary}
                      />
                    )}
                    <Image
                      source={{ uri }}
                      style={[
                        styles.image as ImageStyle,
                        styles.gridItem as ImageStyle,
                      ]}
                      onLoadEnd={() => handleLoadEnd(index)}
                    />
                  </ThemedView>
                </Pressable>
              ))}
            </ThemedView>
          </ScrollView>
        </>
      )}
    </ThemedView>
  );
};

export default PhotosGalleryCard;

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
    textAlign: "center",
  },
  cardSubtitle: {
    fontSize: 16,
    textAlign: "center",
  },
  cardContent: {
    padding: 20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    alignItems: "flex-start",
    padding: 10,
    borderRadius: 10,
  },
  gridItem: {
    margin: 10,
  },
  imageContainer: {
    position: "relative",
    width: 100,
    height: 100,
    marginBottom: 10,
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
  },
  loadingIndicator: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -12.5 }, { translateY: -12.5 }],
  },
});
