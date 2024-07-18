import React, { useState } from "react";

const ContextMenuWeb = ({ children, options, onOptionSelect }) => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleContextMenu = (event) => {
    event.preventDefault();
    console.log("Context menu triggered at:", event.pageX, event.pageY); // Log the position
    setPosition({ x: event.pageX, y: event.pageY });
    setVisible(true);
  };

  const handleOptionSelect = (option) => {
    console.log("Option selected:", option); // Log the selected option
    onOptionSelect(option);
    setVisible(false);
  };

  console.log("ContextMenu visibility:", visible); // Log visibility changes

  return (
    <div onContextMenu={handleContextMenu} style={{ display: "inline-block" }}>
      {children}
      {visible && (
        <ul
          style={{
            position: "absolute",
            top: position.y,
            left: position.x,
            backgroundColor: "white",
            boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
            listStyle: "none",
            padding: 0,
            margin: 0,
            zIndex: 1000,
          }}
          onClick={() => setVisible(false)}
        >
          {options.map((option, index) => (
            <li
              key={index}
              onClick={() => handleOptionSelect(option)}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                borderBottom: "1px solid #ccc",
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ContextMenuWeb;
