import React, { useEffect } from "react";
import { Image, StyleSheet, Pressable, StatusBar } from "react-native";
import { Link, Redirect } from "expo-router";
import { useSelector, useDispatch } from "react-redux";

import { fetchAuthData } from "@/store/authSlice";
import { RootState } from "@/store/store";
import { Colors } from "@/constants/Colors";
import images from "@/constants/images";
import { ExternalLink } from "@/components/ExternalLink";
import { ThemedText } from "@/components/atomic/ThemedText";
import { ThemedView } from "@/components/atomic/ThemedView";
import ParallaxScrollView from "@/components/ParallaxScrollView";
import { useColorScheme } from "@/hooks/useColorScheme";

const App = () => {
  const colorScheme = useColorScheme();

  const dispatch = useDispatch();
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  const isGuestIn = useSelector((state: RootState) => state.auth.isGuestIn);
  const isLoading = useSelector((state: RootState) => state.auth.isLoading);

  useEffect(() => {
    dispatch(fetchAuthData());
  }, [dispatch]);

  if (isLoggedIn || isGuestIn) {
    return <Redirect href="/home" />;
  }

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

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

          <Link href={"/welcome"} replace asChild>
            <Pressable style={styles.button}>
              <ThemedText type="link" style={styles.buttonText}>
                Agree & Continue
              </ThemedText>
            </Pressable>
          </Link>
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
    color: Colors.light.primary,
  },
  button: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    margin: 50,
  },
  buttonText: {
    color: Colors.light.primary,
    fontSize: 22,
    fontWeight: "500",
  },
});

export default App;
