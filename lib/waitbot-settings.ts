"use client";

import { useCallback, useSyncExternalStore } from "react";

import { WAITBOT_DEFAULTS, type WaitbotSettings } from "./waitbot";

/**
 * Налаштування вікна WaitBot, що переживають перезавантаження сторінки.
 *
 * ЧОМУ `useSyncExternalStore`, А НЕ `useState` + ефект. Значення живе в
 * `localStorage`, якого на сервері не існує: прочитати його в ініціалізаторі
 * означає розбіжність гідратації, а прочитати в ефекті — `setState` під час
 * ефекту, який ESLint (react-hooks/set-state-in-effect) справедливо не
 * пропускає. Зовнішнє сховище описує саме цей випадок: серверний знімок —
 * дефолти, клієнтський — те, що збережено.
 *
 * ЗНІМОК КЕШУЄТЬСЯ В МОДУЛІ. `getSnapshot` мусить повертати ТЕ САМЕ значення
 * між змінами; якби він щоразу парсив JSON, React отримував би новий обʼєкт
 * на кожен рендер і зациклювався. Той самий підхід, що в годиннику трея.
 */
const KEY = "waitbot.settings";

let cache: WaitbotSettings = WAITBOT_DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function read(): WaitbotSettings {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return WAITBOT_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<WaitbotSettings>;
    return {
      lang:
        parsed.lang === "uk" || parsed.lang === "en" || parsed.lang === "auto"
          ? parsed.lang
          : WAITBOT_DEFAULTS.lang,
      memesAfterTranslate:
        typeof parsed.memesAfterTranslate === "boolean"
          ? parsed.memesAfterTranslate
          : WAITBOT_DEFAULTS.memesAfterTranslate,
    };
  } catch {
    // Приватне вікно, заблоковані дані сайту або побитий JSON — дефолти.
    return WAITBOT_DEFAULTS;
  }
}

function subscribe(listener: () => void): () => void {
  if (!loaded) {
    loaded = true;
    cache = read();
  }
  listeners.add(listener);
  // Друга вкладка змінила налаштування — підхоплюємо. Подія `storage`
  // приходить лише в ІНШІ вкладки, тому власний запис нотифікуємо самі.
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) {
      cache = read();
      listeners.forEach((l) => l());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () => cache;
const getServerSnapshot = () => WAITBOT_DEFAULTS;

export function useWaitbotSettings(): [
  WaitbotSettings,
  (patch: Partial<WaitbotSettings>) => void,
] {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const patch = useCallback((next: Partial<WaitbotSettings>) => {
    cache = { ...cache, ...next };
    try {
      window.localStorage.setItem(KEY, JSON.stringify(cache));
    } catch {
      // Не зберіглося — налаштування діють до перезавантаження, і це ок.
    }
    listeners.forEach((l) => l());
  }, []);

  return [settings, patch];
}
