/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const primary = "#ffc409";
const secondary = "#ff571a";
const tertiary = "#5260ff";
const success = "#2dd36f";
const warning = "#ffc409";
const error = "#eb445a";
const black = "#222428";
const white = "#f4f5f8";
const gray0 = "#393e42";
const gray1 = "#43484d";
const gray2 = "#5e6977";
const gray3 = "#86939e";
const gray4 = "#bdc6cf";
const gray5 = "#e1e8ee";
const grayOutline = "#bbb";
const searchBg = "#303337";

export const Colors = {
  light: {
    primary: primary,
    secondary: secondary,
    tertiary: tertiary,
    success: success,
    warning: warning,
    error: error,
    black: black,
    white: white,
    background: white,
    gray0: gray0,
    gray1: gray1,
    gray2: gray2,
    gray3: gray3,
    gray4: gray4,
    gray5: gray5,
    grayOutline: grayOutline,
    searchBg: searchBg,
  },
  dark: {
    primary: primary,
    secondary: secondary,
    tertiary: tertiary,
    success: success,
    warning: warning,
    error: error,
    black: white,
    white: black,
    background: black,
    gray0: gray5,
    gray1: gray4,
    gray2: gray3,
    gray3: gray2,
    gray4: gray1,
    gray5: gray0,
    grayOutline: grayOutline,
    searchBg: searchBg,
  },
};
