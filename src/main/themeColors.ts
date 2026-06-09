/** Native shell colors synced with CSS theme tokens in renderer/common/styles/theme.css */
export const APP_THEME = {
  light: {
    windowBg: "#FAFAFC",
    contentBg: "#FFFFFF",
    titleBarOverlay: {
      color: "#FFFFFF",
      symbolColor: "#18181B",
      height: 48,
    },
  },
  dark: {
    windowBg: "#09090B",
    contentBg: "#09090B",
    titleBarOverlay: {
      color: "#0F0F12",
      symbolColor: "#FAFAFA",
      height: 48,
    },
  },
} as const;

export type AppThemeMode = keyof typeof APP_THEME;

export const getTheme = (isDark: boolean) =>
  isDark ? APP_THEME.dark : APP_THEME.light;
