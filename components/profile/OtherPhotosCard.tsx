import React from "react";
import { StyleSheet, Image, Pressable } from "react-native";
import Swiper from "react-native-swiper";

import images from "@/constants/images";
import { Colors } from "@/constants/Colors";

import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";

const OtherPhotosCard = ({ user }) => {
  // const otherPics = user.otherPhotos;
  const otherPics = [1, 2, 3, 4, 5];
  return (
    <ThemedView style={styles.card}>
      {otherPics.length > 0 && (
        <>
          <ThemedView style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>Other Photos</ThemedText>
            <ThemedText style={styles.cardSubtitle}>
              Photos Collection
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.cardContent}>
            {otherPics.length === 0 ? (
              <ThemedText>Currently, no photos are available.</ThemedText>
            ) : (
              <Swiper
                style={styles.wrapper}
                showsButtons
                loop
                paginationStyle={styles.pagination}
                activeDotColor={Colors.light.primary}
                dotColor={Colors.light.gray3}
              >
                {otherPics.map((photo, index) => (
                  <Pressable
                    key={index}
                    onPress={() => console.log("Preview photo", index)}
                  >
                    <ThemedView style={styles.slide}>
                      {/* <Image source={{ uri: photo }} style={styles.image} /> */}
                      <Image source={images.profile} style={styles.image} />
                    </ThemedView>
                  </Pressable>
                ))}
              </Swiper>
            )}
          </ThemedView>
        </>
      )}
    </ThemedView>
  );
};

export default OtherPhotosCard;

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
  wrapper: {
    height: 200,
  },
  pagination: {
    bottom: -20,
  },
  slide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 10,
  },
});
