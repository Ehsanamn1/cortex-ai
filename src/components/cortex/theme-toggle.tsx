"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export type CortexTheme = "dark" | "light";
export const CORTEX_THEME_KEY = "cortex-theme-v2";

export function applyCortexTheme(theme: CortexTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  try {
    localStorage.setItem(CORTEX_THEME_KEY, theme);
  } catch {
    // Storage is an optimization; the DOM state is still updated.
  }
  window.dispatchEvent(new CustomEvent("cortex:theme-change", { detail: theme }));
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<CortexTheme>("dark");

  useEffect(() => {
    const current = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setTheme(current);
    const sync = () => setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    window.addEventListener("cortex:theme-change", sync);
    return () => window.removeEventListener("cortex:theme-change", sync);
  }, []);

  const next = theme === "dark" ? "light" : "dark";
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      whileHover={{ y: -1 }}
      onClick={() => {
        setTheme(next);
        applyCortexTheme(next);
      }}
      aria-label={next === "light" ? "فعال کردن حالت روشن" : "فعال کردن حالت تاریک"}
      aria-pressed={theme === "dark"}
      title={theme === "dark" ? "حالت تاریک فعال است" : "حالت روشن فعال است"}
      className={cn("cortex-theme-toggle", className)}
    >
      <span className="cortex-theme-toggle-track" aria-hidden="true">
        <motion.span
          className="cortex-theme-toggle-thumb"
          animate={{ x: theme === "dark" ? 0 : 24 }}
          transition={{ type: "spring", stiffness: 520, damping: 34 }}
        >
          <span className="cortex-theme-icon">
            {theme === "dark" ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
          </span>
        </motion.span>
        <span className="cortex-theme-track-icon start-1.5"><Moon className="size-3" /></span>
        <span className="cortex-theme-track-icon end-1.5"><Sun className="size-3" /></span>
      </span>
      <span className="sr-only">{theme === "dark" ? "تاریک" : "روشن"}</span>
    </motion.button>
  );
}
