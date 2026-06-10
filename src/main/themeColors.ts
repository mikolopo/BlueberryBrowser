/** Native shell colors synced with CSS theme tokens in renderer/common/styles/theme.css */
export const APP_THEME = {
  light: {
    windowBg: "#FCF9FF",
    contentBg: "#FFFFFF",
    titleBarOverlay: {
      color: "#FCF9FF",
      symbolColor: "#18181B",
      height: 48,
    },
  },
  dark: {
    windowBg: "#120F1A",
    contentBg: "#09090B",
    titleBarOverlay: {
      color: "#120F1A",
      symbolColor: "#FAFAFA",
      height: 48,
    },
  },
} as const;

export type AppThemeMode = keyof typeof APP_THEME;

export const getTheme = (isDark: boolean) =>
  isDark ? APP_THEME.dark : APP_THEME.light;
