import { Stack } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Alert } from "react-native";
import { useDispatch } from "react-redux";
import { useRouter, Link } from "expo-router";

import { logout } from "@/services/appwrite";
import { setLoading, setUser } from "@/store/authSlice";
import { Colors } from "@/constants/Colors";
import { ThemedText } from "@/components/atomic/ThemedText";
import { useState } from "react";

export default function RootLayout() {
  const dispatch = useDispatch();
  const router = useRouter();
  const [isSubmitting, setSubmitting] = useState(false);
  const username = "useSelector"; // Replace with actual selector to get username

  const signout = async () => {
    setSubmitting(true);
    try {
      await logout();
      dispatch(setUser(null));
      dispatch(setLoading(false));
      Alert.alert("Success", "User signed out successfully");
      console.log("logged out");
      router.replace("/welcome");
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: Colors.light.primary },
          headerTitle: () => (
            <ThemedText
              style={{
                fontSize: 18,
                fontWeight: "bold",
                color: Colors.light.black,
              }}
            >
              @{username}
            </ThemedText>
          ),
          headerRight: () => (
            <Link href="profile/settings">
              <Ionicons
                name="menu-outline"
                size={24}
                color={Colors.light.black}
                style={{ marginRight: 16 }}
              />
            </Link>
          ),
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: Colors.light.primary },
          headerTitle: () => (
            <ThemedText
              style={{
                fontSize: 18,
                fontWeight: "bold",
                color: Colors.light.black,
              }}
            >
              Settings
            </ThemedText>
          ),
          headerBackTitleVisible: false,
          headerTintColor: Colors.light.black,
        }}
      />
    </Stack>
  );
}
