import type { Metadata, Viewport } from "next";
import "./reader.css";

/**
 * Другий КОРЕНЕВИЙ layout проєкту.
 *
 * Читалка навмисно не вкладена в layout панелі: у неї власні `<html>`/`<body>`,
 * власний CSS і жодного Tailwind-preflight, темних токенів чи сайдбару. Ціна
 * цього рішення одна — перехід між панеллю й читалкою робить повне
 * перезавантаження сторінки (так працюють кілька кореневих layout у Next).
 * Саме тому кнопка «Почитати» в панелі відкриває читалку в новій вкладці.
 *
 * Шрифти тут системні (Arial / Georgia), як у макеті: next/font не вантажимо,
 * бо жодна гарнітура з панелі тут не використовується.
 */

export const metadata: Metadata = {
  title: {
    default: "Wait, What?",
    template: "%s · Wait, What?",
  },
  description:
    "Тренди, робота, стосунки й сучасна культура — зрозуміло для міленіалів.",
};

export const viewport: Viewport = {
  themeColor: "#238fcd",
  colorScheme: "light",
};

export default function ReaderLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
