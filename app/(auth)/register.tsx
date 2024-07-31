import React, { useState } from "react";
import { Image, StyleSheet, ScrollView, TextInput } from "react-native";
import { Link } from "expo-router";
import { Formik } from "formik";
import * as Yup from "yup";

import { Colors } from "@/constants/Colors";
import images from "@/constants/images";
import useSignInUser from "@/hooks/useSingInUser";
import { login } from "@/services/authService";
import { showToast } from "@/constants/toast";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedButton } from "@/components/themed/atomic/ThemedButton";
import { useColorScheme } from "@/hooks/useColorScheme";
import OAuth2Login from "@/components/auth/OAuth2Login";

const RegisterSchema = Yup.object().shape({
  name: Yup.string().min(3, "Name is too short").required("Required"),
  email: Yup.string().email("Invalid email").required("Required"),
  password: Yup.string().min(8, "Password too short!").required("Required"),
});

const RegisterForm = () => {
  // States
  const [isSubmitting, setSubmitting] = useState(false);

  const handleRegister = async (form: any) => {
    setSubmitting(true);
    try {
      console.log("Registering with:", form.email);
      // const session = await login(form.email, form.password);
      // signInUser(session);
    } catch (error) {
      console.error("Error logging in:", error);
      showToast("error", error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Formik
      initialValues={{ name: "", email: "", password: "" }}
      validationSchema={RegisterSchema}
      onSubmit={(values) => handleRegister(values)}
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
          <ThemedText style={styles.text}>Name</ThemedText>
          <TextInput
            key="name"
            style={styles.text}
            onChangeText={handleChange("name")}
            onBlur={handleBlur("name")}
            value={values.name}
            placeholder="Name"
          />
          {errors.name && touched.name ? (
            <ThemedText style={{ color: Colors.light.error }}>
              {errors.name}
            </ThemedText>
          ) : null}
          <ThemedText style={styles.text}>Email</ThemedText>
          <TextInput
            key="email"
            style={styles.text}
            onChangeText={handleChange("email")}
            onBlur={handleBlur("email")}
            value={values.email}
            placeholder="Email"
          />
          {errors.email && touched.email ? (
            <ThemedText style={{ color: Colors.light.error }}>
              {errors.email}
            </ThemedText>
          ) : null}
          <ThemedText style={styles.text}>Password</ThemedText>
          <TextInput
            key="password"
            style={styles.text}
            onChangeText={handleChange("password")}
            onBlur={handleBlur("password")}
            value={values.password}
            placeholder="Password"
            secureTextEntry
          />
          {errors.password && touched.password ? (
            <ThemedText style={{ color: Colors.light.error }}>
              {errors.password}
            </ThemedText>
          ) : null}
          <ThemedButton
            onPress={handleSubmit}
            style={styles.button}
            isLoading={isSubmitting}
            title="Register"
          />
        </ThemedView>
      )}
    </Formik>
  );
};

const Register = () => {
  const colorScheme = useColorScheme();

  return (
    <ThemedView style={styles.container}>
      <ScrollView>
        <Image
          source={colorScheme === "dark" ? images.logo_light : images.logo_dark}
          style={styles.logo}
          resizeMode="contain"
        />

        <ThemedText style={styles.headline}>Register</ThemedText>

        <RegisterForm />

        <OAuth2Login />

        <ThemedView
          style={{
            justifyContent: "center",
            flexDirection: "row",
            gap: 2,
            padding: 10,
          }}
        >
          <ThemedText>Do you have an account?</ThemedText>
          <Link href="/login">
            <ThemedText type="link">Login</ThemedText>
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
          <Link href="/(auth)/reset-password">
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
    justifyContent: "center",
    alignItems: "center",
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
    marginTop: 20,
  },
  buttonText: {
    color: Colors.light.primary,
    fontSize: 22,
    fontWeight: "500",
  },
});

export default Register;
