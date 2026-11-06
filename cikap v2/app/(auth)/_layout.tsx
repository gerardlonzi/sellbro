// app/(auth)/_layout.tsx
import { Stack } from "expo-router";
import { useTheme } from "@/lib/theme/ThemeProvider";

export default function AuthLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: "fade" }} />;
}