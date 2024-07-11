import React, { useState, useRef } from "react";
import { ScrollView, RefreshControl } from "react-native";

import { Colors } from "@/constants/Colors";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import RecomendedSection from "@/components/home/RecomendedSection";
import FeaturedSection from "@/components/home/FeaturedSection";
import VisitorsSection from "@/components/home/VisitorsSection";

export default function CommunityScreen() {
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  return (
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
        <RecomendedSection ref={recommendedSectionRef} />
        {/* <FeaturedSection ref={featuredSectionRef} /> */}
        {/* <VisitorsSectsion ref={visitorsSectionRef} /> */}
      </ScrollView>
    </ThemedView>
  );
}
