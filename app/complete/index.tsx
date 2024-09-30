import React, { useCallback, useEffect, useState } from "react";
import {
  Image,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
  TouchableWithoutFeedback,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Formik } from "formik";
import * as Yup from "yup";
import DateTimePickerModal from "react-native-modal-datetime-picker";

import { Colors } from "@/constants/Colors";
import images from "@/constants/images";
import { useColorScheme } from "@/hooks/useColorScheme";
import { showToast } from "@/constants/toast";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedButton } from "@/components/themed/atomic/ThemedButton";
import { Ionicons } from "@expo/vector-icons";

const CompleteSchema = Yup.object().shape({
  birthdate: Yup.date()
    .required("Required")
    .typeError("Invalid birthdate")
    .test(
      "is-13-years-old",
      "You must be at least 13 years old",
      function (value) {
        const today = new Date();
        const birthDate = new Date(value);
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDifference = today.getMonth() - birthDate.getMonth();
        const dayDifference = today.getDate() - birthDate.getDate();

        if (
          age > 13 ||
          (age === 13 && monthDifference > 0) ||
          (age === 13 && monthDifference === 0 && dayDifference >= 0)
        ) {
          return true;
        }
        return false;
      }
    ),
  gender: Yup.string().min(1, "Invalid gender").required("Required"),
  country: Yup.string().min(1, "Invalid country").required("Required"),
});

