import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        indigo9: "#33418F",
        indigoDeep: "#252F68",
        indigoNight: "#1A2148",
        sand: "#F7F5F0",
        cream: "#FFFDF9",
        ink: "#20242E",
        inkSoft: "#5A6072",
        mango: "#F5A623",
        mangoDeep: "#E08F0B",
        okgreen: "#1E9E6A",
        wagreen: "#25D366",
        waDeep: "#128C4B",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        // ombres en couches, teintées d'indigo — jamais de gris pur
        card: "0 1px 2px rgba(32,36,46,.05), 0 10px 28px -14px rgba(37,47,104,.22)",
        float: "0 2px 4px rgba(32,36,46,.06), 0 18px 44px -18px rgba(37,47,104,.32)",
        cta: "0 2px 6px rgba(224,143,11,.25), 0 12px 28px -10px rgba(245,166,35,.55)",
        wa: "0 2px 6px rgba(18,140,75,.22), 0 12px 28px -10px rgba(37,211,102,.5)",
        insetHair: "inset 0 0 0 1px rgba(32,36,46,.08)",
      },
      letterSpacing: {
        micro: "0.14em",
      },
    },
  },
  plugins: [],
} satisfies Config;
