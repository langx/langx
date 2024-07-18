import React from "react";
import { View } from "react-native";
import ContextMenu from "react-native-context-menu-view";

const ContextMenuNative = ({ children, ...props }) => {
  return <ContextMenu {...props}>{children}</ContextMenu>;
};

export default ContextMenuNative;
