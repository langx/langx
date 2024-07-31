import React, { useState } from "react";
import { Image, StyleSheet, ScrollView, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { Formik } from "formik";
import * as Yup from "yup";

import { Colors } from "@/constants/Colors";
import images from "@/constants/images";
import { useColorScheme } from "@/hooks/useColorScheme";
import { showToast } from "@/constants/toast";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedButton } from "@/components/themed/atomic/ThemedButton";

const CompleteSchema = Yup.object().shape({
  birthdate: Yup.string().min(1, "Invalid birthdate").required("Required"),
  gender: Yup.string().min(1, "Invalid gender").required("Required"),
  country: Yup.string().min(8, "Invalid country").required("Required"),
});

const CompleteForm = () => {
  // States
  const [isSubmitting, setSubmitting] = useState(false);

  const handleComplete = async (form: any) => {
    setSubmitting(true);
    try {
      console.log("Completing with:", form);
      // const session = await login(form.email, form.password);
      // const newAccount = await register(form.email, form.password, form.name);
      // console.log("New account:", newAccount);
      // const session = await login(form.email, form.password);
      // console.log("Session:", session);
      // signInUser(session);

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
      initialValues={{ birthdate: "", gender: "", country: "" }}
      validationSchema={CompleteSchema}
      onSubmit={(values) => handleComplete(values)}
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
          <ThemedText style={styles.text}>Birthdate</ThemedText>
          <TextInput
            key="birthdate"
            style={styles.text}
            onChangeText={handleChange("birthdate")}
            onBlur={handleBlur("Birthdate")}
            value={values.birthdate}
            placeholder="Birthdate"
          />
          {errors.birthdate && touched.birthdate ? (
            <ThemedText style={{ color: Colors.light.error }}>
              {errors.birthdate}
            </ThemedText>
          ) : null}
          <ThemedText style={styles.text}>Gender</ThemedText>
          <TextInput
            key="gender"
            style={styles.text}
            onChangeText={handleChange("gender")}
            onBlur={handleBlur("gender")}
            value={values.gender}
            placeholder="Gender"
          />
          {errors.gender && touched.gender ? (
            <ThemedText style={{ color: Colors.light.error }}>
              {errors.gender}
            </ThemedText>
          ) : null}
          <ThemedText style={styles.text}>Country</ThemedText>
          <TextInput
            key="country"
            style={styles.text}
            onChangeText={handleChange("country")}
            onBlur={handleBlur("country")}
            value={values.country}
            placeholder="Country"
            secureTextEntry
          />
          {errors.country && touched.country ? (
            <ThemedText style={{ color: Colors.light.error }}>
              {errors.country}
            </ThemedText>
          ) : null}
          <ThemedButton
            onPress={handleSubmit}
            style={styles.button}
            isLoading={isSubmitting}
            title="Next"
          />
        </ThemedView>
      )}
    </Formik>
  );
};

const Register = () => {
  // Hooks
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView
      style={[
        styles.container,
        { paddingBottom: insets.bottom, paddingTop: insets.top },
      ]}
    >
      <ScrollView>
        <Image
          source={colorScheme === "dark" ? images.logo_light : images.logo_dark}
          style={styles.logo}
          resizeMode="contain"
        />

        <ThemedText style={styles.headline}>Personal Information</ThemedText>

        <CompleteForm />
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
