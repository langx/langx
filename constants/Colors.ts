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
const grey0 = "#393e42";
const grey1 = "#43484d";
const grey2 = "#5e6977";
const grey3 = "#86939e";
const grey4 = "#bdc6cf";
const grey5 = "#e1e8ee";
const greyOutline = "#bbb";
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
    grey0: grey0,
    grey1: grey1,
    grey2: grey2,
    grey3: grey3,
    grey4: grey4,
    grey5: grey5,
    greyOutline: greyOutline,
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
    grey0: grey5,
    grey1: grey4,
    grey2: grey3,
    grey3: grey2,
    grey4: grey1,
    grey5: grey0,
    greyOutline: greyOutline,
    searchBg: searchBg,
  },
};
