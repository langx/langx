import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ActivityIndicator,
  StyleSheet,
  FlatList,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Colors } from "@/constants/Colors";
import { getUserByUsername } from "@/services/userService";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import PPCard from "@/components/profile/PPCard";
import PhotosGalleryCard from "@/components/profile/PhotosGalleryCard";
import AboutMeCard from "@/components/profile/AboutMeCard";

const StackLayout = ({ username }: { username: string }) => {
  return (
    <Stack.Screen
      options={{
        headerShown: true,
        headerBackVisible: true,
        headerShadowVisible: false,
        headerBackTitleVisible: true,
        headerBackButtonMenuEnabled: true,
        headerBackTitle: "Back",
        headerStyle: { backgroundColor: Colors.light.primary },
        headerTintColor: Colors.light.black,
        headerBackTitleStyle: {
          fontFamily: "Lexend-Bold",
        },
        headerTitle: `@${username}`,
        headerTitleStyle: {
          fontFamily: "Lexend-Bold",
          color: Colors.light.black,
        },
        headerRight: () => (
          <Pressable onPress={() => router.back()}>
            <Ionicons
              name="ellipsis-horizontal"
              size={24}
              color={Colors.light.black}
            />
          </Pressable>
        ),
      }}
    />
  );
};

const UserScreen = () => {
  const { username } = useLocalSearchParams<{ username: string }>();

  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const user = await getUserByUsername(username);
      setUser(user);
    };

    fetchUser();
  }, [username]);

  const components = [
    { component: <PPCard user={user} />, key: "PPCard" },
    {
      component: <PhotosGalleryCard user={user} />,
      key: "PhotosGalleryCard",
    },
    {
      component: <AboutMeCard user={user} account={null} />,
      key: "AboutMeCard",
    },
    // {
    //   component: <LanguagesCard languages={activeUser?.languages} />,
    //   key: "LanguagesCard",
    // },
    // {
    //   component: <BadgesCard badges={activeUser?.badges} />,
    //   key: "BadgesCard",
    // },
    // {
    //   component: <DayStreaksCard streak={activeUser?.streaks} />,
    //   key: "DayStreaksCard",
    // },
  ];

  const renderItem = useCallback(
    ({ item }) => (
      <ThemedView style={styles.itemContainer}>{item.component}</ThemedView>
    ),
    []
  );

  return (
    <>
      <StackLayout username={username} />
      {user === null && (
        <ThemedView
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </ThemedView>
      )}
      {user && (
        <ThemedView style={styles.container}>
          <FlatList
            data={components}
            renderItem={renderItem}
            keyExtractor={(item) => item.key}
          />
        </ThemedView>
      )}
    </>
  );
};

export default UserScreen;

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
