import React, { useCallback, useEffect, useState } from "react";
import { FlatList, SafeAreaView, StyleSheet, Pressable } from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuth } from "@/hooks/useAuth";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/constants/Colors";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import LanguageFilterSection from "@/components/home/filters/LanguageFilterSection";
import GenderFilterSection from "@/components/home/filters/GenderFilterSection";
import CountryFilterSection from "@/components/home/filters/CountryFilterSection";
import AgeFilterSection from "@/components/home/filters/AgeFilterSection";

const Filters = () => {
  const theme = useColorScheme() ?? "light";
  const { currentUser } = useAuth();
  const languages = currentUser?.languages;

  const initialState = {
    studyLanguages: [],
    motherLanguages: [],
    gender: null,
    isMatchMyGender: null,
    country: null,
    ageRange: [13, 100],
  };

  const [studyLanguages, setStudyLanguages] = useState(
    initialState.studyLanguages
  );
  const [motherLanguages, setMotherLanguages] = useState(
    initialState.motherLanguages
  );
  const [gender, setGender] = useState(initialState.gender);
  const [isMatchMyGender, setIsMatchMyGender] = useState(
    initialState.isMatchMyGender
  );
  const [country, setCountry] = useState(initialState.country);
  const [ageRange, setAgeRange] = useState(initialState.ageRange);

  const components = [
    {
      component: (
        <LanguageFilterSection
          languages={languages}
          studyLanguages={studyLanguages}
          setStudyLanguages={setStudyLanguages}
          motherLanguages={motherLanguages}
          setMotherLanguages={setMotherLanguages}
        />
      ),
      key: "LanguagesFilterSection",
    },
    {
      component: (
        <GenderFilterSection
          gender={gender}
          setGender={setGender}
          isMatchMyGender={isMatchMyGender}
          setIsMatchMyGender={setIsMatchMyGender}
        />
      ),
      key: "GenderFilterSection",
    },
    {
      component: (
        <AgeFilterSection ageRange={ageRange} setAgeRange={setAgeRange} />
      ),
      key: "AgeFilterSection",
    },
    {
      component: (
        <CountryFilterSection country={country} setCountry={setCountry} />
      ),
      key: "CountryFilterSection",
    },
  ];

  const resetFilters = async () => {
    setStudyLanguages(initialState.studyLanguages);
    setMotherLanguages(initialState.motherLanguages);
    setGender(initialState.gender);
    setIsMatchMyGender(initialState.isMatchMyGender);
    setCountry(initialState.country);
    setAgeRange(initialState.ageRange);
    try {
      await AsyncStorage.removeItem("filters");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (error) {
      console.error("Failed to reset filters", error);
    }
  };

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const savedFilters = await AsyncStorage.getItem("filters");
        if (savedFilters) {
          const {
            studyLanguages,
            motherLanguages,
            gender,
            isMatchMyGender,
            country,
            ageRange,
          } = JSON.parse(savedFilters);

          setStudyLanguages(studyLanguages || []);
          setMotherLanguages(motherLanguages || []);
          setGender(gender);
          setIsMatchMyGender(isMatchMyGender || false);
          setCountry(country);
          setAgeRange(ageRange || [13, 100]);
        }
      } catch (error) {
        console.error("Failed to load filters", error);
      }
    };

    loadFilters();
  }, []);

  useEffect(() => {
    const isInitialState =
      studyLanguages.length === 0 &&
      motherLanguages.length === 0 &&
      gender === null &&
      (isMatchMyGender === null || isMatchMyGender === false) &&
      country === null &&
      ageRange[0] === 13 &&
      ageRange[1] === 100;

    const saveFilters = async () => {
      try {
        if (isInitialState) {
          await AsyncStorage.removeItem("filters");
          return;
        }
        const filters = {
          studyLanguages,
          motherLanguages,
          gender,
          isMatchMyGender,
          country,
          ageRange,
        };
        await AsyncStorage.setItem("filters", JSON.stringify(filters));
      } catch (error) {
        console.error("Failed to save filters", error);
      }
    };

    saveFilters();
  }, [
    studyLanguages,
    motherLanguages,
    gender,
    isMatchMyGender,
    country,
    ageRange,
  ]);

  const renderItem = useCallback(
    ({ item }) => (
      <ThemedView style={styles.itemContainer}>{item.component}</ThemedView>
    ),
    []
  );

  const headerRight = () => {
    return (
      <Pressable onPress={resetFilters}>
        <Ionicons
          name="refresh-outline"
          size={24}
          color={Colors[theme].black}
        />
      </Pressable>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: headerRight,
        }}
      />
      <ThemedView style={styles.container}>
        <SafeAreaView>
          <FlatList
            data={components}
            renderItem={renderItem}
            keyExtractor={(item) => item.key}
          />
        </SafeAreaView>
      </ThemedView>
    </>
  );
};

export default Filters;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  itemContainer: {
    marginBottom: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  error: {
    fontSize: 14,
    color: "red",
  },
});
