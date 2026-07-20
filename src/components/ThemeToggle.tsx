import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "tariyal-theme";

function applyTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as "light" | "dark" | null) ?? "light";
    setTheme(stored);
    applyTheme(stored);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      aria-label={mounted && theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-yellow-600 bg-linear-to-b from-yellow-400 to-yellow-500 text-slate-900 shadow-md transition-transform hover:scale-105 sm:h-10 sm:w-10"
    >
      {mounted && theme === "dark" ? (
        <Sun className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.5} />
      ) : (
        <Moon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.5} />
      )}
    </button>
  );
}
