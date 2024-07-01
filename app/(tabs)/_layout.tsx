import React from "react";
import { Tabs } from "expo-router";
import { Image } from "react-native";

import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { TabBarItem } from "@/components/navigation/TabBarItem";

import { styled } from "nativewind";
const StyledImage = styled(Image);

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: { height: 60 },
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
        name="index"
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
}
