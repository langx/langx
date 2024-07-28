import { TouchableOpacity, StyleSheet } from "react-native";
import { OAuthProvider } from "react-native-appwrite";
import Svg, { Path } from "react-native-svg";

import { loginWithProvider } from "@/services/authService";
import { useColorScheme } from "@/hooks/useColorScheme";
import { ThemedView } from "@/components/themed/atomic/ThemedView";

const DiscordSVG = () => (
  <Svg viewBox="0 0 48 48">
    <Path
      fill="#5865F2"
      d="M 40.660156 8.457031 C 37.554688 7 34.230469 5.945312 30.757812 5.34375 C 30.332031 6.113281 29.832031 7.152344 29.488281 7.976562 C 25.796875 7.421875 22.140625 7.421875 18.515625 7.976562 C 18.171875 7.152344 17.660156 6.113281 17.230469 5.34375 C 13.753906 5.945312 10.425781 7.003906 7.320312 8.464844 C 1.054688 17.933594 -0.644531 27.167969 0.203125 36.273438 C 4.359375 39.378906 8.390625 41.261719 12.347656 42.496094 C 13.328125 41.152344 14.199219 39.71875 14.949219 38.210938 C 13.519531 37.667969 12.148438 36.996094 10.855469 36.21875 C 11.199219 35.964844 11.535156 35.699219 11.859375 35.425781 C 19.757812 39.117188 28.335938 39.117188 36.140625 35.425781 C 36.46875 35.699219 36.804688 35.964844 37.144531 36.21875 C 35.847656 37 34.472656 37.671875 33.042969 38.214844 C 33.792969 39.71875 34.660156 41.15625 35.644531 42.5 C 39.605469 41.265625 43.640625 39.382812 47.796875 36.273438 C 48.792969 25.71875 46.09375 16.570312 40.660156 8.457031 Z M 16.027344 30.675781 C 13.65625 30.675781 11.710938 28.460938 11.710938 25.765625 C 11.710938 23.070312 13.613281 20.851562 16.027344 20.851562 C 18.4375 20.851562 20.382812 23.066406 20.339844 25.765625 C 20.34375 28.460938 18.4375 30.675781 16.027344 30.675781 Z M 31.972656 30.675781 C 29.601562 30.675781 27.660156 28.460938 27.660156 25.765625 C 27.660156 23.070312 29.5625 20.851562 31.972656 20.851562 C 34.386719 20.851562 36.332031 23.066406 36.289062 25.765625 C 36.289062 28.460938 34.386719 30.675781 31.972656 30.675781 Z M 31.972656 30.675781 "
    />
  </Svg>
);

const GoogleSVG = () => (
  <Svg viewBox="0 0 48 48">
    <Path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <Path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <Path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <Path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
    <Path fill="none" d="M0 0h48v48H0z" />
  </Svg>
);

const AppleSVG = () => {
  const theme = useColorScheme() ?? "light";
  return (
    <Svg viewBox="-4.5 0 48 48">
      <Path
        fill={theme === "light" ? "#000" : "#fff"}
        d="M 37.757812 16.023438 C 37.480469 16.234375 32.574219 18.945312 32.574219 24.976562 C 32.574219 31.949219 38.816406 34.417969 39.003906 34.480469 C 38.976562 34.628906 38.011719 37.859375 35.714844 41.148438 C 33.664062 44.042969 31.519531 46.933594 28.261719 46.933594 C 25.003906 46.933594 24.167969 45.078125 20.40625 45.078125 C 16.742188 45.078125 15.4375 46.996094 12.457031 46.996094 C 9.476562 46.996094 7.398438 44.316406 5.007812 41.027344 C 2.238281 37.164062 0 31.160156 0 25.464844 C 0 16.328125 6.054688 11.480469 12.015625 11.480469 C 15.183594 11.480469 17.824219 13.523438 19.8125 13.523438 C 21.703125 13.523438 24.65625 11.359375 28.257812 11.359375 C 29.625 11.359375 34.53125 11.480469 37.757812 16.023438 Z M 26.546875 7.492188 C 28.039062 5.757812 29.09375 3.351562 29.09375 0.945312 C 29.09375 0.609375 29.0625 0.273438 29 0 C 26.578125 0.0898438 23.691406 1.582031 21.953125 3.5625 C 20.585938 5.085938 19.3125 7.492188 19.3125 9.929688 C 19.3125 10.296875 19.375 10.664062 19.402344 10.78125 C 19.558594 10.808594 19.804688 10.84375 20.054688 10.84375 C 22.230469 10.84375 24.964844 9.414062 26.546875 7.492188 Z"
      />
    </Svg>
  );
};

const FacebookSVG = () => (
  <Svg viewBox="0 0 48 48">
    <Path
      fill="#1877F2"
      d="M 48 24 C 48 10.746094 37.253906 0 24 0 C 10.746094 0 0 10.746094 0 24 C 0 35.976562 8.773438 45.90625 20.25 47.710938 L 20.25 30.9375 L 14.15625 30.9375 L 14.15625 24 L 20.25 24 L 20.25 18.710938 C 20.25 12.695312 23.835938 9.371094 29.316406 9.371094 C 31.941406 9.371094 34.6875 9.839844 34.6875 9.839844 L 34.6875 15.746094 L 31.660156 15.746094 C 28.679688 15.746094 27.75 17.597656 27.75 19.496094 L 27.75 24 L 34.40625 24 L 33.34375 30.9375 L 27.75 30.9375 L 27.75 47.710938 C 39.226562 45.910156 48 35.980469 48 24 Z"
    />
  </Svg>
);

const OAuth2Login = () => {
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
            <AppleSVG />
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
