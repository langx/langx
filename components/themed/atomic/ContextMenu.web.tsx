import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "@/hooks/useColorScheme.web";
import { Colors } from "@/constants/Colors";

const ContextMenuWeb = ({ children }) => {
  const theme = useColorScheme() === "dark" ? "dark" : "light";
  const [buttonVisible, setButtonVisible] = useState(false);

  const handleMouseEnter = () => {
    setButtonVisible(true);
  };

  const handleMouseLeave = () => {
    setButtonVisible(false);
  };

  const handleButtonClick = () => {
    alert("Button clicked!");
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ display: "flex", alignItems: "center", position: "relative" }}
    >
      {buttonVisible && (
        <div
          style={{
            display: "flex",
            gap: 5,
            marginRight: 5,
          }}
        >
          <button
            onClick={handleButtonClick}
            style={{
              cursor: "pointer",
              backgroundColor: "transparent",
              border: "none",
              fontSize: "16px",
            }}
          >
            <Ionicons
              name="ellipsis-vertical"
              size={20}
              color={Colors[theme].gray2}
            />
          </button>
          <button
            onClick={handleButtonClick}
            style={{
              cursor: "pointer",
              backgroundColor: "transparent",
              border: "none",
              fontSize: "16px",
            }}
          >
            <Ionicons
              name="arrow-undo-circle-outline"
              size={20}
              color={Colors[theme].gray2}
            />
          </button>
        </div>
      )}
      {children}
    </div>
  );
};

export default ContextMenuWeb;
