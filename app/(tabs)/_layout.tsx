import { Tabs } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/hooks/useRealtime";
import { TabBarItem } from "@/components/navigation/TabBarItem";

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? "light";
  const insets = useSafeAreaInsets();

  // Start Realtime Websocket connection
  const { currentUser, jwt } = useAuth();
  useRealtime(currentUser?.$id, jwt);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Tabs
        screenOptions={({ route }) => ({
          tabBarActiveTintColor: Colors[theme].primary,
          headerShown: false,
          tabBarShowLabel: false,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: Colors[theme].gray5,
            justifyContent: "center",
            alignItems: "center",
            height: insets.bottom + 60,
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
    </GestureHandlerRootView>
  );
}
