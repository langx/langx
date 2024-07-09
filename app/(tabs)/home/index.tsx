import React, { useEffect, useState } from "react";
import { Dimensions, FlatList } from "react-native";
import { useDatabase } from "@/hooks/useDatabase";
import { useColorScheme } from "@/hooks/useColorScheme";
import { listUsers } from "@/services/userService";
import { ThemedView } from "@/components/atomic/ThemedView";
import ForYouSection from "@/components/home/ForYouSection";
import UserCard from "@/components/home/UserCard";

const breakpoints = {
  xs: 0,
  sm: 320,
  md: 480,
  lg: 768,
  xl: 1024,
  xxl: 1440,
  mobile: 640,
};
const getNumColumns = (width) => {
  if (width < breakpoints.sm) return 2; // xs
  else if (width >= breakpoints.sm && width < breakpoints.md) return 2; // sm
  else if (width >= breakpoints.md && width < breakpoints.lg) return 3; // md
  else if (width >= breakpoints.lg && width < breakpoints.xl) return 4; // lg
  else if (width >= breakpoints.xl && width < breakpoints.xxl) return 6; // xl
  else if (width >= breakpoints.xxl) return 8; // xxl
};

export default function CommunityScreen() {
  const theme = useColorScheme() === "dark" ? "dark" : "light";
  const { data: users, loading, refetch } = useDatabase(listUsers);

  const [screenWidth, setScreenWidth] = useState(
    Dimensions.get("window").width
  );
  const [numColumns, setNumColumns] = useState(getNumColumns(screenWidth));
  useEffect(() => {
    const updateLayout = () => {
      const newWidth = Dimensions.get("window").width;
      setScreenWidth(newWidth);
      console.log("Screen width changed to", newWidth);
    };

    // Subscribe to dimension changes
    const subscription = Dimensions.addEventListener("change", updateLayout);

    // Return a cleanup function that removes the event listener
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    setNumColumns(getNumColumns(screenWidth));
  }, [screenWidth]);

  const renderItem = ({ item }) => {
    return (
      <>
        <UserCard item={item} loadingItem={loading} />
      </>
    );
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={users}
        keyExtractor={(item) => item.$id.toString()}
        renderItem={renderItem}
        key={numColumns}
        numColumns={numColumns}
        ListHeaderComponent={
          <ThemedView>
            <ForYouSection users={users} />
          </ThemedView>
        }
      />
    </ThemedView>
  );
}
