import React, { useCallback } from "react";
import { FlatList, ScrollView, StatusBar } from "react-native";

import chats from "@/assets/data/chats.json";
import { ThemedView } from "@/components/atomic/ThemedView";
import { defaultStyles } from "@/constants/Styles";
import RoomRow from "@/components/rooms/RoomRow";
import { useFocusEffect } from "expo-router";

export default function RoomsScreen() {
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("dark-content");

      // This function is returned to revert the effect when the component is not focused
      return () => StatusBar.setBarStyle("default");
    }, [])
  );
  return (
    <>
      <StatusBar />
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
