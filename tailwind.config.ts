import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        indigo9: "#33418F",
        indigoDeep: "#252F68",
        sand: "#F7F5F0",
        ink: "#20242E",
        mango: "#F5A623",
        okgreen: "#1E9E6A",
        wagreen: "#25D366",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
