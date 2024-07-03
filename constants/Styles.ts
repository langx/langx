import { StyleSheet, useColorScheme } from "react-native";

import { Colors } from "@/constants/Colors";

const scheme = useColorScheme();

export const globalStyles = StyleSheet.create({
  block: {
    backgroundColor:
      scheme === "dark" ? Colors.dark.background : Colors.light.background,
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
    backgroundColor: scheme === "dark" ? Colors.dark.light : Colors.light.light,
    marginLeft: 50,
  },
});
