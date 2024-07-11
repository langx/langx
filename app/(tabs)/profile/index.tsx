import React, { useCallback } from "react";
import { StyleSheet, FlatList } from "react-native";

import { ThemedView } from "@/components/themed/atomic/ThemedView";
import PPCard from "@/components/profile/PPCard";
import AboutMeCard from "@/components/profile/AboutMeCard";
import LanguagesCard from "@/components/profile/LanguagesCard";
import ProfileManagementCard from "@/components/profile/ProfileManagementCard";
import PhotosGalleryCard from "@/components/profile/PhotosGalleryCard";
import BadgesCard from "@/components/profile/BadgesCard";
import LangXTokenCard from "@/components/profile/LangXTokenCard";
import DayStreaksCard from "@/components/profile/DayStreaksCard";
import { sampleUser } from "@/constants/sampleUser";

const components = [
  { component: <PPCard user={sampleUser} />, key: "PPCard" },
  {
    component: <PhotosGalleryCard user={sampleUser} />,
    key: "PhotosGalleryCard",
  },
  {
    component: <AboutMeCard user={sampleUser} account={sampleUser} />,
    key: "AboutMeCard",
  },
  { component: <LanguagesCard />, key: "LanguagesCard" },
  { component: <BadgesCard />, key: "BadgesCard" },
  { component: <LangXTokenCard />, key: "LangXTokenCard" },
  { component: <DayStreaksCard />, key: "DayStreaksCard" },
  { component: <ProfileManagementCard />, key: "ProfileManagementCard" },
];

const ProfileScreen = () => {
  const renderItem = useCallback(
    ({ item }) => (
      <ThemedView style={styles.itemContainer}>{item.component}</ThemedView>
    ),
    []
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={components}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
      />
    </ThemedView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  itemContainer: {
    marginBottom: 10,
  },
});
