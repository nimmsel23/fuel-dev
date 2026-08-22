const path = require("path")
const fs = require("fs")

// fuel-app importiert habit-app/journal-app via @habits/@journal-Alias (siehe
// vite.config.cjs) — Tailwind muss deren Dateien mitscannen, sonst werden dort
// verwendete Utility-Klassen im embedded Build rausgepurged. Siblings liegen je
// nach Checkout-Kontext unter -dev (Home-Root) oder -app (vitalos-Submodule) —
// hartkodierte Home-Pfade brechen in CI (vitalos-Checkout kennt kein ~/habits-dev).
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
    siblingGlob("habits-dev", "habit-app"),
    siblingGlob("journal-dev", "journal-app"),
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
