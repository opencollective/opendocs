import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,js,jsx}", "./src/server.ts"],
  theme: {
    extend: {},
  },
  plugins: [],
  darkMode: "media", // or 'class' if you want to control it manually
};

export default config;
