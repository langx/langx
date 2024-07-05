import Ionicons from "@expo/vector-icons/Ionicons";
import {
  StyleSheet,
  Alert,
  Pressable,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useDispatch } from "react-redux";

import { setLoading, setUser } from "@/store/authSlice";
import { logout } from "@/services/appwrite";
import { Colors } from "@/constants/Colors";
import { ThemedText } from "@/components/atomic/ThemedText";
import { ThemedView } from "@/components/atomic/ThemedView";

export default function ProfileScreen() {
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("dark-content");

      // This function is returned to revert the effect when the component is not focused
      return () => StatusBar.setBarStyle("default");
    }, [])
  );

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
      <StatusBar />
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
