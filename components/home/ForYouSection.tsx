import { FlatList } from "react-native";
import UserCard from "./UserCard";

import { ThemedView } from "@/components/atomic/ThemedView";
import { ThemedText } from "../atomic/ThemedText";

const ForYouSection = ({ users }) => {
  const loading = false;
  return (
    <ThemedView
      style={{
        flex: 1,
      }}
    >
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        horizontal
        data={users}
        keyExtractor={(item) => item.$id}
        renderItem={({ item }) => (
          <UserCard item={item} loadingItem={loading} />
        )}
        ListHeaderComponent={
          <ThemedView style={{ flex: 1, justifyContent: "center" }}>
            <ThemedText style={{ textAlign: "center" }}>For You</ThemedText>
          </ThemedView>
        }
      ></FlatList>
    </ThemedView>
  );
};

export default ForYouSection;
