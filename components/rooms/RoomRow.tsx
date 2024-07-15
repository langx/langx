import AppleStyleSwipeableRow from "@/components/rooms/AppleStyleSwipeableRow";
import { router } from "expo-router";
import { FC, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { Image, Pressable, StyleSheet } from "react-native";

import { Colors } from "@/constants/Colors";
import { getFlagEmoji, lastSeen } from "@/constants/utils";
import { setRoom } from "@/store/roomSlice";
import { useDatabase } from "@/hooks/useDatabase";
import { getUserImage } from "@/services/bucketService";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { RoomExtendedInterface } from "@/models/extended/RoomExtended.interface";

interface messageDetails {
  time: string | null;
  yourTurn?: boolean;
  body: string;
  unseen: number;
}

const RoomRow: FC<{ room: RoomExtendedInterface }> = ({ room }) => {
  const dispatch = useDispatch();

  const [userImageUrl, setUserImageUrl] = useState("");
  const [lastMessage, setLastMessage] = useState<messageDetails>({
    time: null,
    body: "Say Hi! 👋",
    unseen: 0,
  });

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

  useEffect(() => {
    const currentUserId = room.users.find((id) => id !== room?.userData?.$id);
    const userIndex = room.users.indexOf(currentUserId);
    const userTypingDate = new Date(
      room.typing[room.users.indexOf(room.userData.$id)]
    );

    const lastMessage = room.messages[room.messages.length - 1];
    const type = lastMessage?.type || null;

    let messageDetail: messageDetails = {
      time: lastMessage?.$createdAt || null,
      body: "Say Hi! 👋",
      unseen: room.unseen[userIndex],
    };

    if (lastMessage?.to === currentUserId) {
      messageDetail.yourTurn = true;
    }

    switch (type) {
      case "body":
        messageDetail.body = lastMessage.body;
        break;
      case "image":
        messageDetail.body = "📷 Image";
        break;
      case "audio":
        messageDetail.body = "🎵 Audio";
        break;
    }

    if (userTypingDate.getTime() > Date.now() - 6000) {
      const lastBody = messageDetail.body;
      messageDetail.body = "Typing...";
      setLastMessage(messageDetail);

      // Reset the message body after 6000ms
      const timeoutId = setTimeout(() => {
        setLastMessage((prevDetails) => ({
          ...prevDetails,
          body: lastBody,
        }));
      }, 6000);

      return () => clearTimeout(timeoutId);
    } else {
      setLastMessage(messageDetail);
    }
  }, [room]);

  if (loading) {
    return (
      <ThemedView style={styles.card}>
        <ThemedView style={styles.loading}>
          <ThemedText>Loading...</ThemedText>
        </ThemedView>
      </ThemedView>
    );
  }

  function messageTime(d: any) {
    if (!d) return null;
    let time = lastSeen(d);
    if (time === "online") time = "now";
    return time;
  }

  const navigateToRoomById = () => {
    dispatch(setRoom(room));
    router.navigate(`rooms/${room.$id}`);
  };

  return (
    <AppleStyleSwipeableRow>
      <Pressable
        onPress={navigateToRoomById}
        style={({ pressed }) => ({
          opacity: pressed ? 0.5 : 1,
        })}
      >
        <ThemedView
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            paddingLeft: 20,
            paddingVertical: 5,
          }}
        >
          <Image
            source={{ uri: userImageUrl }}
            style={{ width: 50, height: 50, borderRadius: 50 }}
          />
          <ThemedView style={{ flex: 1 }}>
            <ThemedText
              style={{
                fontSize: 18,
              }}
            >
              {getFlagEmoji(room?.userData?.countryCode)} {room?.userData?.name}
            </ThemedText>
            <ThemedText
              style={{
                fontFamily: "Lexend-Light",
                fontSize: 16,
                color: Colors.light.gray3,
                maxWidth: "100%",
                paddingVertical: 5,
              }}
              numberOfLines={1}
            >
              {lastMessage.body}
            </ThemedText>
          </ThemedView>

          <ThemedView>
            <ThemedText
              style={{
                color: Colors.light.gray3,
                paddingRight: 20,
                alignSelf: "flex-end",
              }}
            >
              {messageTime(room?.lastMessageUpdatedAt)}
            </ThemedText>
            {lastMessage.yourTurn && (
              <ThemedView
                style={{
                  marginRight: 20,
                  marginTop: 2,
                  padding: 1,
                  alignSelf: "flex-end",
                  backgroundColor: Colors.light.primary,
                  borderRadius: 5,
                  overflow: "hidden",
                }}
              >
                <ThemedText
                  style={{
                    fontSize: 10,
                    color: Colors.light.black,
                    padding: 2,
                    textAlign: "center",
                  }}
                >
                  your-turn
                </ThemedText>
              </ThemedView>
            )}
            {lastMessage.unseen > 0 && (
              <ThemedView
                style={{
                  marginRight: 20,
                  marginTop: 2,
                  padding: 1,
                  alignSelf: "flex-end",
                  backgroundColor: Colors.light.error,
                  borderRadius: 5,
                  overflow: "hidden",
                }}
              >
                <ThemedText
                  style={{
                    fontSize: 10,
                    color: Colors.light.white,
                    padding: 3,
                    minWidth: 15,
                    textAlign: "center",
                  }}
                >
                  {lastMessage.unseen}
                </ThemedText>
              </ThemedView>
            )}
          </ThemedView>
        </ThemedView>
      </Pressable>
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
