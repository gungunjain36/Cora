const plugin = require("tailwindcss/plugin");

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./frontend/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
          text: "hsl(var(--secondary-text))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Cora custom colors
        morange: "#2E8B57",
        cora: {
          primary: "#3CB371",
          secondary: "#E0F5EE",
          dark: "#000000",
          light: "#FFFFFF",
          gray: "#606064",
          "light-green": "#98FB98",
          gradient: {
            text: "linear-gradient(104deg, #fff 2.92%, #2E8B57 91.72%)"
          }
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "3xl": "1.5rem",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "shimmer-slide": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "spin-around": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "shimmer-slide": "shimmer-slide 3s linear infinite",
        "spin-around": "spin-around 3s linear infinite",
      },
      fontFamily: {
        sans: ["sans-serif"],
        inter: ["Inter", "sans-serif"],
        neue: ["var(--font-neue-power)", "sans-serif"],
        bai: ["var(--font-bai-jamjuree)", "sans-serif"],
      },
      fontSize: {
        12: "0.75rem",
        14: "0.875rem",
        16: "1rem",
        18: "1.125rem",
        20: "1.25rem",
        24: "1.5rem",
        26: "1.625rem",
        30: "1.875rem",
        39: "2.4375rem",
        40: "2.5rem",
        48: "3rem",
        51: "3.1875rem",
        68: "4.25rem",
        110: "6.875rem",
      },
      lineHeight: {
        16: "1rem",
        18: "1.125rem",
        20: "1.25rem",
        22: "1.375rem",
        24: "1.5rem",
        26: "1.625rem",
        28: "1.75rem",
        32: "2rem",
        34: "2.125rem",
        42: "2.625rem",
        52: "3.25rem",
        62: "3.875rem",
        72: "4.5rem",
        116: "7.25rem",
        none: "1",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),

    plugin(function addTextStyles({ addComponents, theme }) {
      addComponents({
        // Component Regular Text Styles
        ".body-sm": {
          fontFamily: theme("fontFamily.inter"),
          fontSize: theme("fontSize.16"),
          lineHeight: theme("lineHeight.28"),
          fontWeight: theme("fontWeight.regular"),
        },
        ".body-md": {
          fontFamily: theme("fontFamily.inter"),
          fontSize: theme("fontSize.18"),
          lineHeight: theme("lineHeight.28"),
          fontWeight: theme("fontWeight.regular"),
        },

        // Component Semibold Text Styles
        ".body-sm-semibold": {
          fontFamily: theme("fontFamily.inter"),
          fontSize: theme("fontSize.16"),
          lineHeight: theme("lineHeight.28"),
          fontWeight: theme("fontWeight.semibold"),
        },
        ".body-md-semibold": {
          fontFamily: theme("fontFamily.inter"),
          fontSize: theme("fontSize.18"),
          lineHeight: theme("lineHeight.28"),
          fontWeight: theme("fontWeight.semibold"),
        },

        // Label Text Styles
        ".label-sm": {
          fontFamily: theme("fontFamily.inter"),
          fontSize: theme("fontSize.14"),
          lineHeight: theme("lineHeight.24"),
          color: theme("colors.secondary.text"),
        },

        // Title Text Styles
        ".title-md": {
          fontFamily: theme("fontFamily.inter"),
          fontSize: theme("fontSize.48"),
          lineHeight: theme("lineHeight.48"),
          fontWeight: theme("fontWeight.bold"),
          letterSpacing: "-1.2%",
        },

        // Heading Text Styles
        ".heading-sm": {
          fontFamily: theme("fontFamily.inter"),
          fontSize: theme("fontSize.24"),
          lineHeight: theme("lineHeight.32"),
          fontWeight: theme("fontWeight.semibold"),
          letterSpacing: "-0.6%",
        },
        ".heading-md": {
          fontFamily: theme("fontFamily.inter"),
          fontSize: theme("fontSize.30"),
          lineHeight: theme("lineHeight.36"),
          fontWeight: theme("fontWeight.semibold"),
        },

        // Display Text Styles
        ".display": {
          fontFamily: theme("fontFamily.inter"),
          fontSize: "32px",
          lineHeight: "52px",
          fontWeight: theme("fontWeight.bold"),
        },
        
        // Gradient text styles
        ".gradient_text": {
          background: "linear-gradient(180deg, #FFFFFF 0%, #9B9DC9 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          textFillColor: "transparent",
        },
        ".gradient_text_2": {
          background: "linear-gradient(180deg, #FFFFFF 0%, #2E8B57 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          textFillColor: "transparent",
        },
        ".gradient_text_3": {
          background: "linear-gradient(180deg, #FFFFFF 0%, #606064 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          textFillColor: "transparent",
        },
        
        // Card gradients
        ".black_card_gradient": {
          background: "linear-gradient(180deg, #1A1A1A 0%, #000000 100%)",
        },
        ".black_card_gradient_with_colors": {
          background: "linear-gradient(180deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.6) 100%)",
        },
        
        // Cora Button
        ".cora-button": {
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          whiteSpace: "nowrap",
          borderRadius: "9999px", // rounded-full
          paddingLeft: "2rem", // px-8
          paddingRight: "2rem", // px-8
          paddingTop: "1rem", // py-4
          paddingBottom: "1rem", // py-4
          minWidth: "160px",
          minHeight: "56px",
          fontSize: "1.125rem", // text-lg
          fontWeight: "500", // font-medium
          color: "rgba(31, 41, 55, 1)", // text-gray-800
          transition: "all 300ms ease-in-out",
        },
        
        // Cora Button Secondary
        ".cora-button-secondary": {
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          whiteSpace: "nowrap",
          borderRadius: "9999px", // rounded-full
          paddingLeft: "2rem", // px-8
          paddingRight: "2rem", // px-8
          paddingTop: "1rem", // py-4
          paddingBottom: "1rem", // py-4
          minWidth: "160px",
          minHeight: "56px",
          fontSize: "1.125rem", // text-lg
          fontWeight: "500", // font-medium
          color: "#FFFFFF", // text-white
          border: "1px solid #3CB371", // border border-cora-primary
          background: "transparent",
          transition: "all 300ms ease-in-out",
        },
      });
    }),
  ],
};
