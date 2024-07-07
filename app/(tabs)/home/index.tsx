import { StyleSheet, FlatList, SafeAreaView } from "react-native";

import { ThemedText } from "@/components/atomic/ThemedText";
import { ThemedView } from "@/components/atomic/ThemedView";
import { listUsers } from "@/services/userService";
import useDatabase from "@/hooks/useDatabase";

export default function CommunityScreen() {
  const { data: users, refetch } = useDatabase(listUsers);
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <FlatList
        data={users}
        keyExtractor={(item) => item.$id}
        ListHeaderComponent={() => (
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title">For You</ThemedText>
          </ThemedView>
        )}
        renderItem={({ item }) => (
          <ThemedView style={styles.titleContainer}>
            <ThemedText style={{ fontSize: 26 }}>{item.name}</ThemedText>
            <ThemedText style={{ fontSize: 16 }}>{item.$id}</ThemedText>
          </ThemedView>
        )}
      ></FlatList>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: "absolute",
  },
});
