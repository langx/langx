import { useState } from "react";
import { Stack } from "expo-router";
import { Switch, Image, Pressable } from "react-native";

import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/constants/Colors";
import { ThemedView } from "@/components/atomic/ThemedView";
import { ThemedText } from "@/components/atomic/ThemedText";
import icons from "@/constants/icons";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [isCopilotEnabled, setIsCopilotEnabled] = useState(false);
  const toggleSwitch = () =>
    setIsCopilotEnabled((previousState) => !previousState);

  return (
    <Stack>
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
              <Image
                source={icons.profile}
                style={{ width: 30, height: 30, borderRadius: 30 }}
              />
              <ThemedText style={{ fontSize: 16, fontWeight: "500" }}>
                Simon Grimm
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
    </Stack>
  );
}
