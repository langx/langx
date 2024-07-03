import React from "react";
import {
  Image,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
} from "react-native";
import { Link } from "expo-router";

import { Colors } from "@/constants/Colors";
import images from "@/constants/images";

import { ThemedText } from "@/components/atomic/ThemedText";
import { ThemedView } from "@/components/atomic/ThemedView";

const App = () => {
  const colorScheme = useColorScheme();

  const openLink = () => {};

  return (
    <ThemedView style={styles.container}>
      <Image
        source={colorScheme === "dark" ? images.logo_light : images.logo_dark}
        style={styles.logo}
        resizeMode="contain"
      />

      <ThemedText style={styles.headline}>Practice, Learn, Succeed!</ThemedText>

      <Image
        source={images.thumbnail}
        style={styles.welcomeImage}
        resizeMode="contain"
      />

      <ThemedText style={styles.description}>
        Read our{" "}
        <ThemedText style={styles.link} onPress={openLink}>
          Privacy Policy
        </ThemedText>
        . {'Tap "Agree & Continue" to accept the '}
        <ThemedText style={styles.link} onPress={openLink}>
          Terms of Service
        </ThemedText>{" "}
        .
      </ThemedText>

      <Link href={"/welcome"} replace asChild>
        <TouchableOpacity style={styles.button}>
          <ThemedText type="link" style={styles.buttonText}>
            Agree & Continue
          </ThemedText>
        </TouchableOpacity>
      </Link>
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
  },
  welcomeImage: {
    width: "100%",
    marginVertical: 20,
  },

  description: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 80,
    color: Colors.light.grey3,
  },
  link: {
    color: Colors.light.primary,
  },
  button: {
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: Colors.light.primary,
    fontSize: 22,
    fontWeight: "500",
  },
});

export default App;
