import React from "react";

import { Stack } from "expo-router";

const ModalsLayout = () => {
  return (
    <Stack>
      <Stack.Screen name="rooms" options={{ headerShown: false }} />
    </Stack>
  );
};

export default ModalsLayout;
