import React from "react";
import { ScrollView } from "react-native";

import { useDatabase } from "@/hooks/useDatabase";
import { listUsers } from "@/services/userService";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import RecomendedSection from "@/components/home/RecomendedSection";
import FeaturedSection from "@/components/home/FeaturedSection";

export default function CommunityScreen() {
  const { data: users, loading, refetch } = useDatabase(listUsers);

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <RecomendedSection users={users} loading={loading} />
        <FeaturedSection users={users} loading={loading} />
        <ThemedView>
          <ThemedText type="title">Visitors</ThemedText>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}
