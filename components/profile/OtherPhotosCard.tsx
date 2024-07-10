import React from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  Dimensions,
} from "react-native";
import Swiper from "react-native-swiper";

import images from "@/constants/images";

const mockPhotos = [
  "https://example.com/photo1.jpg",
  "https://example.com/photo2.jpg",
  "https://example.com/photo3.jpg",
  "https://example.com/photo4.jpg",
  "https://example.com/photo5.jpg",
];

const OtherPhotosCard = ({ user }) => {
  // const otherPics = user.otherPhotos;
  const otherPics = mockPhotos;
  return (
    <View style={styles.card}>
      {otherPics.length > 0 && (
        <>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Other Photos</Text>
            <Text style={styles.cardSubtitle}>Photos Collection</Text>
          </View>
          <View style={styles.cardContent}>
            {otherPics.length === 0 ? (
              <Text>Currently, no photos are available.</Text>
            ) : (
              <Swiper
                style={styles.wrapper}
                showsButtons
                loop
                paginationStyle={styles.pagination}
                activeDotColor="#000"
              >
                {otherPics.map((photo, index) => (
                  <Pressable
                    key={index}
                    onPress={() => console.log("Preview photo", index)}
                  >
                    <View style={styles.slide}>
                      {/* <Image source={{ uri: photo }} style={styles.image} /> */}
                      <Image source={images.profile} style={styles.image} />
                    </View>
                  </Pressable>
                ))}
              </Swiper>
            )}
          </View>
        </>
      )}
    </View>
  );
};

export default OtherPhotosCard;

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
