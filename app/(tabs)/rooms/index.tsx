import React from "react";
import { FlatList, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ThemedView } from "@/components/atomic/ThemedView";
import { defaultStyles } from "@/constants/Styles";
import { Colors } from "@/constants/Colors";
import chats from "@/assets/data/chats.json";
import RoomRow from "@/components/RoomRow";

export default function RoomsScreen() {
  return (
    <ThemedView
      style={{
        flex: 1,
      }}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <FlatList
          data={chats}
          renderItem={({ item }) => <RoomRow {...item} />}
          keyExtractor={(item) => item.id.toString()}
          ItemSeparatorComponent={() => (
            <ThemedView style={[defaultStyles.separator, { marginLeft: 90 }]} />
          )}
          scrollEnabled={false}
        />
      </ScrollView>
    </ThemedView>
  );
}
