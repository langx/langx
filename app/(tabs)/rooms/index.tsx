import React, { useEffect, useState } from "react";
import { FlatList, RefreshControl, ScrollView } from "react-native";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";

import { useDatabase } from "@/hooks/useDatabase";
import { listRooms } from "@/services/roomService";
import { Colors } from "@/constants/Colors";
import { defaultStyles } from "@/constants/Styles";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import RoomRow from "@/components/rooms/RoomRow";

export default function RoomsScreen() {
  const user = useSelector((state: RootState) => state.auth.user);
  const currentUserId = user?.$id;

  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data: rooms,
    loading,
    loadMore,
    refetch,
    hasMore,
  } = useDatabase(listRooms, currentUserId);

  const onRefresh = async () => {
    setIsRefreshing(true);
    refetch();
    setIsRefreshing(false);
  };

  useEffect(() => {
    console.log("rooms:", rooms?.length);
  }, [rooms]);

  return (
    <ThemedView
      style={{
        flex: 1,
      }}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[Colors.light.primary]}
          />
        }
      >
        <FlatList
          data={rooms}
          renderItem={({ item: room }) => <RoomRow room={room} />}
          keyExtractor={(item) => item.$id.toString()}
          ItemSeparatorComponent={() => (
            <ThemedView style={[defaultStyles.separator, { marginLeft: 90 }]} />
          )}
          scrollEnabled={false}
        />
      </ScrollView>
    </ThemedView>
  );
}
