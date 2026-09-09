import React, { createContext, useContext, useRef, useState, useCallback } from "react";
import { Animated, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme/ThemeProvider";

export type ToastType = "success" | "error" | "info";

type ToastItem = { message: string; type: ToastType };

type ToastContextValue = { showToast: (message: string, type?: ToastType) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONES: Record<ToastType, keyof typeof Feather.glyphMap> = {
  success: "check-circle",
  error: "alert-circle",
  info: "info",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastItem | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setToast(null);
      translateY.setValue(-16);
    });
  }, [opacity, translateY]);

  const showToast = useCallback(
    (message: string, type: ToastType = "success") => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setToast({ message, type });
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220 }),
      ]).start();
      timeoutRef.current = setTimeout(hide, 2600);
    },
    [opacity, translateY, hide]
  );

  const palette = {
    success: { bg: colors.successBg, fg: colors.success },
    error: { bg: colors.dangerBg, fg: colors.danger },
    info: { bg: colors.accentBg, fg: colors.accent },
  }[toast?.type ?? "success"];

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.wrap, { top: insets.top + 8, opacity, transform: [{ translateY }] }]}
        >
          <View style={[styles.toast, { backgroundColor: palette.bg, borderColor: palette.fg }]}>
            <Feather name={ICONES[toast.type]} size={16} color={palette.fg} />
            <Text style={{ color: palette.fg, fontSize: 13, flex: 1 }}>{toast.message}</Text>
            <TouchableOpacity onPress={hide} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={14} color={palette.fg} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé dans <ToastProvider>");
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 9999,
    elevation: 10,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 480,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
});