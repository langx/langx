import React, { useEffect, useState } from "react";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Switch,
  Image,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";

import { RoomExtendedInterface } from "@/models/extended/RoomExtended.interface";
import { Colors } from "@/constants/Colors";
import { getFlagEmoji, onlineStatusInChatRoom } from "@/constants/utils";
import { useColorScheme } from "@/hooks/useColorScheme";
import { getUserImage } from "@/services/bucketService";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { ThemedView } from "@/components/themed/atomic/ThemedView";

export default function RoomLayout() {
  const colorScheme = useColorScheme();

  const [isCopilotEnabled, setIsCopilotEnabled] = useState(false);

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
        name="[id]"
        options={{
          headerBackVisible: false,
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
          headerLeft: () => (
            <ThemedView
              style={{
                flexDirection: "row",
                gap: 15,
                alignItems: "center",
              }}
            >
              <Pressable
                onPress={() => {
                  router.back();
                }}
              >
                <ThemedView
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Ionicons
                    name={
                      Platform.OS === "android"
                        ? "arrow-back-outline"
                        : "chevron-back-outline"
                    }
                    size={24}
                    color={
                      colorScheme === "dark"
                        ? Colors.dark.black
                        : Colors.light.black
                    }
                  />
                </ThemedView>
              </Pressable>
              {userImageUrl ? (
                <>
                  <Image
                    source={{ uri: userImageUrl }}
                    style={{ width: 35, height: 35, borderRadius: 35 }}
                  />
                  <ThemedView
                    style={{
                      flexDirection: "column",
                    }}
                  >
                    <ThemedText style={{ fontSize: 18 }}>
                      {getFlagEmoji(room?.userData?.countryCode)}{" "}
                      {room?.userData?.name}
                    </ThemedText>
                    <ThemedText
                      style={{ fontSize: 12, color: Colors.light.gray3 }}
                    >
                      {onlineStatusInChatRoom(room?.userData?.lastSeen)}
                    </ThemedText>
                  </ThemedView>
                </>
              ) : (
                <ActivityIndicator size="small" color={Colors.light.primary} />
              )}
            </ThemedView>
          ),
          headerTitle: () => (
            <ThemedView style={{ display: "none" }}></ThemedView>
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
              <Switch
                trackColor={{
                  true: Colors.light.secondary,
                }}
                thumbColor={Colors.light.white}
                ios_backgroundColor={Colors.light.gray3}
                onValueChange={(newValue) => {
                  setIsCopilotEnabled(newValue);
                  if (newValue)
                    Alert.alert("Copilot", "Copilot is under maintenance");
                }}
                value={isCopilotEnabled}
              />
            </ThemedView>
          ),
        }}
      />
    </Stack>
  );
}
