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
import { Formik, FieldArray } from "formik";
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
import { useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { language2Country } from "@/constants/language2Country";
import { setLoading, setRegisterInitialState } from "@/store/registerSlice";
import { createUserDoc } from "@/services/userService";
import { useAuth } from "@/hooks/useAuth";
import { CompleteRegistrationRequestInterface } from "@/models/requests/completeRegistrationRequestInterface";
import { createLanguageDoc } from "@/services/languageService";
import { createLanguageRequestInterface } from "@/models/requests/createLanguageRequestInterface";
import { setUser } from "@/store/authSlice";

const LanguageSchema = Yup.object().shape({
  languages: Yup.array()
    .of(
      Yup.object().shape({
        language: Yup.string().min(1, "Invalid language").required("Required"),
        languageCode: Yup.string()
          .min(1, "Invalid language code")
          .required("Required"),
        languageNativename: Yup.string()
          .min(1, "Invalid language code")
          .required("Required"),
        level: Yup.number().min(0).max(3).required("Required"),
      })
    )
    .max(3, "You can add up to 3 languages"),
});

const CompleteForm = () => {
  const theme = useColorScheme() ?? "light";
  const router = useRouter();
  const dispatch = useDispatch();

  // Hooks
  const { currentAccount, jwt } = useAuth();

  const [isSubmitting, setSubmitting] = useState(false);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [allLanguages, setAllLanguages] = useState([]);
  const [filteredLanguages, setFilteredLanguages] = useState([]);
  const [currentLanguageIndex, setCurrentLanguageIndex] = useState(0);

  const motherLanguageCode = useSelector(
    (state: RootState) => state.register.motherLanguageCode
  );

  const registerState = useSelector((state: RootState) => state.register);

  const handleComplete = async (form) => {
    setSubmitting(true);
    dispatch(setLoading(true));
    try {
      // Create language docs
      const mLanguage: createLanguageRequestInterface = {
        name: registerState.motherLanguageName,
        nativeName: registerState.motherLanguageNativeName,
        code: registerState.motherLanguageCode,
        level: -1,
        motherLanguage: true,
      };

      const createLanguagePromises = [
        createLanguageDoc(mLanguage, jwt, currentAccount.$id),
        ...form.languages.map((lang) => {
          const language: createLanguageRequestInterface = {
            name: lang.language,
            nativeName: lang.languageNativename,
            code: lang.languageCode,
            level: lang.level,
            motherLanguage: false,
          };
          return createLanguageDoc(language, jwt, currentAccount.$id);
        }),
      ];

      await Promise.all(createLanguagePromises);

      // Create User Doc
      const userDoc: CompleteRegistrationRequestInterface = {
        name: currentAccount.name,
        birthdate: new Date(registerState.birthdate),
        country: registerState.country,
        countryCode: registerState.countryCode,
        gender: registerState.gender,
        lastSeen: new Date(),
        motherLanguages: [registerState.motherLanguageName],
        studyLanguages: form.languages.map((lang) => lang.language),
      };
      // console.log("User doc:", userDoc);
      const newUser = await createUserDoc(userDoc, jwt, currentAccount.$id);
      dispatch(setUser(newUser));
      // Get User data
      dispatch(setRegisterInitialState());

      // Redirect to home
      router.replace("/(home)");
    } catch (error) {
      console.error("Error logging in:", error);
      showToast("error", error.message);
    } finally {
      dispatch(setLoading(false));
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response = await fetch("https://db.langx.io/v1/locale/languages");
        const data = await response.json();
        const filtered = data.languages.filter(
          (lang) => lang.code !== motherLanguageCode
        );
        setAllLanguages(filtered);
        setFilteredLanguages(filtered);
        console.log("Fetched languages:", data.languages.length);
      } catch (error) {
        console.error("Error fetching languages:", error);
        showToast("error", "Failed to load languages.");
      }
    };

    fetchLanguages();
    console.log("Fetching languages...");
  }, [motherLanguageCode]);

  const renderLanguageItem = useCallback(
    ({ item, setFieldValue }) => (
      <Pressable
        onPress={() => {
          console.log("Selected language:", item);
          setFieldValue(
            `languages[${currentLanguageIndex}].language`,
            item.name
          );
          setFieldValue(
            `languages[${currentLanguageIndex}].languageCode`,
            item.code
          );
          setFieldValue(
            `languages[${currentLanguageIndex}].languageNativename`,
            item.nativeName
          );
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
    [currentLanguageIndex]
  );

  const handleSearch = (query, selectedLanguages) => {
    setSearchQuery(query);
    if (query === "") {
      // If search query is empty, reset to available languages
      setFilteredLanguages(
        allLanguages.filter((lang) => !selectedLanguages.includes(lang.code))
      );
    } else {
      const filtered = allLanguages.filter(
        (lang) =>
          lang.name.toLowerCase().includes(query.toLowerCase()) &&
          !selectedLanguages.includes(lang.code)
      );
      setFilteredLanguages(filtered);
    }
  };

  return (
    <Formik
      initialValues={{
        languages: [
          { language: "", languageCode: "", languageNativename: "", level: 0 },
        ],
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
      }) => {
        const selectedLanguages = values.languages.map(
          (language) => language.languageCode
        );
        const availableLanguages = allLanguages.filter(
          (lang) => !selectedLanguages.includes(lang.code)
        );

        return (
          <ThemedView style={{ flex: 1 }}>
            <FieldArray name="languages">
              {({ push, remove }) => (
                <>
                  {values.languages.map((language, index) => (
                    <React.Fragment key={index}>
                      <ThemedText style={styles.text}>
                        Study Language {index + 1}
                      </ThemedText>
                      <ThemedView
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <Pressable
                          onPress={() => {
                            setCurrentLanguageIndex(index);
                            setFilteredLanguages(
                              allLanguages.filter(
                                (lang) => !selectedLanguages.includes(lang.code)
                              )
                            );
                            setLanguageModalOpen(true);
                          }}
                          style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                          }}
                        >
                          {language.languageCode ? (
                            <CountryFlag
                              isoCode={language2Country[language.languageCode]}
                              size={20}
                              style={styles.flag}
                            />
                          ) : null}
                          <ThemedText style={[styles.text, styles.detail]}>
                            {language.language
                              ? language.language
                              : "Select Language"}
                          </ThemedText>
                        </Pressable>
                        {index > 0 && (
                          <Pressable onPress={() => remove(index)}>
                            <Ionicons
                              name="close-circle"
                              size={24}
                              color={Colors.light.error}
                            />
                          </Pressable>
                        )}
                      </ThemedView>
                      {language.language && (
                        <ThemedView style={styles.levelContainer}>
                          <Pressable
                            onPress={() =>
                              setFieldValue(`languages[${index}].level`, 0)
                            }
                            style={styles.levelButton}
                          >
                            <Ionicons
                              name="battery-dead-outline"
                              size={24}
                              color={
                                language.level === 0
                                  ? Colors.light.primary
                                  : Colors.light.gray2
                              }
                            />
                            <ThemedText style={styles.levelText}>
                              Absolute Beginner
                            </ThemedText>
                          </Pressable>
                          <Pressable
                            onPress={() =>
                              setFieldValue(`languages[${index}].level`, 1)
                            }
                            style={styles.levelButton}
                          >
                            <Ionicons
                              name="battery-half-outline"
                              size={24}
                              color={
                                language.level === 1
                                  ? Colors.light.primary
                                  : Colors.light.gray2
                              }
                            />
                            <ThemedText style={styles.levelText}>
                              Beginner
                            </ThemedText>
                          </Pressable>
                          <Pressable
                            onPress={() =>
                              setFieldValue(`languages[${index}].level`, 2)
                            }
                            style={styles.levelButton}
                          >
                            <Ionicons
                              name="battery-full-outline"
                              size={24}
                              color={
                                language.level === 2
                                  ? Colors.light.primary
                                  : Colors.light.gray2
                              }
                            />
                            <ThemedText style={styles.levelText}>
                              Intermediate
                            </ThemedText>
                          </Pressable>
                          <Pressable
                            onPress={() =>
                              setFieldValue(`languages[${index}].level`, 3)
                            }
                            style={styles.levelButton}
                          >
                            <Ionicons
                              name="rocket-outline"
                              size={24}
                              color={
                                language.level === 3
                                  ? Colors.light.primary
                                  : Colors.light.gray2
                              }
                            />
                            <ThemedText style={styles.levelText}>
                              Fluent
                            </ThemedText>
                          </Pressable>
                        </ThemedView>
                      )}
                      {errors.languages &&
                      errors.languages[index] &&
                      touched.languages &&
                      touched.languages[index] ? (
                        <ThemedText style={{ color: Colors.light.error }}>
                          {typeof errors.languages[index] === "object" &&
                            errors.languages[index].language}
                        </ThemedText>
                      ) : null}
                    </React.Fragment>
                  ))}
                  {values.languages.length < 3 && (
                    <ThemedButton
                      onPress={() =>
                        push({
                          language: "",
                          languageCode: "",
                          languageNativename: "",
                          level: 0,
                        })
                      }
                      style={styles.button}
                      type="outline"
                      title="Add More Language"
                    />
                  )}
                </>
              )}
            </FieldArray>
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
                          onChangeText={(query) =>
                            handleSearch(query, selectedLanguages)
                          }
                          value={searchQuery}
                        />
                        {availableLanguages.length > 0 ? (
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
              title="Done ✅"
            />
          </ThemedView>
        );
      }}
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
  levelContainer: {
    flexDirection: "column",
    justifyContent: "space-between",
    marginVertical: 10,
  },
  levelButton: {
    alignItems: "center",
    flexDirection: "row",
    marginVertical: 5,
  },
  levelText: {
    fontSize: 12,
    color: Colors.light.gray2,
    marginLeft: 10,
  },
});

export default Languages;
