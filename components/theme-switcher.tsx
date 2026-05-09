"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const ICON_SIZE = 16;
const THEMES = ["light", "dark", "system"] as const;

const ThemeSwitcher = () => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const cycleTheme = () => {
    const idx = THEMES.indexOf(theme as (typeof THEMES)[number]);
    setTheme(THEMES[(idx + 1) % THEMES.length]);
  };

  return (
    <button
      onClick={cycleTheme}
      className="inline-flex items-center justify-center rounded-md px-3 py-2 hover:bg-surface-raised"
      aria-label={`Current theme: ${theme}. Click to cycle.`}
    >
      {theme === "light" ? (
        <Sun size={ICON_SIZE} className="text-muted-foreground" />
      ) : theme === "dark" ? (
        <Moon size={ICON_SIZE} className="text-muted-foreground" />
      ) : (
        <Laptop size={ICON_SIZE} className="text-muted-foreground" />
      )}
    </button>
  );
};

export { ThemeSwitcher };
