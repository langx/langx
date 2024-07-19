import React, { useEffect, useState } from "react";
import { View, StyleSheet, Animated, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  GestureHandlerRootView,
  Swipeable,
} from "react-native-gesture-handler";
import { IMessage, Message, MessageProps } from "react-native-gifted-chat";
import { isSameDay, isSameUser } from "react-native-gifted-chat/lib/utils";

import { Colors } from "@/constants/Colors";
import { createJWT } from "@/services/authService";
import { getMessageImage } from "@/services/bucketService";

type ChatMessageBoxProps = {
  setReplyOnSwipeOpen: (message: IMessage) => void;
  updateRowRef: (ref: any) => void;
} & MessageProps<IMessage>;

const fetchImageWithAuth = async (imageId: string) => {
  const url = await getMessageImage(imageId);
  const jwt = (await createJWT()).jwt;
  const headers = {
    method: "GET",
    "x-appwrite-jwt": jwt,
  };

  const response = await fetch(url, {
    method: "GET",
    headers: headers,
  });
  // console.log("Response:", response);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

const ChatMessageBox = ({
  setReplyOnSwipeOpen,
  updateRowRef,
  ...props
}: ChatMessageBoxProps) => {
  const [updatedMessage, setUpdatedMessage] = useState(props.currentMessage);

  useEffect(() => {
    if (props.currentMessage.image) {
      const fetchImage = async () => {
        const uri = await fetchImageWithAuth(props.currentMessage.image);
        setUpdatedMessage({ ...props.currentMessage, image: uri });
      };
      fetchImage();
    } else {
      setUpdatedMessage({ ...props.currentMessage });
    }
  }, [props.currentMessage]);

  const isNextMyMessage =
    props.currentMessage &&
    props.nextMessage &&
    isSameUser(props.currentMessage, props.nextMessage) &&
    isSameDay(props.currentMessage, props.nextMessage);

  const renderAction = (
    progressAnimatedValue: Animated.AnimatedInterpolation<any>
  ) => {
    const size = progressAnimatedValue.interpolate({
      inputRange: [0, 1, 100],
      outputRange: [0, 1, 1],
    });

    return (
      <Animated.View
        style={[
          styles.container,
          { transform: [{ scale: size }] },
          isNextMyMessage
            ? styles.defaultBottomOffset
            : styles.bottomOffsetNext,
          props.position === "right" && styles.leftOffsetValue,
        ]}
      >
        <View style={styles.replyImageWrapper}>
          <Ionicons
            name="arrow-undo-circle-outline"
            size={26}
            color={Colors.light.gray2}
          />
        </View>
      </Animated.View>
    );
  };

  const onSwipeOpenAction = () => {
    if (props.currentMessage) {
      setReplyOnSwipeOpen({ ...props.currentMessage });
    }
  };

  return (
    <GestureHandlerRootView>
      <Swipeable
        ref={updateRowRef}
        friction={2}
        rightThreshold={40}
        renderLeftActions={
          props.currentMessage.user._id === 1 ? null : renderAction
        }
        renderRightActions={
          props.currentMessage.user._id === 0 ? null : renderAction
        }
        onSwipeableWillOpen={onSwipeOpenAction}
      >
        <Message {...props} currentMessage={updatedMessage} />
      </Swipeable>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 40,
  },
  replyImageWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  replyImage: {
    width: 20,
    height: 20,
  },
  defaultBottomOffset: {
    marginBottom: 2,
  },
  bottomOffsetNext: {
    marginBottom: 10,
  },
  leftOffsetValue: {
    marginLeft: 16,
  },
});

export default ChatMessageBox;
