try {
  var saved = localStorage.getItem("darkMode");
  var isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (saved !== null) isDark = JSON.parse(saved);
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
} catch (_) {}
