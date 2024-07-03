import { StyleSheet, useColorScheme } from "react-native";

import { Colors } from "@/constants/Colors";

const colorScheme = useColorScheme();

export const globalStyles = StyleSheet.create({
  block: {
    backgroundColor:
      colorScheme === "dark" ? Colors.dark.background : Colors.light.background,
    borderRadius: 10,
    marginHorizontal: 14,
    marginTop: 20,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 10,
  },
  separator: {
    height: 1,
    backgroundColor:
      colorScheme === "dark" ? Colors.dark.white : Colors.light.white,
    marginLeft: 50,
  },
});
