import { FlatList } from "react-native";
import UserCard from "./UserCard";

import { ThemedView } from "@/components/atomic/ThemedView";
import { ThemedText } from "../atomic/ThemedText";
import { ThemedButton } from "../atomic/ThemedButton";

const RecomendedSection = ({ users, loading }) => {
  return (
    <ThemedView
      style={{
        flex: 1,
      }}
    >
      {/* Header Section */}
      <ThemedView
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <ThemedText type="title">For You</ThemedText>
        <ThemedButton
          title="More"
          onPress={() => console.log("Button pressed")}
          style={{
            margin: 10,
            padding: 5,
          }}
        />
      </ThemedView>

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

export default RecomendedSection;
