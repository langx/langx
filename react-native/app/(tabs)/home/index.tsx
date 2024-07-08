import { FlatList } from "react-native";

import { useDatabase } from "@/hooks/useDatabase";
import { useColorScheme } from "@/hooks/useColorScheme";
import { listUsers } from "@/services/userService";
import { ThemedView } from "@/components/atomic/ThemedView";
import UserCard from "@/components/home/UserCard";

export default function CommunityScreen() {
  const theme = useColorScheme() === "dark" ? "dark" : "light";
  const { data: users, loading, refetch } = useDatabase(listUsers);

  return (
    <ThemedView
      style={{
        flex: 1,
      }}
    >
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={users}
        numColumns={2}
        keyExtractor={(item) => item.$id}
        renderItem={({ item }) => (
          <UserCard item={item} loadingItem={loading} theme={theme} />
        )}
      ></FlatList>
    </ThemedView>
  );
}
