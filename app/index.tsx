import React from "react";
import { ScrollView, Text, View, StatusBar, Image } from "react-native";
import { Link } from "expo-router";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { SafeAreaView } from "react-native-safe-area-context";

import images from "@/constants/images";

const App = () => {
  return (
    <SafeAreaView className="bg-primary h-full">
      {/* <Loader isLoading={loading} /> */}

      <ThemedView className="w-full flex justify-center items-center px-4">
        <Image
          source={images.logo}
          className="w-[130px] h-[10px]"
          resizeMode="contain"
        />

        <Image
          source={images.cards}
          className="max-w-[380px] max-h-[500px] "
          resizeMode="contain"
        />

        <ThemedView className="relative mt-5">
          <Text className="text-3xl text-white font-bold text-center">
            Discover Endless{"\n"}
            Possibilities with <Text className="text-secondary-200">Aora</Text>
          </Text>

          <Image
            source={images.path}
            className="w-[136px] h-[15px] absolute -bottom-2 -right-8"
            resizeMode="contain"
          />
        </ThemedView>

        <Text className="text-sm font-pregular text-gray-100 mt-7 text-center">
          Where Creativity Meets Innovation: Embark on a Journey of Limitless
          Exploration with Aora
        </Text>

        {/* <CustomButton
            title="Continue with Email"
            handlePress={() => router.push("/sign-in")}
            containerStyles="w-full mt-7"
          /> */}
      </ThemedView>

      <StatusBar backgroundColor="#161622" style="light" />
    </SafeAreaView>
  );
};

export default App;
