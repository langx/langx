import React from "react";

import { useDatabase } from "@/hooks/useDatabase";
import { listUsers } from "@/services/userService";
import { ThemedView } from "@/components/atomic/ThemedView";
import ForYouSection from "@/components/home/ForYouSection";

export default function CommunityScreen() {
  const { data: users, loading, refetch } = useDatabase(listUsers);

  return (
    <ThemedView style={{ flex: 1 }}>
      <ForYouSection users={users} />
      <ForYouSection users={users} />
      <ForYouSection users={users} />
      <ForYouSection users={users} />
    </ThemedView>
  );
}
