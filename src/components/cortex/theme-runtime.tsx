"use client";

import { useEffect } from "react";
import { CORTEX_UI_CONFIG, normalizeThemeSettings } from "@/config/cortex-ui";

const CACHE_KEY = "cortex-ui-theme-cache-v1";
const CACHE_TTL = 5 * 60 * 1000;

type ThemeCache = { savedAt: number; settings: Record<string, string> };

function apply(settings: Record<string, string>) {
  const theme = normalizeThemeSettings({
    primary: settings["site.primaryColor"],
    secondary: settings["site.secondaryColor"],
    radius: settings["site.radius"],
    sidebar: settings["site.sidebarColor"],
  });
  const root = document.documentElement;
  root.style.setProperty("--primary", theme.primary);
  root.style.setProperty("--ring", theme.primary);
  root.style.setProperty("--secondary", theme.secondary);
  root.style.setProperty("--sidebar", theme.sidebar);
  root.style.setProperty("--radius", theme.radius);
}

export function CortexThemeRuntime() {
  useEffect(() => {
    let active = true;

    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as ThemeCache;
        if (cached?.settings && Date.now() - cached.savedAt < CACHE_TTL) apply(cached.settings);
      }
    } catch {
      // Cache is an optimization only.
    }

    fetch("/api/site-config", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("site config failed");
        return (await response.json()) as { settings?: Record<string, string> };
      })
      .then((data) => {
        if (!active || !data.settings) return;
        apply(data.settings);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), settings: data.settings }));
        } catch {
          // Ignore storage quota/private mode limitations.
        }
      })
      .catch(() => {
        apply({
          "site.primaryColor": CORTEX_UI_CONFIG.theme.primary,
          "site.secondaryColor": CORTEX_UI_CONFIG.theme.secondary,
          "site.radius": "0.75",
          "site.sidebarColor": CORTEX_UI_CONFIG.theme.sidebar,
        });
      });

    return () => { active = false; };
  }, []);

  return null;
}
