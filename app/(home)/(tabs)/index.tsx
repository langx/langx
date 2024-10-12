import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ScrollView,
  RefreshControl,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { Href, router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import _ from "lodash";

import { Colors } from "@/constants/Colors";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import RecommendedSection from "@/components/home/RecommendedSection";
import { useFilters } from "@/hooks/useFilters";

export default function CommunityScreen() {
  const user = useSelector((state: RootState) => state.auth.user);
  const isFocused = useIsFocused();

  // Hooks
  const { filters, loading, loadFilters } = useFilters("filters");

  // States
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchText, setSearchText] = useState(null);

  // Refs
  const recommendedSectionRef = useRef(null);
  const featuredSectionRef = useRef(null);
  const visitorsSectionRef = useRef(null);

  const onRefresh = async () => {
    setIsRefreshing(true);
    recommendedSectionRef.current?.refetch();
    featuredSectionRef.current?.refetch();
    visitorsSectionRef.current?.refetch();
    setIsRefreshing(false);
  };

  // isFocused is used to load filters only when the screen is focused
  useEffect(() => {
    if (isFocused) {
      loadFilters();
    }
  }, [isFocused]);

  // Search Functions
  const debouncedSearch = useCallback(
    _.debounce((text) => {
      if (text !== "" && text !== null && text !== undefined) {
        setSearchText(text);
      } else {
        setSearchText(null);
      }
      onRefresh();
    }, 500),
    []
  );

  const onChangeSearch = (text) => {
    debouncedSearch(text.nativeEvent.text);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: Colors.light.primary },
          headerTitle: "Community",
          headerTitleStyle: {
            fontFamily: "Lexend-Bold",
            color: Colors.light.black,
          },
          headerSearchBarOptions: {
            onChangeText: onChangeSearch,
            onCancelButtonPress: onChangeSearch,
            placeholder: "",
            hideWhenScrolling: true,
            hideNavigationBar: true,
            shouldShowHintSearchIcon: true,
            textColor: Colors.light.black,
            tintColor: Colors.light.black,
            hintTextColor: Colors.light.black,
            headerIconColor: Colors.light.black,
          },
          headerRight: () => (
            <Pressable onPress={() => router.push("(home)/filters" as Href)}>
              <Ionicons
                name="filter-outline"
                size={24}
                color={Colors.light.black}
                style={{ marginRight: 15 }}
              />
              {filters && <ThemedView style={styles.badge}></ThemedView>}
            </Pressable>
          ),
        }}
      />
      <ThemedView style={{ flex: 1 }}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[Colors.light.primary]}
            />
          }
        >
          {loading ? (
            <ThemedView style={styles.centered}>
              <ActivityIndicator size="large" color={Colors.light.primary} />
            </ThemedView>
          ) : (
            <RecommendedSection
              currentUserId={user?.$id}
              filterData={filters}
              searchText={searchText}
              ref={recommendedSectionRef}
            />
          )}
          {/* <FeaturedSection currentUserId={user?.$id} ref={featuredSectionRef} /> */}
          {/* <VisitorsSection ref={visitorsSectionRef} /> */}
        </ScrollView>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    right: 10,
    top: -3,
    backgroundColor: Colors.light.error,
    borderRadius: 9,
    width: 12,
    height: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
});
