/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./components/**/*.{js,ts,jsx,tsx}", "./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Playfair Display"', "Georgia", "serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      colors: {
        bg: { DEFAULT: "#0a0a0a", card: "#111111", hover: "#1a1a1a" },
        accent: { DEFAULT: "#c9a96e", dim: "#a08040", light: "#e0c990" },
        tx: { DEFAULT: "#e8e8e8", muted: "#888888", dim: "#555555" },
      },
    },
  },
  plugins: [],
};
