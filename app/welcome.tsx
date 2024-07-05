import React, { useState } from "react";
import { Alert, Image, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useDispatch } from "react-redux";

import { getCurrentUser, createAnonymousSession } from "@/services/appwrite";
import { setLoading, setUser } from "@/store/authSlice";
import { ThemedText } from "@/components/atomic/ThemedText";
import { ThemedView } from "@/components/atomic/ThemedView";
import { ThemedButton } from "@/components/atomic/ThemedButton";
import { useColorScheme } from "@/hooks/useColorScheme";
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

    try {
      const session = await createAnonymousSession();
      const result = await getCurrentUser();

      dispatch(setUser(result));
      dispatch(setLoading(false));

      Alert.alert("Success", "User signed in successfully");
      router.replace("/home");
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setSubmitting(false);
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
          title="Login with Email"
          onPress={() => {
            navigateToLogin();
          }}
        ></ThemedButton>

        <ThemedButton
          title="Try Demo"
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
