import React, { useEffect } from "react";
import { Image, StyleSheet, useColorScheme, Pressable } from "react-native";
import { Link, Redirect } from "expo-router";

import { Colors } from "@/constants/Colors";
import images from "@/constants/images";
import { ExternalLink } from "@/components/ExternalLink";
import { ThemedText } from "@/components/atomic/ThemedText";
import { ThemedView } from "@/components/atomic/ThemedView";

import { useSelector, useDispatch, Provider } from "react-redux";
import { setLoading, setUser } from "@/store/authSlice";
import store, { RootState } from "@/store/store";
import { getCurrentUser } from "@/services/appwrite";

const App = () => {
  const colorScheme = useColorScheme();

  const dispatch = useDispatch();
  const isLogged = useSelector((state: RootState) => state.auth.isLogged);
  const loading = useSelector((state: RootState) => state.auth.loading);

  useEffect(() => {
    const fetchData = async () => {
      dispatch(setLoading(true));
      try {
        const user = await getCurrentUser();
        dispatch(setUser(user));
      } catch (error) {
        console.error(error);
        dispatch(setUser(null));
      } finally {
        dispatch(setLoading(false));
      }
    };

    fetchData();
  }, [dispatch]);

  console.log("isLogged", isLogged);
  console.log("loading", loading);
  if (isLogged) {
    return <Redirect href="/home" />;
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

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
