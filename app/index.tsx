import React from "react";
import {
  Text,
  Image,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";

import { Colors } from "@/constants/Colors";
import images from "@/constants/images";

import { ThemedText } from "@/components/ThemedText";

const App = () => {
  const colorScheme = useColorScheme();

  const containerStyle = {
    ...styles.container,
    backgroundColor:
      colorScheme === "dark" ? Colors.dark.background : Colors.light.background,
  };

  const openLink = () => {};

  return (
    <SafeAreaView style={containerStyle}>
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

      <Link href={"/home"} replace asChild>
        <TouchableOpacity style={styles.button}>
          <ThemedText type="link" style={styles.buttonText}>
            Agree & Continue
          </ThemedText>
        </TouchableOpacity>
      </Link>
    </SafeAreaView>
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
    color: Colors.light.medium,
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
