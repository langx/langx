import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "@/hooks/useColorScheme.web";
import { Colors } from "@/constants/Colors";

const ContextMenuWeb = ({ actions, onPress, children, style }) => {
  const theme = useColorScheme() === "dark" ? "dark" : "light";
  const [buttonVisible, setButtonVisible] = useState(false);

  const handleMouseEnter = () => {
    setButtonVisible(true);
  };

  const handleMouseLeave = () => {
    setButtonVisible(false);
  };

  const handleActionClick = (index) => {
    onPress({ nativeEvent: { index } });
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        position: "relative",
      }}
    >
      {buttonVisible && (
        <div style={{ display: "flex", gap: 3, marginRight: 6 }}>
          {[...actions].reverse().map((action, index) => (
            <button
              key={index}
              onClick={() => handleActionClick(index)}
              style={{
                cursor: "pointer",
                backgroundColor: "transparent",
                border: "none",
                fontSize: "14px",
              }}
            >
              <Ionicons
                name={action.IonIcon}
                size={20}
                color={Colors[theme].gray2}
              />
            </button>
          ))}
        </div>
      )}
      {children}
    </div>
  );
};

export default ContextMenuWeb;
