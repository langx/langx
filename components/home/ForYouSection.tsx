import { FlatList } from "react-native";
import UserCard from "./UserCard";

import { ThemedView } from "@/components/atomic/ThemedView";
import { ThemedText } from "../atomic/ThemedText";

const ForYouSection = ({ users }) => {
  const loading = false;
  return (
    <ThemedView
      style={{
        flexDirection: "row",
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Header Section */}
      <ThemedText
        style={{
          // fontSize: 24,
          flexShrink: 1,
          transform: [{ rotate: "-90deg" }],
        }}
      >
        For You
      </ThemedText>

      {/* List Section */}
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        horizontal
        data={users}
        keyExtractor={(item) => item.$id}
        renderItem={({ item }) => (
          <UserCard item={item} loadingItem={loading} />
        )}
        style={{ flex: 1 }}
      />
    </ThemedView>
  );
};

export default ForYouSection;
