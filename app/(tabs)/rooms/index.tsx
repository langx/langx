import React from "react";
import { FlatList, ScrollView, StatusBar } from "react-native";

import { ThemedView } from "@/components/atomic/ThemedView";
import { defaultStyles } from "@/constants/Styles";
import chats from "@/assets/data/chats.json";
import RoomRow from "@/components/RoomRow";
import { Colors } from "@/constants/Colors";

export default function RoomsScreen() {
  return (
    <>
      <StatusBar barStyle="dark-content" />
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
              <ThemedView
                style={[defaultStyles.separator, { marginLeft: 90 }]}
              />
            )}
            scrollEnabled={false}
          />
        </ScrollView>
      </ThemedView>
    </>
  );
}
