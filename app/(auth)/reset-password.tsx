import React, { useState } from "react";
import { ScrollView, Image, StyleSheet, TextInput } from "react-native";
import { Formik } from "formik";
import * as Yup from "yup";

import images from "@/constants/images";
import { Colors } from "@/constants/Colors";
import { showToast } from "@/constants/toast";
import { useColorScheme } from "@/hooks/useColorScheme";
import { resetPassword } from "@/services/authService";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedButton } from "@/components/themed/atomic/ThemedButton";
import OAuth2Login from "@/components/auth/OAuth2Login";
import { Link } from "expo-router";

const ResetSchema = Yup.object().shape({
  email: Yup.string().email("Invalid email").required("Required"),
});

const ResetForm = () => {
  // States
  const [isSubmitting, setSubmitting] = useState(false);

  const handleReset = async (form: any) => {
    setSubmitting(true);
    try {
      console.log("Resetting password for:", form.email);
      const response = await resetPassword(form.email);
      console.log("Response:", response);
      showToast("success", "Password reset email sent");
      form.email = "";
    } catch (error) {
      showToast("error", error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Formik
      initialValues={{ email: "" }}
      validationSchema={ResetSchema}
      onSubmit={(values) => handleReset(values)}
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
          <ThemedButton
            onPress={handleSubmit}
            style={styles.button}
            isLoading={isSubmitting}
            title="Send Email"
          />
        </ThemedView>
      )}
    </Formik>
  );
};

const ResetPassword = () => {
  const colorScheme = useColorScheme();
  return (
    <ThemedView style={styles.container}>
      <ScrollView>
        <Image
          source={colorScheme === "dark" ? images.logo_light : images.logo_dark}
          style={styles.logo}
          resizeMode="contain"
        />

        <ThemedText style={styles.headline}>Reset Password</ThemedText>

        <ResetForm />
        <OAuth2Login />

        <ThemedView
          style={{
            justifyContent: "center",
            flexDirection: "row",
            gap: 2,
            padding: 10,
          }}
        >
          <ThemedText>Don't you have an account?</ThemedText>
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
          <Link href="/(auth)/reset-password">
            <ThemedText type="link">Reset it</ThemedText>
          </Link>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
};

export default ResetPassword;

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
