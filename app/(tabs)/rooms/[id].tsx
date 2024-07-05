import React, { useState, useCallback, useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  GiftedChat,
  Bubble,
  InputToolbar,
  Send,
  SystemMessage,
  IMessage,
  Time,
} from "react-native-gifted-chat";

import messagesData from "@/assets/data/messages.json";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/constants/Colors";
import { ThemedView } from "@/components/atomic/ThemedView";
import ChatMessageBox from "@/components/ChatMessageBox";
import ReplyMessageBar from "@/components/ReplyMessageBar";

const Room = () => {
  const theme = useColorScheme() === "dark" ? "dark" : "light";
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [text, setText] = useState("");
  const [replyMessage, setReplyMessage] = useState<IMessage | null>(null);

  const swipeableRowRef = useRef<Swipeable | null>(null);

  useEffect(() => {
    setMessages([
      ...messagesData.map((message) => {
        return {
          _id: message.id,
          text: message.msg,
          createdAt: new Date(message.date),
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
  }, []);

  const onSend = useCallback((messages = []) => {
    setMessages((previousMessages) =>
      GiftedChat.append(previousMessages, messages)
    );
  }, []);

  const renderBubble = (props) => {
    return (
      <Bubble
        {...props}
        textStyle={{
          left: {
            color: Colors[theme].black,
          },
          right: {
            color: Colors.light.black,
          },
        }}
        wrapperStyle={{
          left: {
            backgroundColor: Colors[theme].white,
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
          <ThemedView
            style={{
              height: 44,
              justifyContent: "center",
              alignItems: "center",
              left: 5,
            }}
          >
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
          left: { color: Colors[theme].grey3 },
          right: { color: Colors[theme].grey1 },
        }}
      />
    );
  };

  const renderSend = (props) => {
    return (
      <ThemedView
        style={{
          height: 44,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          paddingHorizontal: 14,
        }}
      >
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

  return (
    <GiftedChat
      messages={messages}
      onSend={(messages: any) => onSend(messages)}
      onInputTextChanged={setText}
      user={{
        _id: 1,
      }}
      renderSystemMessage={(props) => (
        <SystemMessage {...props} textStyle={{ color: Colors[theme].grey2 }} />
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
  );
};

const styles = StyleSheet.create({
  composer: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.light.grey5,
    paddingHorizontal: 10,
    paddingTop: 8,
    fontSize: 16,
    marginVertical: 4,
  },
});

export default Room;
