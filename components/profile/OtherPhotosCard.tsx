import React from "react";
import { StyleSheet, Image, View, ScrollView } from "react-native";

import images from "@/constants/images";
import { Colors } from "@/constants/Colors";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";

const OtherPhotosCard = ({ user }) => {
  const otherPics = [1, 2, 3, 4, 5, 6];

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
          <ScrollView contentContainerStyle={styles.cardContent}>
            {otherPics.length === 0 ? (
              <ThemedText>Currently, no photos are available.</ThemedText>
            ) : (
              <View style={styles.grid}>
                {otherPics.map((photo, index) => (
                  <Image
                    key={index}
                    source={images.thumbnail}
                    style={[styles.image, styles.gridItem]}
                  />
                ))}
              </View>
            )}
          </ScrollView>
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
  image: {
    width: 100,
    height: 100,
    borderRadius: 10,
    margin: 5,
  },
});
