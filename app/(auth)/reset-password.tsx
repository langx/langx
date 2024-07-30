import React, { useState } from "react";
import { ScrollView, Image, StyleSheet, TextInput } from "react-native";
import { Link } from "expo-router";
import { Formik } from "formik";
import * as Yup from "yup";

import { Colors } from "@/constants/Colors";
import images from "@/constants/images";
import { useColorScheme } from "@/hooks/useColorScheme";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedButton } from "@/components/themed/atomic/ThemedButton";

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
      // const session = await login(form.email, form.password);
      // signInUser(session);
    } catch (error) {
      console.error("Error logging in:", error);
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
            isLoading={isSubmitting}
            title="Login"
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
      </ScrollView>
    </ThemedView>
  );
};

export default ResetPassword;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // justifyContent: "center",
    // alignItems: "center",
    minWidth: "100%",
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
    width: "80%",
    alignItems: "center",
  },
  buttonText: {
    color: Colors.light.primary,
    fontSize: 22,
    fontWeight: "500",
  },
});
