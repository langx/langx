import React from "react";
import { Platform } from "react-native";
import ContextMenuNative from "@/components/themed/atomic/ContextMenu";
import ContextMenuWeb from "@/components/themed/atomic/ContextMenu.web";

const ContextMenu = (props) => {
  if (Platform.OS === "web") {
    return <ContextMenuWeb {...props} />;
  }
  return <ContextMenuNative {...props} />;
};

export default ContextMenu;
