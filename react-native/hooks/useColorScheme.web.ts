// NOTE: The default React Native styling doesn't support server rendering.
// Server rendered styles should not change between the first render of the HTML
// and the first render on the client. Typically, web developers will use CSS media queries
// to render different styles on the client and server, these aren't directly supported in React Native
// but can be achieved using a styling library like Nativewind.
// export function useColorScheme() {
//   return 'light';
// }
import { useEffect, useState } from "react";

export function useColorScheme() {
  // Function to get the current color scheme
  const getColorScheme = () => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return "light"; // Default to 'light' theme if window or matchMedia is not available
  };

  const [colorScheme, setColorScheme] = useState(getColorScheme());

  useEffect(() => {
    const handleChange = (event: MediaQueryListEvent) => {
      setColorScheme(event.matches ? "dark" : "light");
    };

    const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");

    // Use addEventListener to attach the event listener
    darkModeQuery.addEventListener("change", handleChange);

    // Clean up
    return () => {
      // Use removeEventListener to detach the event listener
      darkModeQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return colorScheme;
}
