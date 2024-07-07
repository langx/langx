import {
  StyleSheet,
  FlatList,
  SafeAreaView,
  ImageBackground,
} from "react-native";

import useDatabase from "@/hooks/useDatabase";
import { listUsers } from "@/services/userService";
import { ThemedText } from "@/components/atomic/ThemedText";
import { ThemedView } from "@/components/atomic/ThemedView";
import images from "@/constants/images";

export default function CommunityScreen() {
  const { data: users, refetch } = useDatabase(listUsers);
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <FlatList
        data={users}
        numColumns={2}
        keyExtractor={(item) => item.$id}
        ListHeaderComponent={() => (
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title">For You</ThemedText>
          </ThemedView>
        )}
        renderItem={({ item }) => (
          <ImageBackground
            source={images.profile}
            style={styles.card}
            resizeMode="cover"
            imageStyle={styles.imageBackground}
          >
            <ThemedView style={styles.textContainer}>
              <ThemedText style={styles.name}>{item.name}</ThemedText>
              <ThemedText style={styles.detail}>{item.country}</ThemedText>
              <ThemedText style={styles.detail}>{item.username}</ThemedText>
            </ThemedView>
          </ImageBackground>
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
  card: {
    flex: 1,
    margin: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    overflow: "hidden",
    minHeight: 200,
    justifyContent: "flex-end",
  },
  imageBackground: {
    width: "100%",
    height: "100%",
  },
  textContainer: {
    width: "100%",
    backgroundColor: "rgba(250, 250, 250, 0.7)",
    padding: 8,
    alignItems: "center",
  },
  name: {
    fontSize: 18,
    fontWeight: "bold",
  },
  detail: {
    fontSize: 14,
  },
});
