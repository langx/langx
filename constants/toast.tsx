import Toast, {
  BaseToast,
  ErrorToast,
  ToastConfig,
} from "react-native-toast-message";

import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { ThemedView } from "@/components/themed/atomic/ThemedView";

const theme = useColorScheme() ?? "light";

export const showToast = (type: string, msg: string) => {
  const updatedMsg = msg.replace("AppwriteException: ", "");
  Toast.show({
    type: type,
    text1: updatedMsg,
  });
};

export const toastConfig: ToastConfig = {
  /*
    Overwrite 'success' type,
    by modifying the existing `BaseToast` component
  */
  success: (props) => (
    <ThemedView>
      <BaseToast
        {...props}
        style={{
          borderLeftColor: Colors[theme].success,
          backgroundColor: Colors[theme].background,
          zIndex: 9999,
        }}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        text1Style={{
          fontSize: 15,
          fontWeight: "400",
          fontFamily: "Lexend-Bold",
          color: Colors[theme].black,
        }}
      />
    </ThemedView>
  ),
  /*
    Overwrite 'error' type,
    by modifying the existing `ErrorToast` component
  */
  error: (props) => (
    <ErrorToast
      {...props}
      style={{
        borderLeftColor: Colors[theme].error,
        backgroundColor: Colors[theme].background,
        zIndex: 9999,
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 15,
        fontWeight: "400",
        fontFamily: "Lexend-Bold",
        color: Colors[theme].black,
      }}
    />
  ),
};
