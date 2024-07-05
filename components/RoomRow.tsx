import AppleStyleSwipeableRow from "@/components/AppleStyleSwipeableRow";
import { Colors } from "@/constants/Colors";
import { format } from "date-fns";
import { Link } from "expo-router";
import { FC } from "react";
import { Image, TouchableHighlight } from "react-native";

import { ThemedView } from "@/components/atomic/ThemedView";
import { ThemedText } from "@/components/atomic/ThemedText";

export interface RoomRowProps {
  id: string;
  from: string;
  date: string;
  img: string;
  msg: string;
  read: boolean;
  unreadCount: number;
}

const RoomRow: FC<RoomRowProps> = ({
  id,
  from,
  date,
  img,
  msg,
  read,
  unreadCount,
}) => {
  return (
    <AppleStyleSwipeableRow>
      <Link href={`/(tabs)/chats/${id}`} asChild>
        <TouchableHighlight
          activeOpacity={0.8}
          underlayColor={Colors.light.grey3}
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
            <Image
              source={{ uri: img }}
              style={{ width: 50, height: 50, borderRadius: 50 }}
            />
            <ThemedView style={{ flex: 1 }}>
              <ThemedText style={{ fontSize: 18, fontWeight: "bold" }}>
                {from}
              </ThemedText>
              <ThemedText
                style={{
                  fontSize: 16,
                  fontFamily: "Lexend-Light",
                  color: Colors.light.grey3,
                }}
              >
                {msg.length > 40 ? `${msg.substring(0, 40)}...` : msg}
              </ThemedText>
            </ThemedView>
            <ThemedText
              style={{
                color: Colors.light.grey3,
                paddingRight: 20,
                alignSelf: "flex-start",
              }}
            >
              {format(date, "MM.dd.yy")}
            </ThemedText>
          </ThemedView>
        </TouchableHighlight>
      </Link>
    </AppleStyleSwipeableRow>
  );
};

export default RoomRow;
