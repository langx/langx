import React, { useState, useCallback, useEffect, useRef } from "react";
import { ActivityIndicator, Platform, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { v4 as uuidv4 } from "uuid";
import ContextMenu from "react-native-context-menu-view";
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
import { setRoom, setRoomMessages } from "@/store/roomSlice";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useDatabase } from "@/hooks/useDatabase";
import { useAuth } from "@/hooks/useAuth";
import { createMessage, listMessages } from "@/services/messageService";
import { listRooms } from "@/services/roomService";
import { Colors } from "@/constants/Colors";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import ChatMessageBox from "@/components/rooms/ChatMessageBox";
import ReplyMessageBar from "@/components/rooms/ReplyMessageBar";
import { createMessageRequestInterface } from "@/models/requests/createMessageRequest.interface";

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
      }));

      setMessages([...updatedMessages]);
    }
    // Fix for invisible messages loading for "web"
    invisibleMessagesLoadingFix();
  }, [room]);

  // Send message
  const onSend = useCallback(
    (newMessages = []) => {
      const currentUserId = currentUser.$id;
      newMessages.forEach((message) => {
        message.pending = true;
        message._id = uuidv4().replace(/-/g, "");

        const newMessage: createMessageRequestInterface = {
          $id: message._id,
          to: room.userData.$id,
          body: message.text,
          roomId: id,
          type: "body",
          replyTo: null,
        };
        createMessage({ newMessage, currentUserId, jwt });
      });
      setMessages((previousMessages) =>
        GiftedChat.append(previousMessages, newMessages)
      );
    },
    [room]
  );

  const renderBubble = (props) => {
    return (
      <ContextMenu
        actions={[
          { title: "Option 1" },
          { title: "Option 2" },
          { title: "Option 3" },
        ]}
        onPress={(e) => {
          console.warn(
            `Pressed ${e.nativeEvent.name} at index ${e.nativeEvent.index}`
          );
        }}
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
            },
            right: {
              backgroundColor: Colors[theme].primary,
              padding: 0,
              margin: 0,
            },
          }}
          containerToPreviousStyle={{
            left: {
              marginBottom: 0,
            },
            right: {
              marginBottom: 0,
            },
          }}
          containerToNextStyle={{
            left: {
              marginBottom: 0,
            },
            right: {
              marginBottom: 0,
            },
          }}
          containerStyle={{
            left: {
              marginBottom: 0,
            },
            right: {
              marginBottom: 0,
            },
          }}
          renderTime={renderCustomTime}
        />
      </ContextMenu>
    );
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
          left: { color: Colors[theme].gray1 },
          right: { color: Colors[theme].gray3 },
        }}
      />
    );
  };

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
        // renderTicks={(message) => renderTicks({ currentMessage: message })}
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

// Fix for invisible messages loading
// https://github.com/FaridSafi/react-native-gifted-chat/issues/2448
function invisibleMessagesLoadingFix() {
  if (Platform.OS === "web") {
    const gcLoadingContaineEl = document.querySelectorAll(
      '[data-testid="GC_LOADING_CONTAINER"]'
    )[0] as HTMLElement;
    if (gcLoadingContaineEl) {
      gcLoadingContaineEl.style.display = "none";
      setTimeout(() => {
        gcLoadingContaineEl.style.display = "flex";
      }, 500);
    }
  }
}

export default Room;
