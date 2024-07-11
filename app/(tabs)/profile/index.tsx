import React from "react";
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

const mockUser = {
  name: "John Doe",
  profilePic: "userimageURL",
  birthdate: "1990-01-01",
  aboutMe:
    "I love coding, traveling, and learning new languages.I love coding, traveling, and learning new languages.I love coding, traveling, and learning new languages.I love coding, traveling, and learning new languages.",
  gender: "male",
  country: "US",
  lastSeen: "2024-07-01T12:00:00Z",
  contributors: [1, 2, 3],
  sponsor: true,
  username: "johndoe",
  emailVerification: true,
};

const components = [
  { component: <PPCard user={mockUser} />, key: "PPCard" },
  {
    component: <PhotosGalleryCard user={mockUser} />,
    key: "PhotosGalleryCard",
  },
  {
    component: <AboutMeCard user={mockUser} account={mockUser} />,
    key: "AboutMeCard",
  },
  { component: <LanguagesCard />, key: "LanguagesCard" },
  { component: <BadgesCard />, key: "BadgesCard" },
  { component: <LangXTokenCard />, key: "LangXTokenCard" },
  { component: <DayStreaksCard />, key: "DayStreaksCard" },
  { component: <ProfileManagementCard />, key: "ProfileManagementCard" },
];

const ProfileScreen = () => {
  const renderItem = ({ item }) => (
    <ThemedView style={styles.itemContainer}>{item.component}</ThemedView>
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
