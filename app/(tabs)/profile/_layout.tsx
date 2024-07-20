import { Stack } from "expo-router";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";

import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/constants/Colors";
import { useEffect, useState } from "react";
import { Pressable } from "react-native";

export default function ProfileLayout() {
  const colorScheme = useColorScheme();

  const [username, setUsername] = useState<string | null>(null);

  const account = useSelector((state: RootState) => state.auth.account);
  const user = useSelector((state: RootState) => state.auth.user);

  useEffect(() => {
    if (account && user) {
      setUsername(user.username);
    } else if (account) {
      const username = `langx_${account.$id.slice(-4)}`;
      setUsername(username);
    } else {
      setUsername(null);
    }
  }, [account, user]);

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: true,
          headerBackVisible: false,
          headerStyle: { backgroundColor: Colors.light.primary },
          headerTitle: `@${username}`,
          headerTitleStyle: {
            fontFamily: "Lexend-Bold",
            color: Colors.light.black,
          },
          headerRight: () => (
            <Pressable onPress={() => router.push("(pages)/settings")}>
              <Ionicons
                name="cog-outline"
                size={24}
                color={Colors.light.black}
              />
            </Pressable>
          ),
        }}
      />
    </Stack>
  );
}
