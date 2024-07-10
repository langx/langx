import React from "react";

import { useDatabase } from "@/hooks/useDatabase";
import { listUsers } from "@/services/userService";
import { ThemedView } from "@/components/atomic/ThemedView";
import RecomendedSection from "@/components/home/RecomendedSection";
import { ScrollView } from "react-native";
import { ThemedText } from "@/components/atomic/ThemedText";

export default function CommunityScreen() {
  const { data: users, loading, refetch } = useDatabase(listUsers);

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <RecomendedSection users={users} loading={loading} />
        <RecomendedSection users={users} loading={loading} />
        <RecomendedSection users={users} loading={loading} />
        <RecomendedSection users={users} loading={loading} />
        <ThemedView>
          <ThemedText type="title">Visitors</ThemedText>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}
