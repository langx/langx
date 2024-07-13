import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
} from "react-native";
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

  const onEndReached = () => {
    if (hasMore && !loading) {
      loadMore();
    }
  };

  const renderFooter = () => {
    if (!hasMore) return null;
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </ThemedView>
    );
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
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
        />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
