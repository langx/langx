import React, { useState } from "react";
import { ScrollView, RefreshControl } from "react-native";

import { Colors } from "@/constants/Colors";
import { useDatabase } from "@/hooks/useDatabase";
import { listUsers } from "@/services/userService";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import RecomendedSection from "@/components/home/RecomendedSection";
import FeaturedSection from "@/components/home/FeaturedSection";
import VisitorsSection from "@/components/home/VisitorsSection";

export default function CommunityScreen() {
  const { data: users, loading, refetch } = useDatabase(listUsers);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
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
        <RecomendedSection users={users} loading={loading} />
        <FeaturedSection users={users} loading={loading} />
        <VisitorsSection></VisitorsSection>
      </ScrollView>
    </ThemedView>
  );
}
