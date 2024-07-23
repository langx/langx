import React, { useState, useRef, useEffect } from "react";
import { ScrollView, RefreshControl, Pressable } from "react-native";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { router, Stack } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import _ from "lodash";

import { Colors } from "@/constants/Colors";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import RecommendedSection from "@/components/home/RecommendedSection";
import FeaturedSection from "@/components/home/FeaturedSection";
import VisitorsSection from "@/components/home/VisitorsSection";

export default function CommunityScreen() {
  const user = useSelector((state: RootState) => state.auth.user);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filters, setFilters] = useState(null);

  const isFocused = useIsFocused();

  const recommendedSectionRef = useRef(null);
  const featuredSectionRef = useRef(null);
  const visitorsSectionRef = useRef(null);
  const isFirstRun = useRef(true);

  const onRefresh = async () => {
    setIsRefreshing(true);
    recommendedSectionRef.current?.refetch();
    featuredSectionRef.current?.refetch();
    visitorsSectionRef.current?.refetch();
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (isFocused) {
      const loadFilters = async () => {
        try {
          const savedFilters = await AsyncStorage.getItem("filters");

          if (!_.isEqual(filters, savedFilters)) {
            setFilters(savedFilters);
          }
        } catch (error) {
          console.error("Failed to load filters", error);
        }
      };

      loadFilters();
    }
  }, [isFocused]);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    onRefresh();
  }, [filters]);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push("(pages)/filters")}>
              <Ionicons
                name="filter-outline"
                size={24}
                color={Colors.light.black}
              />
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
          <RecommendedSection
            currentUserId={user?.$id}
            filterData={filters}
            ref={recommendedSectionRef}
          />
          {/* <FeaturedSection currentUserId={user?.$id} ref={featuredSectionRef} /> */}
          {/* <VisitorsSection ref={visitorsSectionRef} /> */}
        </ScrollView>
      </ThemedView>
    </>
  );
}
