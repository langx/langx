import React from "react";
import { ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ThemedView } from "@/components/themed/atomic/ThemedView";
import PPCard from "@/components/profile/PPCard";
import OtherPhotosCard from "@/components/profile/OtherPhotosCard";
import AboutMeCard from "@/components/profile/AboutMeCard";
import LangXTokenCard from "@/components/profile/LangXTokenCard";
import DayStreaksCard from "@/components/profile/DayStreaksCard";
import LanguagesCard from "@/components/profile/LanguagesCard";
import BadgesCard from "@/components/profile/BadgesCard";
import ProfileManagementCard from "@/components/profile/ProfileManagementCard";

const mockUser = {
  name: "John Doe",
  profilePic: "userimageURL",
  birthdate: "1990-01-01",
  aboutMe: "I love coding, traveling, and learning new languages.",
  gender: "male",
  country: "US",
  lastSeen: "2024-07-01T12:00:00Z",
  contributors: [1, 2, 3],
  sponsor: true,
  username: "johndoe",
  emailVerification: true,
};

export default function ProfileScreen() {
  return (
    <ScrollView>
      <ThemedView>
        <PPCard user={mockUser}></PPCard>
        <OtherPhotosCard user={mockUser}></OtherPhotosCard>
        <AboutMeCard user={mockUser} account={mockUser}></AboutMeCard>
        <LanguagesCard></LanguagesCard>
        <BadgesCard></BadgesCard>
        <LangXTokenCard></LangXTokenCard>
        <DayStreaksCard></DayStreaksCard>
        <ProfileManagementCard></ProfileManagementCard>
      </ThemedView>
    </ScrollView>
  );
}
