import React from "react";
import { Image, StyleSheet, useColorScheme } from "react-native";
import { useRouter } from "expo-router";

import images from "@/constants/images";

import { ThemedText } from "@/components/atomic/ThemedText";
import { ThemedView } from "@/components/atomic/ThemedView";
import { ThemedButton } from "@/components/atomic/ThemedButton";

const Welcome = () => {
  const colorScheme = useColorScheme();
  const router = useRouter();

  const navigateToLogin = () => {
    router.navigate("/login");
  };

  return (
    <ThemedView style={styles.container}>
      <Image
        source={colorScheme === "dark" ? images.logo_light : images.logo_dark}
        style={styles.logo}
        resizeMode="contain"
      />

      <ThemedText style={styles.headline}>Practice, Learn, Succeed!</ThemedText>

      <ThemedButton
        title="Login with Email"
        style={styles.button}
        onPress={() => {
          navigateToLogin();
        }}
      ></ThemedButton>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 200,
    height: 100,
  },
  headline: {
    textAlign: "center",
    fontSize: 16,
    fontFamily: "Comfortaa-Bold",
    margin: 20,
  },
  button: {
    margin: 20,
  },
});

export default Welcome;
