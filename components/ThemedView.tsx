import { View, type ViewProps } from "react-native";

import { useThemeColor } from "@/hooks/useThemeColor";

import { styled } from "nativewind";
const StyledView = styled(View);

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  className?: string;
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  className,
  ...otherProps
}: ThemedViewProps) {
  const backgroundColor = useThemeColor(
    { light: lightColor, dark: darkColor },
    "background"
  );

  return (
    <StyledView
      className={className ? className : ""}
      style={[{ backgroundColor }, style]}
      {...otherProps}
    />
  );
}
