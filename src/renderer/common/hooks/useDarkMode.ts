import { useState, useEffect, useCallback } from "react";

type DarkModeRole = "master" | "slave";

const readStoredDarkMode = (): boolean => {
  const saved = localStorage.getItem("darkMode");
  if (saved !== null) return JSON.parse(saved) as boolean;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

const applyDocumentDarkMode = (isDark: boolean): void => {
  document.documentElement.classList.toggle("dark", isDark);
  localStorage.setItem("darkMode", JSON.stringify(isDark));
};

/**
 * master — top bar only: sends theme to main process on toggle and initial load.
 * slave  — tab strip / sidebar: follows IPC broadcasts from main.
 */
export const useDarkMode = (role: DarkModeRole = "slave") => {
  const [isDarkMode, setIsDarkMode] = useState(readStoredDarkMode);

  const notifyMain = useCallback(
    (isDark: boolean) => {
      if (role === "master") {
        window.electron?.ipcRenderer.send("dark-mode-changed", isDark);
      }
    },
    [role],
  );

  useEffect(() => {
    applyDocumentDarkMode(isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    if (role !== "master") return;
    window.electron?.ipcRenderer.send(
      "dark-mode-changed",
      readStoredDarkMode(),
    );
  }, [role]);

  useEffect(() => {
    const handleUpdate = (_event: unknown, next: unknown) => {
      if (typeof next !== "boolean") return;
      setIsDarkMode((current) => (current === next ? current : next));
    };

    window.electron?.ipcRenderer.on("dark-mode-updated", handleUpdate);
    return () => {
      window.electron?.ipcRenderer.removeListener(
        "dark-mode-updated",
        handleUpdate,
      );
    };
  }, []);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((current) => {
      const next = !current;
      notifyMain(next);
      return next;
    });
  }, [notifyMain]);

  return { isDarkMode, toggleDarkMode };
};
