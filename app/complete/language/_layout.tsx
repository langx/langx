import { Stack } from "expo-router";

export default function CompleteLayout() {
  return (
    <Stack>
      <Stack.Screen name="step1" options={{ headerShown: false }} />
      <Stack.Screen name="step2" options={{ headerShown: false }} />
    </Stack>
  );
}
