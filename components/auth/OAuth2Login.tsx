import { useEffect, useState } from "react";
import { StyleSheet, Platform, Pressable } from "react-native";
import { OAuthProvider } from "react-native-appwrite";
import {
  openAuthSessionAsync,
  WebBrowserAuthSessionResult,
} from "expo-web-browser";

import { createOAuth2Token, createSession } from "@/services/authService";
import { useColorScheme } from "@/hooks/useColorScheme";
import useSignInUser from "@/hooks/useSingInUser";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import GoogleSVG from "@/assets/images/oauth2/Google";
import AppleSVG from "@/assets/images/oauth2/Apple";
import FacebookSVG from "@/assets/images/oauth2/Facebook";
import DiscordSVG from "@/assets/images/oauth2/Discord";

const OAuth2Login = () => {
  const theme = useColorScheme() ?? "light";
  const signInUser = useSignInUser();
  const [browserResult, setBrowserResult] =
    useState<WebBrowserAuthSessionResult | null>(null);

  const signInWithProvider = async (provider: OAuthProvider) => {
    console.log(`Signing in with ${provider}`);
    const url = createOAuth2Token(provider);

    if (url) {
      const urlString = url.toString();
      console.log(urlString);

      if (Platform.OS !== "web") {
        // Prevent the default behavior of linking to the default browser on native.
        // event.preventDefault();
        const result = await openAuthSessionAsync(urlString);
        setBrowserResult(result);
      }
    } else {
      console.error("Failed to obtain URL for provider:", provider);
    }
  };

  useEffect(() => {
    const handleBrowserResult = async () => {
      if (browserResult) {
        console.log("Browser result:", browserResult, typeof browserResult);
        switch (browserResult.type) {
          case "success":
            console.log("Browser result success:", browserResult);
            const urlObject = new URL(browserResult.url);
            const secret = urlObject.searchParams.get("secret");
            const userId = urlObject.searchParams.get("userId");

            try {
              const session = await createSession(userId, secret);
              signInUser(session); // Use the custom hook to handle the sign-in process
            } catch (error) {
              console.error("Error creating session:", error);
            }
            break;
          case "cancel":
            console.log("Browser result cancel:", browserResult);
            break;
          case "dismiss":
            console.log("Browser result dismiss:", browserResult);
            break;
          default:
            console.log("Browser result unknown:", browserResult);
            break;
        }
      }
    };

    handleBrowserResult();
  }, [browserResult, signInUser]);

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.row}>
        <Pressable
          style={styles.button}
          onPress={() => signInWithProvider(OAuthProvider.Discord)}
        >
          <ThemedView style={styles.icon}>
            <DiscordSVG />
          </ThemedView>
        </Pressable>

        <Pressable
          style={styles.button}
          onPress={() => signInWithProvider(OAuthProvider.Google)}
        >
          <ThemedView style={styles.icon}>
            <GoogleSVG />
          </ThemedView>
        </Pressable>

        <Pressable
          style={styles.button}
          onPress={() => signInWithProvider(OAuthProvider.Facebook)}
        >
          <ThemedView style={styles.icon}>
            <FacebookSVG />
          </ThemedView>
        </Pressable>

        <Pressable
          style={styles.button}
          onPress={() => signInWithProvider(OAuthProvider.Apple)}
        >
          <ThemedView style={styles.icon}>
            <AppleSVG theme={theme} />
          </ThemedView>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    margin: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    // flexWrap: "wrap",
    width: "85%", // Adjust this value as needed
  },
  button: {
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
    margin: 10,
    borderRadius: 5,
    width: "20%", // Ensure the buttons are evenly spaced
  },
  icon: {
    width: 32,
    height: 32,
  },
});

export default OAuth2Login;
