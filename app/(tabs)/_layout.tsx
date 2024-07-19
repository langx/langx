import { Tabs, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useRealtime } from "@/hooks/useRealtime";
import { TabBarItem } from "@/components/navigation/TabBarItem";

const TabsLayout = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? "light";
  const insets = useSafeAreaInsets();

  // Start Realtime Websocket connection
  const currentUser = useSelector((state: RootState) => state.auth.user);
  if (currentUser) useRealtime(currentUser.$id);

  const segments = useSegments();
  const TabsRoutes = ["home", "rooms", "profile"];
  const showTabs = segments.length === 2 && TabsRoutes.includes(segments[1]);

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
          justifyContent: "center",
          alignItems: "center",
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
