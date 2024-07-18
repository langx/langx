import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "@/hooks/useColorScheme.web";
import { Colors } from "@/constants/Colors";

const ContextMenuWeb = ({ actions, onPress, children, style }) => {
  const theme = useColorScheme() === "dark" ? "dark" : "light";
  const [buttonVisible, setButtonVisible] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const handleMouseEnter = () => {
    setButtonVisible(true);
  };

  const handleMouseLeave = () => {
    setButtonVisible(false);
    setHoveredIndex(null);
  };

  const handleActionClick = (index) => {
    onPress({ nativeEvent: { index } });
  };

  const getColor = (index, hoveredIndex, theme) => {
    switch (index) {
      case 0:
        return hoveredIndex === index
          ? Colors[theme].success
          : Colors[theme].gray2;
      case 1:
        return hoveredIndex === index
          ? Colors[theme].secondary
          : Colors[theme].gray2;
      case 2:
        return hoveredIndex === index
          ? Colors[theme].primary
          : Colors[theme].gray2;
      case 3:
        return hoveredIndex === index
          ? Colors[theme].error
          : Colors[theme].gray2;
      // Add more cases as needed
      default:
        return Colors[theme].defaultColor;
    }
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
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleActionClick(index)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
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
                color={getColor(index, hoveredIndex, theme)}
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
