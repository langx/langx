import { FlatList, SafeAreaView } from "react-native";

import { useDatabase } from "@/hooks/useDatabase";
import { useColorScheme } from "@/hooks/useColorScheme";
import { listUsers } from "@/services/userService";
import UserCard from "@/components/home/UserCard";

export default function CommunityScreen() {
  const theme = useColorScheme() === "dark" ? "dark" : "light";
  const { data: users, loading, refetch } = useDatabase(listUsers);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <FlatList
        data={users}
        numColumns={2}
        keyExtractor={(item) => item.$id}
        renderItem={({ item }) => (
          <UserCard item={item} loadingItem={loading} theme={theme} />
        )}
      ></FlatList>
    </SafeAreaView>
  );
}
