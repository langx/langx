import React from "react";
import { Image, StyleSheet, Pressable, StatusBar } from "react-native";
import { router } from "expo-router";

import { Colors } from "@/constants/Colors";
import images from "@/constants/images";
import { useColorScheme } from "@/hooks/useColorScheme";
import { ExternalLink } from "@/components/ExternalLink";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import ParallaxScrollView from "@/components/ParallaxScrollView";

const App = () => {
  const colorScheme = useColorScheme();

  return (
    <>
      <StatusBar hidden={true} />
      <ParallaxScrollView
        headerBackgroundColor={{
          light: Colors.light.primary,
          dark: Colors.dark.primary,
        }}
        headerImage={
          <Image source={images.thumbnail} style={styles.featuredImage} />
        }
      >
        <ThemedView style={styles.container}>
          <Image
            source={
              colorScheme === "dark" ? images.logo_light : images.logo_dark
            }
            style={styles.logo}
            resizeMode="contain"
          />

          <ThemedText style={styles.headline}>
            Practice, Learn, Succeed!
          </ThemedText>

          <ThemedText style={styles.description}>
            {"Read our "}
            <ExternalLink href="https://langx.io/privacy-policy">
              <ThemedText style={styles.link}>Privacy Policy</ThemedText>
            </ExternalLink>
            . {'Tap "Agree & Continue" to accept the '}
            <ExternalLink href="https://langx.io/terms-conditions">
              <ThemedText style={styles.link}>Terms of Service</ThemedText>
            </ExternalLink>
            {"."}
          </ThemedText>

          <Pressable
            style={styles.button}
            onPress={() => router.push("/(auth)")}
          >
            <ThemedText type="link" style={styles.buttonText}>
              Agree & Continue
            </ThemedText>
          </Pressable>
        </ThemedView>
      </ParallaxScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  featuredImage: {
    objectFit: "cover",
    height: "100%",
    width: "100%",
  },
  logo: {
    width: 200,
    height: 100,
    margin: 10,
  },
  headline: {
    textAlign: "center",
    fontSize: 16,
    fontFamily: "Comfortaa-Bold",
    margin: 10,
    flex: 1,
  },
  description: {
    flex: 1,
    fontSize: 14,
    textAlign: "center",
    margin: 10,
    color: Colors.light.gray3,
  },
  link: {
    color: Colors.light.secondary,
  },
  button: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    margin: 50,
  },
  buttonText: {
    color: Colors.light.secondary,
    fontSize: 22,
    fontWeight: "500",
  },
});

export default App;
