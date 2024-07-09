import { FlatList } from "react-native";
import UserCard from "./UserCard";

import { ThemedView } from "@/components/atomic/ThemedView";

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
      ></FlatList>
    </ThemedView>
  );
};

export default ForYouSection;
