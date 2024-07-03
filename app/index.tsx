import React from "react";
import { Text, Image, StyleSheet, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";

import images from "@/constants/images";

const App = () => {
  const colorScheme = useColorScheme();
  return (
    <SafeAreaView>
      {/* <Loader isLoading={loading} /> */}

      <ThemedView style={styles.container}>
        <ThemedText>
          <Link href="/home">Home</Link>
        </ThemedText>
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
          Discover Endless{"\n"} Possibilities with <Text>Aora</Text>
        </ThemedText>

        <ThemedText>
          Where Creativity Meets Innovation: Embark on a Journey of Limitless
          Exploration with Aora
        </ThemedText>

        {/* <CustomButton
            title="Continue with Email"
            handlePress={() => router.push("/sign-in")}
            containerStyles="w-full mt-7"
          /> */}
      </ThemedView>

      {/* <StatusBar backgroundColor="#161622" style="light" /> */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    // flex: 1,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: "100%",
    height: 100,
  },
});

export default App;
