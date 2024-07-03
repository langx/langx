import React from "react";
import { Text, Image, StyleSheet, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";

import { ThemedText } from "@/components/ThemedText";

import { Colors } from "@/constants/Colors";
import images from "@/constants/images";

const App = () => {
  const colorScheme = useColorScheme();

  const containerStyle = {
    ...styles.container,
    backgroundColor:
      colorScheme === "dark" ? Colors.dark.background : Colors.light.background,
  };

  return (
    <SafeAreaView style={containerStyle}>
      {/* <Loader isLoading={loading} /> */}

      <Image
        source={colorScheme === "dark" ? images.logo_light : images.logo_dark}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* <Image
          source={images.cards}
          width={10}
          height={10}
          resizeMode="repeat"
        /> */}

      <ThemedText>
        <Link
          href="/home"
          style={{ fontSize: 20, fontFamily: "Comfortaa", paddingTop: 20 }}
        >
          Home
        </Link>
      </ThemedText>

      <ThemedText style={{ textAlign: "center", paddingTop: 40 }}>
        Where Creativity Meets Innovation: Embark on a Journey of Limitless
        Exploration with Aora
      </ThemedText>

      {/* <CustomButton
            title="Continue with Email"
            handlePress={() => router.push("/sign-in")}
            containerStyles="w-full mt-7"
          /> */}

      {/* <StatusBar backgroundColor="#161622" style="light" /> */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: "100%",
    height: 100,
  },
});

export default App;
