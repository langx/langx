import Ionicons from "@expo/vector-icons/Ionicons";
import {
  StyleSheet,
  Alert,
  Pressable,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { useDispatch } from "react-redux";

import { setLoading, setUser } from "@/store/authSlice";
import { logout } from "@/services/appwrite";
import { Colors } from "@/constants/Colors";
import { ThemedText } from "@/components/atomic/ThemedText";
import { ThemedView } from "@/components/atomic/ThemedView";

export default function ProfileScreen() {
  const router = useRouter();

  const dispatch = useDispatch();
  const [isSubmitting, setSubmitting] = useState(false);
  const username = "useSelector";

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
    <>
      <StatusBar barStyle="dark-content" />
      <ThemedView style={styles.container}>
        <ThemedText>aa</ThemedText>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  username: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.light.black,
  },
});
