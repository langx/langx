import React, { useState } from "react";
import {
  Image,
  StyleSheet,
  useColorScheme,
  ScrollView,
  Alert,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { useDispatch } from "react-redux";

import { getCurrentUser, login } from "@/services/appwrite";

import { Colors } from "@/constants/Colors";
import images from "@/constants/images";

import { ThemedView } from "@/components/atomic/ThemedView";
import { ThemedText } from "@/components/atomic/ThemedText";
import { ThemedButton } from "@/components/atomic/ThemedButton";
import ThemedFormField from "@/components/molecular/ThemedFormField";

import { setUser, setLoading } from "@/store/authSlice";

const Login = () => {
  const colorScheme = useColorScheme();
  const router = useRouter();
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
      const session = await login(form.email, form.password);
      const result = await getCurrentUser();
      console.log(session, result);

      dispatch(setUser(result));
      dispatch(setLoading(false));

      Alert.alert("Success", "User signed in successfully");
      router.replace("/home");
    } catch (error) {
      Alert.alert("Error", error.message);
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
        />

        <ThemedButton
          title="Log In"
          onPress={submit}
          isLoading={isSubmitting}
        />

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
          <Link href="/register">
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
    width: "50%",
    left: 0,
    height: 100,
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
    color: Colors.light.grey3,
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
