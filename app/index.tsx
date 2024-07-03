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

      <Image
        source={images.thumbnail}
        style={styles.welcomeImage}
        resizeMode="contain"
      />

      <ThemedText style={styles.headline}>Practice, Learn, Succeed!</ThemedText>

      <ThemedText style={styles.description}>
        Read our{" "}
        <Text style={styles.link} onPress={openLink}>
          Privacy Policy
        </Text>
        . {'Tap "Agree & Continue" to accept the '}
        <Text style={styles.link} onPress={openLink}>
          Terms of Service
        </Text>{" "}
        .
      </ThemedText>

      <Link href={"/home"} replace asChild>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Agree & Continue</Text>
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
    marginBottom: 50,
  },
  welcomeImage: {
    width: "100%",
  },
  headline: {
    textAlign: "center",
    fontSize: 20,
    fontFamily: "Comfortaa-Bold",
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
