import React, { useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useDispatch } from "react-redux";

import { logout } from "@/services/appwrite";
import { setLoading, setUser } from "@/store/authSlice";
import { ThemedView } from "@/components/atomic/ThemedView";
import { ThemedText } from "@/components/atomic/ThemedText";

const Settings = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const [isSubmitting, setSubmitting] = useState(false);

  const onPressLogout = async () => {
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
    <ThemedView>
      <ThemedText>Settings</ThemedText>
    </ThemedView>
  );
};

export default Settings;
