import React, { useState } from "react";
import { Image, StyleSheet, ScrollView, Alert, TextInput } from "react-native";
import { Link } from "expo-router";
import { useDispatch } from "react-redux";
import { Formik } from "formik";
import * as Yup from "yup";

import {
  createJWT,
  getAccount,
  getCurrentSession,
  getCurrentUser,
  login,
} from "@/services/authService";
import {
  setAccount,
  setError,
  setJwt,
  setSession,
  setUser,
} from "@/store/authSlice";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedButton } from "@/components/themed/atomic/ThemedButton";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/constants/Colors";
import images from "@/constants/images";

const LoginSchema = Yup.object().shape({
  email: Yup.string().email("Invalid email").required("Required"),
  password: Yup.string().min(6, "Password too short!").required("Required"),
});

const LoginForm = () => {
  const dispatch = useDispatch();
  const [isSubmitting, setSubmitting] = useState(false);

  const handleLogin = async (form: any) => {
    setSubmitting(true);
    try {
      await login(form.email, form.password);
      const [account, user, session] = await Promise.all([
        getAccount(),
        getCurrentUser(),
        getCurrentSession(),
      ]);
      const jwt = await createJWT();
      dispatch(setAccount(account));
      dispatch(setUser(user));
      dispatch(setSession(session));
      dispatch(setJwt(jwt));

      Alert.alert("Success", "User signed in successfully");
    } catch (error) {
      Alert.alert("Error", error.message);
      dispatch(setError(error.message || "An error occurred"));
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Formik
      initialValues={{ email: "", password: "" }}
      validationSchema={LoginSchema}
      onSubmit={(values) => handleLogin(values)}
    >
      {({
        handleChange,
        handleBlur,
        handleSubmit,
        values,
        errors,
        touched,
      }) => (
        <ThemedView style={{ flex: 1 }}>
          <ThemedText style={styles.text}>Email</ThemedText>
          <TextInput
            style={styles.text}
            onChangeText={handleChange("email")}
            onBlur={handleBlur("email")}
            value={values.email}
            placeholder="Email"
          />
          {errors.email && touched.email ? (
            <ThemedText>{errors.email}</ThemedText>
          ) : null}
          <ThemedText style={styles.text}>Password</ThemedText>
          <TextInput
            style={styles.text}
            onChangeText={handleChange("password")}
            onBlur={handleBlur("password")}
            value={values.password}
            placeholder="Password"
            secureTextEntry
          />
          {errors.password && touched.password ? (
            <ThemedText>{errors.password}</ThemedText>
          ) : null}
          <ThemedButton
            onPress={handleSubmit}
            isLoading={isSubmitting}
            title="Login"
          />
        </ThemedView>
      )}
    </Formik>
  );
};

const Login = () => {
  const colorScheme = useColorScheme();

  return (
    <ThemedView style={styles.container}>
      <ScrollView>
        <Image
          source={colorScheme === "dark" ? images.logo_light : images.logo_dark}
          style={styles.logo}
          resizeMode="contain"
        />

        <ThemedText style={styles.headline}>Log In</ThemedText>
        <LoginForm />

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
  text: {
    fontSize: 16,
    paddingVertical: 6,
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
