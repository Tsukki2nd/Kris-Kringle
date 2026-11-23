import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0A0A0A",
        crimson: "#DC2626",
        emerald: "#16A34A",
      },
    },
  },
  plugins: [],
};

export default config;
