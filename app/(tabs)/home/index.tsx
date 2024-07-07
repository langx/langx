import {
  StyleSheet,
  FlatList,
  SafeAreaView,
  ImageBackground,
} from "react-native";

import useDatabase from "@/hooks/useDatabase";
import { useColorScheme } from "@/hooks/useColorScheme";
import { listUsers } from "@/services/userService";
import { ThemedText } from "@/components/atomic/ThemedText";
import { ThemedView } from "@/components/atomic/ThemedView";
import images from "@/constants/images";
import { Colors } from "@/constants/Colors";

export default function CommunityScreen() {
  const theme = useColorScheme() === "dark" ? "dark" : "light";
  const { data: users, refetch } = useDatabase(listUsers);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <FlatList
        data={users}
        numColumns={2}
        keyExtractor={(item) => item.$id}
        renderItem={({ item }) => (
          <ImageBackground
            source={images.logoSmall}
            style={styles.card}
            resizeMode="cover"
            imageStyle={styles.imageBackground}
          >
            <ThemedView
              style={{
                width: "100%",
                backgroundColor: Colors[theme].background,
                opacity: 0.7,
                padding: 8,
                alignItems: "center",
              }}
            >
              <ThemedText
                style={{ fontSize: 18, fontWeight: "bold", opacity: 1 }}
              >
                {item.name}
              </ThemedText>
              <ThemedText style={{ fontSize: 14 }}>{item.country}</ThemedText>
              <ThemedText style={{ fontSize: 14 }}>{item.username}</ThemedText>
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
});
