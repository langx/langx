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
import CountryFlag from "react-native-country-flag";

import { Colors } from "@/constants/Colors";
import images from "@/constants/images";
import { useColorScheme } from "@/hooks/useColorScheme";
import { showToast } from "@/constants/toast";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedButton } from "@/components/themed/atomic/ThemedButton";
import { Ionicons } from "@expo/vector-icons";
import { Href, useRouter } from "expo-router";
import { useDispatch } from "react-redux";
import {
  setMotherLanguageCode,
  setMotherLanguageName,
  setMotherLanguageNativeName,
} from "@/store/registerSlice";
import { language2Country } from "@/constants/language2Country";

const LanguageSchema = Yup.object().shape({
  language: Yup.string().min(1, "Invalid language").required("Required"),
  languageCode: Yup.string()
    .min(1, "Invalid language code")
    .required("Required"),
  languageNativename: Yup.string()
    .min(1, "Invalid language code")
    .required("Required"),
});

const CompleteForm = () => {
  const theme = useColorScheme() ?? "light";
  const router = useRouter();
  const dispatch = useDispatch();

  const [isSubmitting, setSubmitting] = useState(false);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [allLanguages, setAllLanguages] = useState([]);
  const [filteredLanguages, setFilteredLanguages] = useState([]);

  const handleComplete = async (form) => {
    setSubmitting(true);
    try {
      // Handle form submission
      console.log("Completing with:", form);
      dispatch(setMotherLanguageName(form.language));
      dispatch(setMotherLanguageNativeName(form.languageNativename));
      dispatch(setMotherLanguageCode(form.languageCode));
      router.push("/complete/language/step2" as Href);
    } catch (error) {
      console.error("Error logging in:", error);
      showToast("error", error.message);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response = await fetch("https://db.langx.io/v1/locale/languages");
        const data = await response.json();
        setAllLanguages(data.languages);
        setFilteredLanguages(data.languages);
      } catch (error) {
        console.error("Error fetching languages:", error);
        showToast("error", "Failed to load languages.");
      }
    };

    fetchLanguages();
  }, []);

  const renderLanguageItem = useCallback(
    ({ item, setFieldValue }) => (
      <Pressable
        onPress={() => {
          console.log("Selected language:", item);
          setFieldValue("language", item.name);
          setFieldValue("languageCode", item.code);
          setFieldValue("languageNativename", item.nativeName);
          setLanguageModalOpen(false);
        }}
      >
        <ThemedView style={styles.item}>
          <CountryFlag
            isoCode={language2Country[item.code]}
            size={20}
            style={styles.flag}
          />
          <ThemedText style={styles.text}>{item.name}</ThemedText>
        </ThemedView>
      </Pressable>
    ),
    []
  );

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query === "") {
      // If search query is empty, reset to all languages
      setFilteredLanguages(allLanguages);
    } else {
      const filtered = allLanguages.filter((lang) =>
        lang.name.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredLanguages(filtered);
    }
  };

  return (
    <Formik
      initialValues={{
        language: "",
        languageCode: "",
      }}
      validationSchema={LanguageSchema}
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
          {/* MotherLanguage Field */}
          <ThemedText style={styles.text}>Mother Language</ThemedText>
          <Pressable onPress={() => setLanguageModalOpen(true)}>
            <ThemedView style={styles.selectedLanguage}>
              {values.languageCode ? (
                <CountryFlag
                  isoCode={language2Country[values.languageCode]}
                  size={20}
                  style={styles.flag}
                />
              ) : null}
              <ThemedText style={[styles.text, styles.detail]}>
                {values.language ? values.language : "Select Language"}
              </ThemedText>
            </ThemedView>
          </Pressable>
          {errors.language && touched.language ? (
            <ThemedText style={{ color: Colors.light.error }}>
              {errors.language}
            </ThemedText>
          ) : null}
          <Modal
            visible={languageModalOpen}
            transparent={true}
            animationType="fade"
          >
            <TouchableWithoutFeedback
              onPress={() => setLanguageModalOpen(false)}
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
                      {filteredLanguages.length > 0 ? (
                        <FlatList
                          data={filteredLanguages}
                          keyExtractor={(item) => item.code}
                          renderItem={({ item }) =>
                            renderLanguageItem({ item, setFieldValue })
                          }
                        />
                      ) : (
                        <ThemedText style={styles.text}>
                          No languages found.
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

const Languages = () => {
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

        <ThemedText style={styles.headline}>Languages</ThemedText>

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
  flag: {
    marginRight: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  selectedLanguage: {
    flexDirection: "row",
    alignItems: "center",
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

export default Languages;