const CompleteForm = () => {
  const theme = useColorScheme() ?? "light";
  const [isSubmitting, setSubmitting] = useState(false);
  const [birthdate, setBirthdate] = useState(new Date());
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [genderModalOpen, setGenderModalOpen] = useState(false);
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [allCountries, setAllCountries] = useState([]); // Store all countries
  const [filteredCountries, setFilteredCountries] = useState([]);

  const genders = ["male", "female", "other"];

  const handleComplete = async (form) => {
    setSubmitting(true);
    try {
      console.log("Completing with:", form);
    } catch (error) {
      console.error("Error logging in:", error);
      showToast("error", error.message);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await fetch("https://db.langx.io/v1/locale/countries");
        const data = await response.json();
        setAllCountries(data.countries); // Store all countries
        setFilteredCountries(data.countries); // Update state with countries array
      } catch (error) {
        console.error("Error fetching countries:", error);
        showToast("error", "Failed to load countries.");
      }
    };

    fetchCountries();
  }, []);

  const renderGenderItem = useCallback(
    ({ item, setFieldValue }) => (
      <Pressable
        onPress={() => {
          setFieldValue("gender", item);
          setGenderModalOpen(false);
        }}
      >
        <ThemedView style={styles.item}>
          <ThemedView
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <ThemedView style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name={
                  item === "male"
                    ? "man-outline"
                    : item === "female"
                    ? "woman-outline"
                    : "male-female-outline"
                }
                style={styles.icon}
              />
              <ThemedText style={styles.text}>
                {item === "male"
                  ? "Male"
                  : item === "female"
                  ? "Female"
                  : "Prefer Not To Say"}
              </ThemedText>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      </Pressable>
    ),
    []
  );

  const renderCountryItem = useCallback(
    ({ item, setFieldValue }) => (
      <Pressable
        onPress={() => {
          setFieldValue("country", item.name);
          setCountryModalOpen(false);
        }}
      >
        <ThemedView style={styles.item}>
          <ThemedText style={styles.text}>{item.name}</ThemedText>
        </ThemedView>
      </Pressable>
    ),
    []
  );

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query === "") {
      // If search query is empty, reset to all countries
      setFilteredCountries(allCountries);
    } else {
      const filtered = allCountries.filter((country) =>
        country.name.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredCountries(filtered);
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
        setFieldValue,
        values,
        errors,
        touched,
      }) => (
        <ThemedView style={{ flex: 1 }}>
          {/* Birthdate Field */}
          <ThemedText style={styles.text}>Birthdate</ThemedText>
          <Pressable onPress={() => setDatePickerVisibility(true)}>
            <ThemedText style={[styles.text, styles.detail]}>
              {values.birthdate
                ? birthdate.toLocaleDateString("en-US", {
                    month: "2-digit",
                    day: "2-digit",
                    year: "numeric",
                  })
                : "Select Birthdate"}
            </ThemedText>
          </Pressable>
          {errors.birthdate && touched.birthdate ? (
            <ThemedText style={{ color: Colors.light.error }}>
              {errors.birthdate}
            </ThemedText>
          ) : null}
          <DateTimePickerModal
            isVisible={isDatePickerVisible}
            mode="date"
            onConfirm={(date) => {
              setBirthdate(date);
              setFieldValue("birthdate", date);
              setDatePickerVisibility(false);
            }}
            onCancel={() => setDatePickerVisibility(false)}
            maximumDate={
              new Date(new Date().setFullYear(new Date().getFullYear() - 13))
            }
          />

          {/* Gender Field */}
          <ThemedText style={styles.text}>Gender</ThemedText>
          <Pressable onPress={() => setGenderModalOpen(true)}>
            <ThemedText style={[styles.text, styles.detail]}>
              {values.gender === "male"
                ? "Male"
                : values.gender === "female"
                ? "Female"
                : values.gender === "other"
                ? "Prefer Not To Say"
                : "Select Gender"}
            </ThemedText>
          </Pressable>
          {errors.gender && touched.gender ? (
            <ThemedText style={{ color: Colors.light.error }}>
              {errors.gender}
            </ThemedText>
          ) : null}
          <Modal
            visible={genderModalOpen}
            transparent={true}
            animationType="fade"
          >
            <TouchableWithoutFeedback onPress={() => setGenderModalOpen(false)}>
              <ThemedView style={styles.modalOverlay}>
                <TouchableWithoutFeedback>
                  <ThemedView style={styles.modalBox}>
                    <FlatList
                      data={genders}
                      keyExtractor={(item) => item.toString()}
                      renderItem={({ item }) =>
                        renderGenderItem({ item, setFieldValue })
                      }
                    />
                  </ThemedView>
                </TouchableWithoutFeedback>
              </ThemedView>
            </TouchableWithoutFeedback>
          </Modal>

          {/* Country Field */}
          <ThemedText style={styles.text}>Country</ThemedText>
          <Pressable onPress={() => setCountryModalOpen(true)}>
            <ThemedText style={[styles.text, styles.detail]}>
              {values.country ? values.country : "Select Country"}
            </ThemedText>
          </Pressable>
          {errors.country && touched.country ? (
            <ThemedText style={{ color: Colors.light.error }}>
              {errors.country}
            </ThemedText>
          ) : null}
          <Modal
            visible={countryModalOpen}
            transparent={true}
            animationType="fade"
          >
            <TouchableWithoutFeedback
              onPress={() => setCountryModalOpen(false)}
            >
              <ThemedView style={styles.modalOverlay}>
                <KeyboardAvoidingView
                  behavior={Platform.OS === "ios" ? "padding" : "height"}
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  <TouchableWithoutFeedback>
                    <ThemedView style={styles.modalBox}>
                      <TextInput
                        style={[styles.searchInput, { width: "100%" }]}
                        placeholder="Search..."
                        onChangeText={handleSearch}
                        value={searchQuery}
                      />
                      {filteredCountries.length > 0 ? (
                        <FlatList
                          data={filteredCountries}
                          keyExtractor={(item) => item.code}
                          renderItem={({ item }) =>
                            renderCountryItem({ item, setFieldValue })
                          }
                        />
                      ) : (
                        <ThemedText style={styles.text}>
                          No countries found.
                        </ThemedText>
                      )}
                    </ThemedView>
                  </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
              </ThemedView>
            </TouchableWithoutFeedback>
          </Modal>

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
    textAlign: "left",
  },
  detail: {
    color: Colors.light.gray2,
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
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalBox: {
    width: 300,
    maxHeight: "80%",
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  datePickerHeader: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  card: {
    borderRadius: 10,
    overflow: "hidden",
    margin: 10,
  },
  cardHeader: {
    padding: 20,
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 24,
    fontFamily: "Lexend-Bold",
  },
  cardSubtitle: {
    fontSize: 16,
    marginTop: 5,
  },
  cardContent: {
    padding: 20,
  },
  item: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  icon: {
    fontSize: 24,
    marginRight: 20,
    color: Colors.light.primary,
  },
  label: {
    fontSize: 16,
  },
  note: {
    fontFamily: "NotoSans-Regular",
    fontSize: 14,
    color: Colors.light.gray3,
  },
  searchInput: {
    height: 40,
    borderColor: Colors.light.gray4,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
});

export default Register;
