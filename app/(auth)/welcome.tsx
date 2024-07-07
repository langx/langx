import React, { useState } from "react";
import { Alert, Image, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useDispatch } from "react-redux";

import { useColorScheme } from "@/hooks/useColorScheme";
import { createAnonymousSession } from "@/services/authService";
import { setGuest, setLoading } from "@/store/authSlice";
import { ThemedText } from "@/components/atomic/ThemedText";
import { ThemedView } from "@/components/atomic/ThemedView";
import { ThemedButton } from "@/components/atomic/ThemedButton";
import images from "@/constants/images";

const Welcome = () => {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const dispatch = useDispatch();

  const [isSubmitting, setSubmitting] = useState(false);

  const navigateToLogin = () => {
    router.navigate("/login");
  };

  const demo = async () => {
    setSubmitting(true);
    dispatch(setLoading(true));

    try {
      const session = await createAnonymousSession();
      dispatch(setGuest(true));

      Alert.alert("Success", "User signed in successfully");
      router.replace("/home");
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setSubmitting(false);
      dispatch(setLoading(false));
    }
  };

  return (
    <ThemedView style={styles.container}>
      <Image
        source={colorScheme === "dark" ? images.logo_light : images.logo_dark}
        style={styles.logo}
        resizeMode="contain"
      />

      <ThemedText style={styles.headline}>Practice, Learn, Succeed!</ThemedText>

      <ThemedView style={{ gap: 10 }}>
        <ThemedButton
          title="Log In with Email"
          onPress={() => {
            navigateToLogin();
          }}
        ></ThemedButton>

        <ThemedButton
          title="Log In As a Guest"
          onPress={demo}
          isLoading={isSubmitting}
        />
      </ThemedView>
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
    width: 200,
    height: 100,
  },
  headline: {
    textAlign: "center",
    fontSize: 16,
    fontFamily: "Comfortaa-Bold",
    margin: 20,
  },
});

export default Welcome;
