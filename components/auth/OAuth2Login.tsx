import { TouchableOpacity, StyleSheet } from "react-native";
import { OAuthProvider } from "react-native-appwrite";

import { loginWithProvider } from "@/services/authService";
import { useColorScheme } from "@/hooks/useColorScheme";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import GoogleSVG from "@/assets/images/oauth2/Google";
import AppleSVG from "@/assets/images/oauth2/Apple";
import FacebookSVG from "@/assets/images/oauth2/Facebook";
import DiscordSVG from "@/assets/images/oauth2/Discord";

const OAuth2Login = () => {
  const theme = useColorScheme() ?? "light";

  const signInWithProvider = (provider: OAuthProvider) => {
    console.log(`Signing in with ${provider}`);
    loginWithProvider(provider);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.row}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => signInWithProvider(OAuthProvider.Discord)}
        >
          <ThemedView style={styles.icon}>
            <DiscordSVG />
          </ThemedView>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => signInWithProvider(OAuthProvider.Google)}
        >
          <ThemedView style={styles.icon}>
            <GoogleSVG />
          </ThemedView>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => signInWithProvider(OAuthProvider.Facebook)}
        >
          <ThemedView style={styles.icon}>
            <FacebookSVG />
          </ThemedView>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => signInWithProvider(OAuthProvider.Apple)}
        >
          <ThemedView style={styles.icon}>
            <AppleSVG theme={theme} />
          </ThemedView>
        </TouchableOpacity>
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
