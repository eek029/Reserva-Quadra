import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#6D28D9",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#7C3AED",
          foreground: "#FFFFFF",
        },
        muted: "#F3F4F6",
      },
    },
  },
  plugins: [],
};
export default config;
