import { useEffect, useState } from "react";
import { Stack, Link } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Switch, Image, Pressable, ActivityIndicator } from "react-native";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";

import { RoomExtendedInterface } from "@/models/extended/RoomExtended.interface";
import { Colors } from "@/constants/Colors";
import { getFlagEmoji } from "@/constants/utils";
import { useColorScheme } from "@/hooks/useColorScheme";
import { getUserImage } from "@/services/bucketService";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { ThemedView } from "@/components/themed/atomic/ThemedView";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [isCopilotEnabled, setIsCopilotEnabled] = useState(false);
  const toggleSwitch = () =>
    setIsCopilotEnabled((previousState) => !previousState);

  const room: RoomExtendedInterface | null = useSelector(
    (state: RootState) => state.room.room
  );
  const [userImageUrl, setUserImageUrl] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      if (!room) return;
      const data = await getUserImage(room?.userData?.profilePic);
      if (data) {
        try {
          setUserImageUrl(data.toString());
          // console.log("userImageUrl:", userImageUrl);
        } catch (error) {
          console.error("Failed to process user image URL", error);
        }
      }
    };
    fetchData();
  }, [room]);

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: Colors.light.primary },
          headerTitle: "Chats",
          headerTitleStyle: {
            fontFamily: "Lexend-Bold",
            color: Colors.light.black,
          },
          headerRight: () => (
            <Link href="rooms/archive">
              <Ionicons
                name="archive-outline"
                size={24}
                color={Colors.light.black}
                style={{ marginRight: 16 }}
              />
            </Link>
          ),
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: "[id]",
          headerBackVisible: true,
          headerBackTitleVisible: false,
          headerTintColor:
            colorScheme === "dark" ? Colors.dark.black : Colors.light.black,
          headerStyle: {
            backgroundColor:
              colorScheme === "dark"
                ? Colors.dark.background
                : Colors.light.background,
          },
          headerTitleStyle: {
            fontSize: 18,
            fontFamily: "Lexend-Bold",
            color:
              colorScheme === "dark" ? Colors.dark.black : Colors.light.black,
          },
          headerTitle: () => (
            <ThemedView
              style={{
                flexDirection: "row",
                width: 250,
                gap: 10,
                alignItems: "center",
              }}
            >
              {userImageUrl ? (
                <Image
                  source={{ uri: userImageUrl }}
                  style={{ width: 35, height: 35, borderRadius: 35 }}
                />
              ) : (
                <ActivityIndicator size="small" color={Colors.light.primary} />
              )}
              <ThemedText style={{ fontSize: 18 }}>
                {getFlagEmoji(room?.userData?.countryCode)}{" "}
                {room?.userData?.name}
              </ThemedText>
            </ThemedView>
          ),
          headerRight: () => (
            <ThemedView
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 5,
                gap: 10,
              }}
            >
              <Pressable>
                <Switch
                  trackColor={{
                    false: Colors.light.gray3,
                    true: Colors.light.secondary,
                  }}
                  // thumbColor={isCopilotEnabled ? "#f5dd4b" : "#f4f3f4"}
                  ios_backgroundColor={Colors.light.gray3}
                  onValueChange={toggleSwitch}
                  value={isCopilotEnabled}
                />
              </Pressable>
            </ThemedView>
          ),
        }}
      />
      <Stack.Screen
        name="archive"
        options={{
          title: "Archived Chats",
          headerShown: true,
          headerBackVisible: true,
          headerLargeTitle: true,
          headerShadowVisible: false,
          headerBackTitleVisible: true,
          headerBackButtonMenuEnabled: true,
          headerBackTitle: "Back",
          headerTintColor:
            colorScheme === "dark" ? Colors.dark.black : Colors.light.black,
          headerStyle: {
            backgroundColor:
              colorScheme === "dark"
                ? Colors.dark.background
                : Colors.light.background,
          },
          headerLargeTitleStyle: {
            color:
              colorScheme === "dark" ? Colors.dark.black : Colors.light.black,
            fontFamily: "Lexend-Bold",
          },
          headerBackTitleStyle: {
            fontFamily: "Lexend-Bold",
          },
          headerTitleStyle: {
            fontSize: 18,
            fontFamily: "Lexend-Bold",
            color:
              colorScheme === "dark" ? Colors.dark.black : Colors.light.black,
          },
        }}
      />
    </Stack>
  );
}
