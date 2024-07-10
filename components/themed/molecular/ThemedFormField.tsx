import { useState } from "react";
import { TextInput, Image, Pressable } from "react-native";

import icons from "@/constants/icons";

import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { ThemedView } from "@/components/themed/atomic/ThemedView";

const FormField = ({
  title,
  value,
  placeholder,
  handleChangeText,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <ThemedView>
      <ThemedText>{title}</ThemedText>

      <ThemedView>
        <TextInput
          value={value}
          placeholder={placeholder}
          onChangeText={handleChangeText}
          secureTextEntry={title === "Password" && !showPassword}
          {...props}
        />

        {title === "Password" && (
          <Pressable onPress={() => setShowPassword(!showPassword)}>
            <Image
              source={!showPassword ? icons.eye : icons.eyeHide}
              resizeMode="contain"
              style={{ width: 20, height: 20 }}
            />
          </Pressable>
        )}
      </ThemedView>
    </ThemedView>
  );
};

export default FormField;
