import AppleStyleSwipeableRow from "@/components/rooms/AppleStyleSwipeableRow";
import { format } from "date-fns";
import { Link } from "expo-router";
import { FC, useEffect, useState } from "react";
import { Image, TouchableHighlight, StyleSheet } from "react-native";

import { Room } from "@/models/Room";
import { Colors } from "@/constants/Colors";
import { useDatabase } from "@/hooks/useDatabase";
import { getUserImage } from "@/services/bucketService";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { ThemedView } from "@/components/themed/atomic/ThemedView";

const RoomRow: FC<{ room: Room }> = ({ room }) => {
  const [userImageUrl, setUserImageUrl] = useState("");
  const { data, loading, refetch } = useDatabase(() =>
    getUserImage(room?.userData?.profilePic)
  );

  useEffect(() => {
    if (data) {
      try {
        setUserImageUrl(data.toString());
      } catch (error) {
        console.error("Failed to process user image URL", error);
      }
    }
  }, [data]);

  if (loading) {
    return (
      <ThemedView style={styles.card}>
        <ThemedView style={styles.loading}>
          <ThemedText>Loading...</ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

  return (
    <AppleStyleSwipeableRow>
      <Link href={`/(tabs)/rooms/${room.$id}`} asChild>
        <TouchableHighlight
          activeOpacity={0.8}
          underlayColor={Colors.light.gray3}
        >
          <ThemedView
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              paddingLeft: 20,
              paddingVertical: 10,
            }}
          >
            <ThemedText>{room.userData.$id}</ThemedText>
            <Image
              source={{ uri: userImageUrl }}
              style={{ width: 50, height: 50, borderRadius: 50 }}
            />
            {/* 
            <ThemedView style={{ flex: 1 }}>
              <ThemedText style={{ fontSize: 18, fontWeight: "bold" }}>
                {from}
              </ThemedText>
              <ThemedText
                style={{
                  fontSize: 16,
                  fontFamily: "NotoSans-Regular",
                  color: Colors.light.gray3,
                }}
              >
                {msg.length > 40 ? `${msg.substring(0, 40)}...` : msg}
              </ThemedText>
            </ThemedView>
            <ThemedText
              style={{
                color: Colors.light.gray3,
                paddingRight: 20,
                alignSelf: "flex-start",
              }}
            >
              {format(date, "MM.dd.yy")}
            </ThemedText> */}
          </ThemedView>
        </TouchableHighlight>
      </Link>
    </AppleStyleSwipeableRow>
  );
};

export default RoomRow;

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  card: {
    flex: 1,
    margin: 10,
    borderRadius: 10,
    overflow: "hidden",
    height: 200,
    width: 150,
    justifyContent: "flex-end",
  },
  imageBackground: {
    width: "100%",
    height: "100%",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
