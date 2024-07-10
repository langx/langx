import React from "react";
import { StyleSheet, View, Text, TextInput, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getFlagEmoji, getAge, lastSeenExt } from "@/constants/utils";
import { Colors } from "@/constants/Colors";

const mockUser = {
  aboutMe: "I love coding, traveling, and learning new languages.",
  country: "US",
  gender: "male",
  birthdate: "1990-01-01",
  $createdAt: "2020-01-01T00:00:00Z",
};

const AboutMeCard = ({ user, account }) => {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>About Me</Text>
        <Text style={styles.cardSubtitle}>Personal Information</Text>
      </View>
      <View style={styles.cardContent}>
        <View style={styles.item}>
          <Ionicons name="information-circle-outline" style={styles.icon} />
          <Text style={styles.label}>{user.aboutMe}</Text>
        </View>
        <View style={styles.item}>
          <Ionicons name="flag-outline" style={styles.icon} />
          <Text style={styles.label}>
            {user.country} {getFlagEmoji(user.country)}
          </Text>
        </View>
        <View style={styles.item}>
          <Ionicons name="male-female-outline" style={styles.icon} />
          <Text style={styles.label}>
            {user.gender.charAt(0).toUpperCase() + user.gender.slice(1)}
          </Text>
        </View>
        <View style={styles.item}>
          <Ionicons name="calendar-number-outline" style={styles.icon} />
          <Text style={styles.label}>{getAge(user.birthdate)} years old</Text>
        </View>
        <View style={styles.item}>
          <Ionicons name="time-outline" style={styles.icon} />
          <Text style={styles.label}>
            Registered {lastSeenExt(user.$createdAt)} ago
          </Text>
        </View>
        <View style={styles.item}>
          <Ionicons name="at-outline" style={styles.icon} />
          <Text style={styles.label}>@{user.username}</Text>
        </View>
        {account && account.emailVerification ? (
          <View style={styles.item}>
            <Ionicons
              name="shield-checkmark-outline"
              style={[styles.icon, { color: Colors.light.success }]}
            />
            <Text style={styles.label}>Verified Email</Text>
          </View>
        ) : (
          <View style={styles.item}>
            <Ionicons
              name="shield-outline"
              style={[styles.icon, { color: Colors.light.error }]}
            />
            <Text style={styles.label}>Unverified User</Text>
            <Pressable
              style={styles.editButton}
              onPress={() => console.log("Edit Account")}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
};

export default AboutMeCard;

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    overflow: "hidden",
    margin: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  cardHeader: {
    padding: 20,
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  cardSubtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#555",
  },
  cardContent: {
    padding: 20,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  icon: {
    fontSize: 24,
    marginRight: 20,
    color: Colors.light.primary,
  },
  label: {
    flex: 1,
    flexWrap: "wrap",
    width: "100%",
    fontSize: 16,
    color: "#555",
  },
  editButton: {
    marginLeft: 10,
  },
  editButtonText: {
    color: Colors.light.primary,
    fontSize: 14,
  },
});
