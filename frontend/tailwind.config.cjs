/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
    "/home/alpha/habits-dev/src/**/*.{js,jsx}",
    "/home/alpha/journal-dev/src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        glow: "0 0 60px rgba(249, 115, 22, 0.16)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
