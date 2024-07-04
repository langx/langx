import React from "react";
import { FlatList, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ThemedView } from "@/components/atomic/ThemedView";
import { ThemedText } from "@/components/atomic/ThemedText";
import { defaultStyles } from "@/constants/Styles";
import { Colors } from "@/constants/Colors";
import BoxedIcon from "@/components/BoxedIcon";

export default function RoomsScreen() {
  const devices = [
    {
      name: "Broadcast Lists",
      icon: "megaphone",
      backgroundColor: Colors.light.success,
    },
    {
      name: "Starred Messages",
      icon: "star",
      backgroundColor: Colors.light.primary,
    },
    {
      name: "Linked Devices",
      icon: "laptop-outline",
      backgroundColor: Colors.light.success,
    },
  ];

  return (
    <ThemedView
      style={{
        flex: 1,
      }}
    >
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <ThemedView style={defaultStyles.block}>
          <FlatList
            data={devices}
            scrollEnabled={false}
            ItemSeparatorComponent={() => (
              <ThemedView style={defaultStyles.separator} />
            )}
            renderItem={({ item }) => (
              <ThemedView style={defaultStyles.item}>
                <BoxedIcon
                  name={item.icon}
                  backgroundColor={item.backgroundColor}
                />

                <ThemedText style={{ fontSize: 18, flex: 1 }}>
                  {item.name}
                </ThemedText>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={Colors.light.grey3}
                />
              </ThemedView>
            )}
          />
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}
