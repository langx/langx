import React, { useState } from "react";
import { Image, StyleSheet, ScrollView, Alert } from "react-native";
import { Link } from "expo-router";
import { useDispatch } from "react-redux";

import {
  getAccount,
  getCurrentSession,
  getCurrentUser,
  login,
} from "@/services/authService";
import { setAccount, setError, setSession, setUser } from "@/store/authSlice";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedButton } from "@/components/themed/atomic/ThemedButton";
import ThemedFormField from "@/components/themed/molecular/ThemedFormField";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/constants/Colors";
import images from "@/constants/images";

const Login = () => {
  const colorScheme = useColorScheme();
  const dispatch = useDispatch();

  const [isSubmitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const submit = async () => {
    if (form.email === "" || form.password === "") {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setSubmitting(true);

    try {
      await login(form.email, form.password);
      const [account, user, session] = await Promise.all([
        getAccount(),
        getCurrentUser(),
        getCurrentSession(),
      ]);
      dispatch(setAccount(account));
      dispatch(setUser(user));
      dispatch(setSession(session));

      Alert.alert("Success", "User signed in successfully");
    } catch (error) {
      Alert.alert("Error", error.message);
      dispatch(setError(error.message || "An error occurred"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView>
        <Image
          source={colorScheme === "dark" ? images.logo_light : images.logo_dark}
          style={styles.logo}
          resizeMode="contain"
        />

        <ThemedText style={styles.headline}>Log In</ThemedText>
        <ThemedFormField
          title="Email"
          value={form.email}
          placeholder="Enter your email"
          handleChangeText={(e) => setForm({ ...form, email: e })}
          keyboardType="email-address"
          style={{ marginBottom: 20 }}
        />

        <ThemedFormField
          title="Password"
          value={form.password}
          placeholder="Enter your password"
          handleChangeText={(e) => setForm({ ...form, password: e })}
          secureTextEntry
        />

        <ThemedView style={{ gap: 10 }}>
          <ThemedButton
            title="Log In"
            onPress={submit}
            isLoading={isSubmitting}
          />
        </ThemedView>

        <ThemedView
          style={{
            justifyContent: "center",
            flexDirection: "row",
            gap: 2,
            padding: 10,
          }}
        >
          <ThemedText>Don't have an account?</ThemedText>
          <Link href="/register">
            <ThemedText type="link">Register</ThemedText>
          </Link>
        </ThemedView>
        <ThemedView
          style={{
            justifyContent: "center",
            flexDirection: "row",
            gap: 2,
            padding: 10,
          }}
        >
          <ThemedText>Forget your password?</ThemedText>
          <Link href="/reset-password">
            <ThemedText type="link">Reset it</ThemedText>
          </Link>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  logo: {
    width: 200,
    height: 100,
    left: 0,
  },
  headline: {
    fontSize: 26,
    fontFamily: "Comfortaa-Bold",
    paddingVertical: 20,
  },
  welcomeImage: {
    width: "100%",
    marginVertical: 20,
  },
  description: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 80,
    color: Colors.light.gray3,
  },
  button: {
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: Colors.light.primary,
    fontSize: 22,
    fontWeight: "500",
  },
});

export default Login;
