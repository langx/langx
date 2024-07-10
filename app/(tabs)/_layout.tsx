import { useEffect } from "react";
import { Platform } from "react-native";
import { Tabs, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { TabBarItem } from "@/components/navigation/TabBarItem";
import { enableScreens } from "react-native-screens";

const TabsLayout = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? "light";

  const segments = useSegments();
  const TabsRoutes = ["home", "rooms", "profile"];
  const showTabs = segments.length === 2 && TabsRoutes.includes(segments[1]);

  // Fix for react-native-screens issue on iOS
  // https://github.com/react-navigation/react-navigation/issues/10432
  useEffect(() => {
    if (Platform.OS === "ios") {
      enableScreens(false);
    }
  }, []);

  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: Colors[theme].primary,
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          display: showTabs ? "flex" : "none",
          backgroundColor: Colors[theme].gray5,
          height: 60,
        },
      })}
    >
      <Tabs.Screen
        name="rooms"
        options={{
          title: "Chats",
          tabBarIcon: ({ color, focused }) => (
            <TabBarItem
              icon="chatbubbles"
              color={color}
              label="Chats"
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: "Community",
          tabBarIcon: ({ color, focused }) => (
            <TabBarItem
              icon="compass"
              color={color}
              label="Community"
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <TabBarItem
              icon="person"
              color={color}
              label="Profile"
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
};

export default function TabLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TabsLayout />
    </GestureHandlerRootView>
  );
}