/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./src/renderer/**/*.{js,ts,jsx,tsx,html}"],
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
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
          foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--popover) / <alpha-value>)",
          foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 0.1rem)",
        sm: "calc(var(--radius) - 0.4rem)",
      },
      fontSize: {
        "2xs": ["0.625rem", "0.75rem"],
      },
      spacing: {
        4.5: "1.125rem",
      },
      boxShadow: {
        subtle: "0 0 6px rgba(0,0,0,0.06)",
        tab: "0 0 5px rgba(0,0,0,0.08)",
        expanded: "0 8px 16px rgba(0,0,0,0.15)",
        chat: "0 10px 40px rgba(0,0,0,0.04)",
      },
      animation: {
        "spring-scale": "spring-scale 0.2s ease-in-out forwards",
        "star-spin": "star-spin 3s ease-in-out infinite",
        "fade-in": "fade-in 0.3s ease-out forwards",
        "message-in": "message-in 0.35s ease-out both",
        "typing-bounce": "typing-bounce 1.2s ease-in-out infinite",
        "cursor-blink": "cursor-blink 1s step-end infinite",
        "slide-in-right": "slide-in-right 0.22s ease-out forwards",
        "slide-in-left": "slide-in-left 0.22s ease-out forwards",
        "panel-fade": "panel-fade 0.18s ease-out forwards",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "agent-bob": "agent-bob 1.2s ease-in-out infinite",
        "agent-think": "agent-think 2.4s ease-in-out infinite",
        "agent-fly": "agent-fly 0.45s ease-in-out infinite",
        "agent-read": "agent-read 2.8s ease-in-out infinite",
        "agent-peek": "agent-peek 1.1s ease-in-out infinite",
        "agent-wait": "agent-wait 1.6s ease-in-out infinite",
        "agent-work": "agent-work 0.35s ease-in-out infinite",
        "agent-happy": "agent-happy 0.7s cubic-bezier(0.34,1.4,0.48,1) 2",
        "agent-shake": "agent-shake 0.45s ease-in-out 2",
        "agent-click": "agent-click 0.22s ease-out 1",
        "agent-strip-glow": "agent-strip-glow 2.4s ease-in-out infinite",
      },
      keyframes: {
        "spring-scale": {
          "0%": { transform: "scale(0.95)" },
          "50%": { transform: "scale(1.02)" },
          "100%": { transform: "scale(1)" },
        },
        "star-spin": {
          "0%, 50%": { transform: "rotate(0deg)" },
          "60%": { transform: "rotate(-20deg)" },
          "65%": { transform: "rotate(-15deg)" },
          "67%": { transform: "rotate(-20deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "message-in": {
          "0%": { opacity: "0", transform: "translateY(8px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "typing-bounce": {
          "0%, 60%, 100%": { transform: "translateY(0)", opacity: "0.45" },
          "30%": { transform: "translateY(-4px)", opacity: "1" },
        },
        "cursor-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "panel-fade": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.55", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.08)" },
        },
        "agent-bob": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-2px)" },
        },
        "agent-think": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-3px) rotate(-4deg)" },
        },
        "agent-fly": {
          "0%, 100%": { transform: "translateY(0) scale(1)" },
          "50%": { transform: "translateY(-4px) scale(1.05)" },
        },
        "agent-read": {
          "0%, 100%": { transform: "translateX(0) rotate(0deg)" },
          "33%": { transform: "translateX(-2px) rotate(-2deg)" },
          "66%": { transform: "translateX(2px) rotate(2deg)" },
        },
        "agent-peek": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.08) translateY(-1px)" },
        },
        "agent-wait": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.75", transform: "scale(0.94)" },
        },
        "agent-work": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-2px)" },
        },
        "agent-happy": {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.15) translateY(-3px)" },
          "100%": { transform: "scale(1) translateY(0)" },
        },
        "agent-shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-2px)" },
          "40%": { transform: "translateX(2px)" },
          "60%": { transform: "translateX(-2px)" },
          "80%": { transform: "translateX(2px)" },
        },
        "agent-click": {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(0.88)" },
          "100%": { transform: "scale(1)" },
        },
        "agent-strip-glow": {
          "0%, 100%": { boxShadow: "inset 0 -1px 0 rgba(99,102,241,0.15)" },
          "50%": { boxShadow: "inset 0 -1px 0 rgba(99,102,241,0.45)" },
        },
      },
    },
  },
  plugins: [],
};
