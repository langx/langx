import React, { useState, useCallback, useEffect, useRef } from "react";
import { ActivityIndicator, Platform, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Clipboard from "@react-native-clipboard/clipboard";
import { useLocalSearchParams } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/store";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import {
  GiftedChat,
  Bubble,
  InputToolbar,
  Send,
  SystemMessage,
  IMessage,
  Time,
} from "react-native-gifted-chat";

import { RoomExtendedInterface } from "@/models/extended/RoomExtended.interface";
import { createMessageRequestInterface } from "@/models/requests/createMessageRequest.interface";
import { setRoom, setRoomMessages } from "@/store/roomSlice";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useDatabase } from "@/hooks/useDatabase";
import { useAuth } from "@/hooks/useAuth";
import {
  createMessage,
  deleteMessage,
  listMessages,
  updateMessage,
} from "@/services/messageService";
import { listRooms } from "@/services/roomService";
import { Colors } from "@/constants/Colors";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import ContextMenu from "@/components/themed/molecular/ContextMenu";
import ChatMessageBox from "@/components/rooms/ChatMessageBox";
import ReplyMessageBar from "@/components/rooms/ReplyMessageBar";

const Room = () => {
  const theme = useColorScheme() === "dark" ? "dark" : "light";
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Hooks
  const dispatch = useDispatch();
  const { currentUser, jwt } = useAuth();

  // Selectors
  const room: RoomExtendedInterface | null = useSelector(
    (state: RootState) => state.room.room
  );

  // States
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [isRoomSet, setIsRoomSet] = useState(false);
  const [text, setText] = useState("");
  const [replyMessage, setReplyMessage] = useState<IMessage | null>(null);

  // Refs
  const swipeableRowRef = useRef<Swipeable | null>(null);

  // Room and Messages data
  const {
    data: roomData,
    loading: roomLoading,
    loadMore: roomsLoadMore,
    refetch: roomsRefetch,
    hasMore: roomsHasMore,
  } = useDatabase(listRooms, { roomId: id });

  const {
    data: messagesData,
    loading: messagesLoading,
    loadMore: messagesLoadMore,
    refetch: messagesRefetch,
    hasMore: messagesHasMore,
  } = useDatabase(listMessages, { roomId: id });

  useEffect(() => {
    if (roomData && roomData.length > 0) {
      if (room?.$id !== roomData[0]?.$id) {
        dispatch(setRoom(roomData[0]));
      }
      setIsRoomSet(true);
    }
  }, [roomData]);

  // Effect for setting messages, depends on isRoomSet
  useEffect(() => {
    if (isRoomSet && messagesData && messagesData.length > 0) {
      dispatch(setRoomMessages(messagesData));
    }
  }, [isRoomSet, messagesData]);

  useEffect(() => {
    const currentUserId = room?.users?.find(
      (userId) => userId !== room.userData.$id
    );
    if (room?.messages) {
      const updatedMessages = room.messages.map((message) => ({
        _id: message.$id,
        text: message.type === "body" ? message.body : null,
        image: message.type === "image" ? message.imageId : null,
        audio: message.type === "audio" ? message.audioId : null,
        createdAt: new Date(message.$createdAt),
        user: {
          _id: message.sender === currentUserId ? 1 : 0,
          name: message.sender === currentUserId ? "You" : room?.userData?.name,
        },
        sent: true,
        received: message.seen,
        replyTo: message.replyTo,
      }));

      setMessages([...updatedMessages]);
    }
  }, [room]);

  // Send message
  const onSend = useCallback(
    (newMessages = []) => {
      const currentUserId = currentUser.$id;
      newMessages.forEach((message) => {
        message.pending = true;
        message._id = uuidv4().replace(/-/g, "");
        message.replyTo = replyMessage ? replyMessage._id.toString() : null;

        const newMessage: createMessageRequestInterface = {
          $id: message._id,
          to: room.userData.$id,
          body: message.text,
          roomId: id,
          type: "body",
          replyTo: replyMessage ? replyMessage._id.toString() : null,
        };
        createMessage({ newMessage, currentUserId, jwt });
      });
      setMessages((previousMessages) =>
        GiftedChat.append(previousMessages, newMessages)
      );
      setReplyMessage(null);
    },
    [room, replyMessage]
  );

  const renderBubble = (props) => {
    const { currentMessage } = props;
    const replyTo = currentMessage.replyTo
      ? messages.find((m) => m._id === currentMessage.replyTo)
      : null;

    return (
      <ThemedView>
        {replyTo && (
          <ThemedView
            style={{
              borderRadius: 15,
              maxWidth: "85%",
            }}
          >
            <ThemedView style={{ flexDirection: "row" }}>
              <ThemedView
                style={{
                  height: "100%",
                  width: 10,
                  backgroundColor: Colors[theme].primary,
                  borderTopLeftRadius: 15,
                  borderBottomLeftRadius: 15,
                }}
              />
              <ThemedView style={{ flexDirection: "column" }}>
                <ThemedText
                  style={{
                    paddingHorizontal: 10,
                    paddingTop: 5,
                    fontWeight: "700",
                  }}
                >
                  {replyTo.user.name}
                </ThemedText>
                <ThemedText
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                  }}
                >
                  {replyTo.text}
                </ThemedText>
              </ThemedView>
            </ThemedView>
          </ThemedView>
        )}
        <ContextMenu
          actions={[
            {
              title: "Reply",
              systemIcon: "arrowshape.turn.up.left",
              IonIcon: "arrow-undo-outline",
            },
            { title: "Edit", systemIcon: "pencil", IonIcon: "pencil-outline" },
            {
              title: "Copy",
              systemIcon: "doc.on.doc",
              IonIcon: "copy-outline",
            },
            {
              title: "Delete",
              systemIcon: "trash",
              IonIcon: "trash-outline",
              destructive: true,
            },
          ]}
          onPress={({ nativeEvent: { index } }) => {
            const messageId = currentMessage._id;
            const currentUserId = currentUser.$id;
            if (index === 0) {
              setReplyMessage(props.currentMessage);
            }
            if (index === 1) {
              updateMessage({
                messageId,
                updatedMessage: { body: "Edited" },
                currentUserId,
                jwt,
              });
            }
            if (index === 2) {
              Clipboard.setString(currentMessage.text);
            }
            if (index === 3) {
              deleteMessage({ messageId, currentUserId, jwt });
            }
          }}
          style={{ padding: 0, margin: 0, backgroundColor: "transparent" }}
        >
          <Bubble
            {...props}
            textStyle={{
              left: {
                color: Colors[theme].black,
                fontFamily: "NotoSans-Regular",
              },
              right: {
                color: Colors.light.black,
                fontFamily: "NotoSans-Regular",
              },
            }}
            wrapperStyle={{
              left: {
                backgroundColor: Colors[theme].gray5,
                padding: 0,
                margin: 0,
                borderRadius: 15,
              },
              right: {
                backgroundColor: Colors[theme].primary,
                padding: 0,
                margin: 0,
                borderRadius: 15,
              },
            }}
            containerStyle={{
              left: {
                margin: 0,
                padding: 0,
              },
              right: {
                margin: 0,
                padding: 0,
              },
            }}
            renderTime={renderCustomTime}
            renderTicks={renderTicks}
          />
        </ContextMenu>
      </ThemedView>
    );
  };

  const renderTicks = (message: IMessage) => {
    if (message.user._id === 1) {
      if (message.received) {
        return (
          <Ionicons
            name="checkmark-circle-outline"
            style={{ paddingRight: 5, opacity: 0.8 }}
            size={10}
          />
        );
      } else if (message.pending) {
        return (
          <Ionicons
            name="cloud-upload-outline"
            style={{ paddingRight: 5, opacity: 0.8 }}
            size={10}
          />
        );
      } else if (message.sent) {
        return (
          <Ionicons
            name="checkmark"
            style={{ paddingRight: 5, opacity: 0.8 }}
            size={10}
          />
        );
      }
    }
    return null;
  };

  const renderInputToolbar = (props: any) => {
    return (
      <InputToolbar
        {...props}
        containerStyle={{ backgroundColor: Colors[theme].background }}
        renderActions={() => (
          <ThemedView style={styles.addButton}>
            <Ionicons name="add" color={Colors[theme].primary} size={28} />
          </ThemedView>
        )}
      />
    );
  };

  const renderCustomTime = (props) => {
    return (
      <Time
        {...props}
        timeTextStyle={{
          left: { color: Colors[theme].gray1, opacity: 0.8 },
          right: { color: Colors.light.black, opacity: 0.8 },
        }}
      />
    );
  };

  // const renderTicks = (props) => {
  //   return (
  //     <Time
  //       {...props}
  //       timeTextStyle={{
  //         left: { color: Colors[theme].gray1 },
  //         right: { color: Colors.light.black, opacity: 0.7 },
  //       }}
  //     />
  //   );
  // };

  const renderSend = (props) => {
    return (
      <ThemedView style={styles.sendContainer}>
        {text === "" && (
          <>
            <Ionicons
              name="camera-outline"
              color={Colors.light.primary}
              size={28}
            />
            <Ionicons
              name="mic-outline"
              color={Colors.light.primary}
              size={28}
            />
          </>
        )}
        {text !== "" && (
          <Send
            {...props}
            containerStyle={{
              justifyContent: "center",
            }}
          >
            <Ionicons name="send" color={Colors.light.primary} size={28} />
          </Send>
        )}
      </ThemedView>
    );
  };

  const updateRowRef = useCallback(
    (ref: any) => {
      if (
        ref &&
        replyMessage &&
        ref.props.children.props.currentMessage?._id === replyMessage._id
      ) {
        swipeableRowRef.current = ref;
      }
    },
    [replyMessage]
  );

  useEffect(() => {
    if (replyMessage && swipeableRowRef.current) {
      swipeableRowRef.current.close();
      swipeableRowRef.current = null;
    }
  }, [replyMessage]);

  const styles = generateStyles(theme);

  return (
    <ThemedView
      style={{
        flex: 1,
        backgroundColor: Colors[theme].background,
        marginBottom: insets.bottom,
      }}
    >
      <GiftedChat
        messages={messages}
        onSend={(messages: IMessage[]) => onSend(messages)}
        onInputTextChanged={setText}
        user={{
          _id: 1,
          name: "You",
        }}
        renderSystemMessage={(props) => (
          <SystemMessage
            {...props}
            textStyle={{ color: Colors[theme].gray2 }}
          />
        )}
        bottomOffset={insets.bottom}
        renderAvatar={null}
        maxComposerHeight={100}
        textInputProps={styles.composer}
        renderBubble={renderBubble}
        renderSend={renderSend}
        renderInputToolbar={renderInputToolbar}
        renderChatFooter={() => (
          <ReplyMessageBar
            clearReply={() => setReplyMessage(null)}
            message={replyMessage}
          />
        )}
        onLongPress={() => {}}
        renderMessage={(props) => (
          <ChatMessageBox
            {...props}
            setReplyOnSwipeOpen={setReplyMessage}
            updateRowRef={updateRowRef}
          />
        )}
        loadEarlier={true}
        infiniteScroll={true}
        isLoadingEarlier={messagesLoading}
        onLoadEarlier={() => {
          if (messagesHasMore) messagesLoadMore();
        }}
        renderLoadEarlier={() =>
          messagesLoading ? (
            <ActivityIndicator size="large" color={Colors.light.primary} />
          ) : null
        }
      />
    </ThemedView>
  );
};

const generateStyles = (theme) => {
  return StyleSheet.create({
    composer: {
      backgroundColor: Colors[theme].gray5,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: Colors[theme].gray4,
      paddingHorizontal: 10,
      paddingTop: 8,
      fontSize: 16,
      marginVertical: 4,
    },
    sendContainer: {
      height: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      paddingHorizontal: 14,
    },
    addButton: {
      height: 44,
      justifyContent: "center",
      alignItems: "center",
      left: 5,
    },
  });
};

export default Room;
