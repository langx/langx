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

      <ThemedView style={style.container}>
        <ThemedText>
          <Link href="/home">Home</Link>
        </ThemedText>
        <Image
          source={colorScheme === "dark" ? images.logo_light : images.logo_dark}
          style={{
            width: 250,
          }}
          resizeMode="contain"
        />

        <Image
          source={images.cards}
          width={10}
          height={10}
          resizeMode="repeat"
        />

        <ThemedView>
          <ThemedText>
            Discover Endless{"\n"}
            Possibilities with <Text>Aora</Text>
          </ThemedText>

          <Image source={images.path} resizeMode="contain" />
        </ThemedView>

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

const style = StyleSheet.create({
  container: {
    padding: 20,
  },
});

export default App;
