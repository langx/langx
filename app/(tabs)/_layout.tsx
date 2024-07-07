import { Tabs } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { TabBarItem } from "@/components/navigation/TabBarItem";

const TabsLayout = () => {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? "light";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[theme].primary,
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: Colors[theme].gray5,
          height: 60,
        },
      }}
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
