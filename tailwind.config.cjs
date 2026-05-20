/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        "surface-0": "#0a0a0b",
        "surface-1": "#0f0f12",
        "surface-2": "#16161a",
        "surface-3": "#1d1d22",
        "line-subtle": "#1a1a1f",
        "line-base": "#26262d",
        "line-strong": "#3a3a44",
        "ink-0": "#e8e8ed",
        "ink-1": "#b8b8c2",
        "ink-2": "#7e7e8a",
        "ink-3": "#5a5a64",
        accent: "#6e6ef0",
        "accent-soft": "rgba(110, 110, 240, 0.18)",
        "accent-hover": "#7d7df7",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Inter", "Segoe UI", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
