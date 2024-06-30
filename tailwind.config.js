/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#161622",
        secondary: {
          DEFAULT: "#FF9C01",
          100: "#FF9001",
          200: "#FF8E01",
        },
        black: {
          DEFAULT: "#000",
          100: "#1E1E2D",
          200: "#232533",
        },
        gray: {
          100: "#CDCDE0",
        },
      },
      fontFamily: {
        pthin: ["Comfortaa", "sans-serif"],
        pextralight: ["Comfortaa", "sans-serif"],
        plight: ["Comfortaa", "sans-serif"],
        pregular: ["Comfortaa", "sans-serif"],
        pmedium: ["Comfortaa", "sans-serif"],
        psemibold: ["Comfortaa", "sans-serif"],
        pbold: ["Comfortaa", "sans-serif"],
        pextrabold: ["Comfortaa", "sans-serif"],
        pblack: ["Comfortaa", "sans-serif"],
      },
    },
  },
  plugins: [],
};
