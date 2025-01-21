import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  PressableStateCallbackType,
} from "react-native";

import { Colors } from "@/constants/Colors";
import { useThemeColor } from "@/hooks/useThemeColor";

export type ThemedButtonProps = {
  lightColor?: string;
  darkColor?: string;
  title: string;
  type?: "default" | "primary" | "secondary" | "link" | "outline";
  onPress?: () => void;
  isLoading?: boolean;
  style?: ViewStyle | ViewStyle[];
};

export function ThemedButton({
  lightColor,
  darkColor,
  title,
  type = "default",
  style,
  onPress,
  isLoading,
  ...rest
}: ThemedButtonProps) {
  const color = Colors.light.black;
  const backgroundColor = useThemeColor(
    { light: lightColor, dark: darkColor },
    "primary"
  );
  const borderColor = Colors.light.primary;

  const getButtonStyle = (state: PressableStateCallbackType): ViewStyle[] => {
    return [
      styles.defaultButton,
      type === "outline" && {
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor,
      },
      type !== "outline" && { backgroundColor },
      ...(Array.isArray(style) ? style : [style]),
      state.pressed ? styles.pressed : undefined,
      isLoading ? styles.loading : undefined,
    ];
  };

  return (
    <Pressable style={getButtonStyle} onPress={onPress} {...rest}>
      <Text
        style={[
          styles.buttonText,
          { color: type === "outline" ? Colors.light.gray2 : color },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  defaultButton: {
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontFamily: "Lexend-Regular",
  },
  pressed: {
    opacity: 0.8,
  },
  loading: {
    opacity: 0.5,
  },
});
