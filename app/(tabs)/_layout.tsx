import React from "react";
import { Tabs } from "expo-router";
import { Image } from "react-native";

import { TabBarIcon } from "@/components/navigation/TabBarIcon";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { ThemedView } from "@/components/ThemedView";

import { styled } from "nativewind";
const StyledImage = styled(Image);

import icons from "@/constants/icons";
import { ThemedText } from "@/components/ThemedText";

type TabItemProps = {
  icon: any;
  color: string;
  name: string;
  focused: boolean;
};

const TabItem: React.FC<TabItemProps> = ({ icon, color, name, focused }) => {
  return (
    <>
      <ThemedView className="items-center justify-center gap-2 bg-transparent">
        <TabBarIcon name={focused ? icon : `${icon}-outline`} color={color} />
        <ThemedText
          className={`${focused ? "font-cbold" : "font-clight"} text-xs`}
        >
          {name}
        </ThemedText>
      </ThemedView>
    </>
  );
};

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
            <TabItem
              icon="chatbubbles"
              color={color}
              name="Chats"
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
            <TabItem
              icon="compass"
              color={color}
              name="Community"
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
            <TabItem
              icon="person"
              color={color}
              name="Profile"
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}
