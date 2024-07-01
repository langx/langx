import React from "react";
import { Text, Image } from "react-native";
import { Link } from "expo-router";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { SafeAreaView } from "react-native-safe-area-context";

import images from "@/constants/images";

const App = () => {
  return (
    <SafeAreaView>
      {/* <Loader isLoading={loading} /> */}

      <ThemedView>
        <ThemedText>
          <Link href="/home">Home</Link>
        </ThemedText>
        <Image source={images.logo} resizeMode="contain" />

        {/* <Image source={images.cards} resizeMode="contain" /> */}

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

export default App;
