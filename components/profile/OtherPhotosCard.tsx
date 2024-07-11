import React, { useState } from "react";
import {
  StyleSheet,
  Image,
  Pressable,
  Modal,
  View,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import Swiper from "react-native-swiper";
import images from "@/constants/images";
import { Colors } from "@/constants/Colors";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";

const OtherPhotosCard = ({ user }) => {
  const [isModalVisible, setModalVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const otherPics = [1, 2, 3, 4, 5, 6]; // Replace this with user.otherPhotos;

  const openModal = (index) => {
    setCurrentIndex(index);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
  };

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
                  <Pressable key={index} onPress={() => openModal(index)}>
                    <Image
                      source={images.thumbnail}
                      style={[styles.image, styles.gridItem]}
                    />
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>
        </>
      )}

      <Modal visible={isModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
            <ThemedText style={styles.closeButtonText}>×</ThemedText>
          </TouchableOpacity>
          <Swiper
            style={styles.modalSwiper}
            index={currentIndex}
            loop
            showsButtons
            paginationStyle={styles.paginationStyle}
            activeDotColor={Colors.light.primary}
            dotColor={Colors.light.gray3}
            nextButton={<ThemedText style={styles.nextButton}>›</ThemedText>}
            prevButton={<ThemedText style={styles.prevButton}>‹</ThemedText>}
          >
            {otherPics.map((photo, index) => (
              <ThemedView key={index} style={styles.modalSlide}>
                <Image source={images.thumbnail} style={styles.modalImage} />
              </ThemedView>
            ))}
          </Swiper>
        </View>
      </Modal>
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
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 30,
    zIndex: 1,
  },
  closeButtonText: {
    fontSize: 50,
    color: "white",
  },
  modalSwiper: {
    height: "80%",
  },
  modalSlide: {
    justifyContent: "center",
    alignItems: "center",
  },
  modalImage: {
    width: "90%",
    height: "90%",
    borderRadius: 10,
  },
  nextButton: {
    fontSize: 50,
    color: Colors.light.primary,
  },
  prevButton: {
    fontSize: 50,
    color: Colors.light.primary,
  },
  paginationStyle: {
    bottom: -20,
  },
});
