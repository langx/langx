import React, { useCallback } from "react";
import { StyleSheet, FlatList } from "react-native";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";

import { User } from "@/models/User";
import { sampleUser } from "@/constants/sampleUser";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import PPCard from "@/components/profile/PPCard";
import AboutMeCard from "@/components/profile/AboutMeCard";
import LanguagesCard from "@/components/profile/LanguagesCard";
import ProfileManagementCard from "@/components/profile/ProfileManagementCard";
import PhotosGalleryCard from "@/components/profile/PhotosGalleryCard";
import BadgesCard from "@/components/profile/BadgesCard";
import LangXTokenCard from "@/components/profile/LangXTokenCard";
import DayStreaksCard from "@/components/profile/DayStreaksCard";

const ProfileScreen = () => {
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  const isGuestIn = useSelector((state: RootState) => state.auth.isGuestIn);
  const isLoading = useSelector((state: RootState) => state.auth.isLoading);
  const account = useSelector((state: RootState) => state.auth.account);
  const user = useSelector((state: RootState) => state.auth.user);

  console.log("isLoggedIn:", isLoggedIn);
  console.log("isGuestIn:", isGuestIn);
  console.log("isLoading:", isLoading);
  console.log("user:", user);

  let activeUser: User;

  if (isLoading) {
    activeUser = null;
  } else if (isLoggedIn) {
    activeUser = user;
  } else if (isGuestIn) {
    activeUser = sampleUser;
  } else {
    activeUser = null;
  }

  const components = [
    { component: <PPCard user={activeUser} />, key: "PPCard" },
    {
      component: <PhotosGalleryCard user={activeUser} />,
      key: "PhotosGalleryCard",
    },
    {
      component: <AboutMeCard user={activeUser} account={account} />,
      key: "AboutMeCard",
    },
    { component: <LanguagesCard />, key: "LanguagesCard" },
    { component: <BadgesCard />, key: "BadgesCard" },
    { component: <LangXTokenCard />, key: "LangXTokenCard" },
    { component: <DayStreaksCard />, key: "DayStreaksCard" },
    { component: <ProfileManagementCard />, key: "ProfileManagementCard" },
  ];

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
