import AppleStyleSwipeableRow from "@/components/rooms/AppleStyleSwipeableRow";
import { Colors } from "@/constants/Colors";
import { format } from "date-fns";
import { Link } from "expo-router";
import { FC } from "react";
import { Image, TouchableHighlight } from "react-native";

import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { Room } from "@/models/Room";

const RoomRow: FC<{ room: Room }> = ({ room }) => {
  // console.log(room);
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
            <ThemedText>{room.users}</ThemedText>
            {/* <Image
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
