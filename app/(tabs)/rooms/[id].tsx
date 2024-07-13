import React, { useState, useCallback, useEffect, useRef } from "react";
import { Platform, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import {
  GiftedChat,
  Bubble,
  InputToolbar,
  Send,
  SystemMessage,
  IMessage,
  Time,
} from "react-native-gifted-chat";

// import messagesData from "@/assets/data/messages.json";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useDatabase } from "@/hooks/useDatabase";
import { listMessages } from "@/services/messageService";
import { Colors } from "@/constants/Colors";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import ChatMessageBox from "@/components/rooms/ChatMessageBox";
import ReplyMessageBar from "@/components/rooms/ReplyMessageBar";

const Room = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  // console.log("Room id:", id);

  const theme = useColorScheme() === "dark" ? "dark" : "light";
  const insets = useSafeAreaInsets();

  const {
    data: messagesData,
    loading,
    loadMore,
    refetch,
    hasMore,
  } = useDatabase(listMessages, { roomId: id });

  useEffect(() => {
    console.log("msgs:", messagesData?.length);
  }, [messagesData]);

  const [messages, setMessages] = useState<IMessage[]>([]);
  const [text, setText] = useState("");

  const swipeableRowRef = useRef<Swipeable | null>(null);
  const [replyMessage, setReplyMessage] = useState<IMessage | null>(null);

  useEffect(() => {
    // console.log("messagesData:", messagesData.length, messagesData[0]);
    setMessages([
      ...messagesData.map((message) => {
        return {
          _id: message.$id,
          text: message.body,
          createdAt: new Date(message.$createdAt),
          user: {
            _id: message.from,
            name: message.from ? "You" : "John Doe",
          },
        };
      }),
      {
        _id: 0,
        system: true,
        text: "New messages from John Doe",
        createdAt: new Date(),
        user: {
          _id: 0,
          name: "Bot",
        },
      },
    ]);

    // Fix for invisible messages loading for "web"
    invisibleMessagesLoadingFix();
  }, [messagesData]);

  useEffect(() => {});

  const onSend = useCallback((newMessages = []) => {
    setMessages((previousMessages) =>
      GiftedChat.append(previousMessages, newMessages)
    );
  }, []);

  const renderBubble = (props) => {
    return (
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
          },
          right: {
            backgroundColor: Colors[theme].primary,
          },
        }}
        renderTime={renderCustomTime}
      />
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
        onSend={(messages: any) => onSend(messages)}
        onInputTextChanged={setText}
        user={{
          _id: 1,
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
        onLongPress={(context, message) => setReplyMessage(message)}
        renderMessage={(props) => (
          <ChatMessageBox
            {...props}
            setReplyOnSwipeOpen={setReplyMessage}
            updateRowRef={updateRowRef}
          />
        )}
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
