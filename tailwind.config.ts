import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Starter compatibility — auth pages and tutorial components
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        // dine-in-cc design tokens (spec names, no prefix)
        "surface-base": "var(--surface-base)",
        "surface-raised": "var(--surface-raised)",
        "surface-overlay": "var(--surface-overlay)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
        accent: "#FF6B35",
        "accent-muted": "var(--accent-muted)",
        success: "var(--success)",
        border: "var(--border)",
        error: "#FF3B30",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontSize: {
        // Apple HIG-aligned type scale
        "display":   ["3rem",    { lineHeight: "1.1",  fontWeight: "700" }],
        "title-1":   ["2.125rem",{ lineHeight: "1.15", fontWeight: "700" }],
        "title-2":   ["1.75rem", { lineHeight: "1.2",  fontWeight: "600" }],
        "title-3":   ["1.25rem", { lineHeight: "1.3",  fontWeight: "600" }],
        "headline":  ["1.0625rem",{ lineHeight: "1.35", fontWeight: "600" }],
        "body":      ["1.0625rem",{ lineHeight: "1.5",  fontWeight: "400" }],
        "callout":   ["1rem",    { lineHeight: "1.5",  fontWeight: "400" }],
        "subhead":   ["0.9375rem",{ lineHeight: "1.45", fontWeight: "400" }],
        "footnote":  ["0.8125rem",{ lineHeight: "1.4",  fontWeight: "400" }],
        "caption":   ["0.75rem", { lineHeight: "1.35", fontWeight: "400" }],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
