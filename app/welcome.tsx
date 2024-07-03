import React from "react";
import { Image, StyleSheet, useColorScheme } from "react-native";

import { Colors } from "@/constants/Colors";
import images from "@/constants/images";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import ThemedButton from "@/components/atomic/ThemedButton";

const Welcome = () => {
  const colorScheme = useColorScheme();

  const loginWithEmailAndPassword = () => {};

  return (
    <ThemedView style={styles.container}>
      <Image
        source={colorScheme === "dark" ? images.logo_light : images.logo_dark}
        style={styles.logo}
        resizeMode="contain"
      />

      <ThemedText style={styles.headline}>Practice, Learn, Succeed!</ThemedText>

      <ThemedButton
        title={"Continue with Email"}
        handlePress={loginWithEmailAndPassword}
        isLoading={false}
      ></ThemedButton>
      <ThemedButton
        title={"Continue with Email"}
        handlePress={loginWithEmailAndPassword}
        isLoading={false}
      ></ThemedButton>
      <ThemedButton
        title={"Continue with Email"}
        handlePress={loginWithEmailAndPassword}
        isLoading={false}
      ></ThemedButton>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: "50%",
    height: 100,
  },
  headline: {
    textAlign: "center",
    fontSize: 16,
    fontFamily: "Comfortaa-Bold",
    marginVertical: 20,
  },
  welcomeImage: {
    width: "100%",
    marginVertical: 20,
  },
  description: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 80,
    color: Colors.light.medium,
  },
});

export default Welcome;
