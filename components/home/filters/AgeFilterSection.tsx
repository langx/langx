import React, { useEffect, useState } from "react";
import { FlatList, StyleSheet } from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";

import { Colors } from "@/constants/Colors";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";

const AgeFilterSection = ({ ageRange, setAgeRange }) => {
  const [minAge, setMinAge] = useState(ageRange[0]);
  const [maxAge, setMaxAge] = useState(ageRange[1]);
  const ageItems = ["Min Age", "Max Age"];

  const [debounceTimeout, setDebounceTimeout] = useState(null);

  useEffect(() => {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
    const timeoutId = setTimeout(() => {
      setMinAge(ageRange[0]);
      setMaxAge(ageRange[1]);
      console.log("ageRange", ageRange);
    }, 300);
    setDebounceTimeout(timeoutId);
    return () => clearTimeout(timeoutId);
  }, [ageRange]);

  useEffect(() => {
    setAgeRange([minAge, maxAge]);
  }, [minAge, maxAge]);

  const renderAgeItem = ({ item }) => (
    <ThemedView>
      <ThemedView style={styles.item}>
        <Ionicons
          name={
            item === "Min Age" ? "trending-down-outline" : "trending-up-outline"
          }
          style={styles.icon}
        />
        <ThemedView style={styles.labelContainer}>
          <ThemedText style={styles.label}>
            {`${item}: ${item === "Min Age" ? minAge : maxAge}`}
          </ThemedText>
        </ThemedView>
      </ThemedView>
      <ThemedView style={styles.sliderContainer}>
        {item === "Min Age" && (
          <Slider
            value={minAge}
            onValueChange={setMinAge}
            minimumValue={0}
            maximumValue={maxAge - 1}
            step={1}
            minimumTrackTintColor={Colors.light.gray3}
            maximumTrackTintColor={Colors.light.primary}
            // onHapticFeedback={() => {
            //   ReactNativeHapticFeedback.trigger('impactLight', {
            //     enableVibrateFallback: true,
            //     ignoreAndroidSystemSettings: false,
            //   });
            // }}
          />
        )}
        {item === "Max Age" && (
          <Slider
            value={maxAge}
            onValueChange={setMaxAge}
            minimumValue={minAge + 1}
            maximumValue={100}
            step={1}
            minimumTrackTintColor={Colors.light.primary}
            maximumTrackTintColor={Colors.light.gray3}
            // onHapticFeedback={() => {
            //   ReactNativeHapticFeedback.trigger('impactLight', {
            //     enableVibrateFallback: true,
            //     ignoreAndroidSystemSettings: false,
            //   });
            // }}
          />
        )}
      </ThemedView>
    </ThemedView>
  );

  return (
    <ThemedView style={{ flex: 1 }}>
      <ThemedView style={styles.card}>
        <ThemedView style={styles.cardHeader}>
          <ThemedText style={styles.cardTitle}>Age Range</ThemedText>
          <ThemedText style={styles.cardSubtitle}>
            Select an Age Range to Filter
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.cardContent}>
          <FlatList
            data={ageItems}
            renderItem={renderAgeItem}
            keyExtractor={(item) => item}
          />
        </ThemedView>
      </ThemedView>
    </ThemedView>
  );
};

export default AgeFilterSection;

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    overflow: "hidden",
    margin: 10,
  },
  cardHeader: {
    padding: 20,
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 24,
    fontFamily: "Lexend-Bold",
  },
  cardSubtitle: {
    fontSize: 16,
    marginTop: 5,
  },
  cardContent: {
    padding: 20,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  icon: {
    fontSize: 24,
    marginRight: 20,
    color: Colors.light.primary,
  },
  labelContainer: {
    flex: 1,
  },
  label: {
    fontSize: 16,
  },
  sliderContainer: {
    flex: 1,
    width: "90%",
    justifyContent: "center",
    alignSelf: "center",
    alignItems: "stretch",
    paddingVertical: 10,
  },
});
