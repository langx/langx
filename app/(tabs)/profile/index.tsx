import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, FlatList, ActivityIndicator, View } from "react-native";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";

import { User } from "@/models/User";
import { Colors } from "@/constants/Colors";
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

  const [activeUser, setActiveUser] = useState<User | null>(null);

  useEffect(() => {
    if (isLoading) {
      setActiveUser(null);
    } else if (isLoggedIn) {
      setActiveUser(user);
    } else if (isGuestIn) {
      setActiveUser(sampleUser);
    } else {
      setActiveUser(null);
    }
    console.log("activeUser", activeUser);
  }, [isLoading]);

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
    {
      component: <LanguagesCard languages={activeUser?.languages} />,
      key: "LanguagesCard",
    },
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

  if (activeUser === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
