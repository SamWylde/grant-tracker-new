import { createTheme } from "@mantine/core";

export const theme = createTheme({
  /* Dark mode and accessibility configuration */
  primaryColor: "grape",

  // Ensure good contrast ratios for both light and dark modes
  colors: {
    // Custom grape shades optimized for dark mode contrast
    grape: [
      "#f8f0fc", // lightest
      "#f3d9fa",
      "#eebefa",
      "#e599f7",
      "#da77f2",
      "#cc5de8", // primary (light mode)
      "#be4bdb", // primary (dark mode) - enhanced contrast
      "#ae3ec9",
      "#9c36b5",
      "#862e9c", // darkest
    ],
  },

  // Dark mode specific colors
  white: "#ffffff",
  black: "#000000",

  // Component-specific defaults for accessibility
  defaultRadius: "md",

  // Focus ring for keyboard navigation
  focusRing: "auto",

  // Ensure proper heading sizes for hierarchy
  headings: {
    fontWeight: "600",
    sizes: {
      h1: { fontSize: "2rem", lineHeight: "1.2" },
      h2: { fontSize: "1.75rem", lineHeight: "1.3" },
      h3: { fontSize: "1.5rem", lineHeight: "1.4" },
      h4: { fontSize: "1.25rem", lineHeight: "1.4" },
      h5: { fontSize: "1.125rem", lineHeight: "1.5" },
      h6: { fontSize: "1rem", lineHeight: "1.5" },
    },
  },
});
