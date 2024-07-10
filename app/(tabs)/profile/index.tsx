import React from "react";
import { Ionicons } from "@expo/vector-icons";
import PPCard from "@/components/profile/PPCard";

const mockUser = {
  name: "John Doe",
  profilePic: "userimageURL",
  birthdate: "1990-01-01",
  gender: "male",
  country: "US",
  lastSeen: "2024-07-01T12:00:00Z",
  contributors: [1, 2, 3],
  sponsor: true,
};

export default function ProfileScreen() {
  return <PPCard user={mockUser}></PPCard>;
}
