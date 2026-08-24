const path = require("path")
const fs = require("fs")

// fuel-app importiert journal-app via @journal-Alias (siehe vite.config.cjs) —
// Tailwind muss dessen Dateien mitscannen, sonst werden dort verwendete
// Utility-Klassen im embedded Build rausgepurged. journal-dev selbst importiert
// wiederum habits-dev (Habit-Icons in der Journal-Timeline), daher auch dessen
// Glob. Siblings liegen je nach Checkout-Kontext unter -dev (Home-Root) oder
// -app (vitalos-Submodule) — hartkodierte Home-Pfade brechen in CI.
function siblingGlob(devName, appName) {
  const appPath = path.resolve(__dirname, "..", appName)
  const dir = fs.existsSync(appPath) ? appPath : path.resolve(__dirname, "..", devName)
  return `${dir}/src/**/*.{js,jsx}`
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
    siblingGlob("journal-dev", "journal-app"),
    siblingGlob("habits-dev", "habit-app"),
  ],
  theme: {
    extend: {
      boxShadow: {
        glow: "0 0 60px rgba(249, 115, 22, 0.16)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Fraunces", "ui-serif", "serif"],
        ticket: ['"Space Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        paper: {
          50: "#faf6ec",
          100: "#f2ead6",
          200: "#e6d8b8",
        },
      },
    },
  },
  plugins: [],
};
