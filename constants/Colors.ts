/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const primary = "#ffc409";
const secondary = "#ff571a";
const tertiary = "#5260ff";
const success = "#2dd36f";
const warnign = "#ffc409";
const danger = "#eb445a";
const dark = "#222428";
const medium = "#92949c";
const light = "#f4f5f8";

export const Colors = {
  light: {
    primary: primary,
    secondary: secondary,
    tertiary: tertiary,
    success: success,
    warning: warnign,
    danger: danger,
    dark: dark,
    medium: medium,
    light: light,
    text: dark,
    background: light,
    tint: primary,
    icon: medium,
    tabIconDefault: medium,
    tabIconSelected: primary,
  },
  dark: {
    primary: primary,
    secondary: secondary,
    tertiary: tertiary,
    success: success,
    warning: warnign,
    danger: danger,
    dark: light,
    medium: medium,
    light: dark,
    text: light,
    background: dark,
    tint: primary,
    icon: medium,
    tabIconDefault: medium,
    tabIconSelected: primary,
  },
};
