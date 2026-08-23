import type { Metadata, Viewport } from "next";

import "./support.css";

/**
 * Третій кореневий layout проєкту — поряд із `(panel)` і `(reader)`.
 *
 * Файлу `app/layout.tsx` немає, і саме його відсутність робить кореневими всі
 * три групи: «any layout without a layout.js above it is a root layout».
 * Створити його означало б вставити два `<html>` один в один.
 *
 * Дужки в назві групи не потрапляють в URL, тому `/`, `/projects/*` і `/blog`
 * не змінилися. Ціна рішення одна й та сама: перехід між коренями — повне
 * перезавантаження, а не клієнтський перехід.
 *
 * CSS свій (`support.css`), без Tailwind: макет світлий, на системному Arial і
 * з власною палітрою, а стилі панелі притягли б preflight, темні токени й
 * шрифти, яких тут не треба. Next вантажить CSS маршрутом, тож три корені
 * стилів одне одного не бачать.
 */
export const metadata: Metadata = {
  title: { default: "Pairly Support", template: "%s · Pairly Support" },
  description:
    "Симулятор першої лінії підтримки Pairly: RAG-агент у Dify, дані акаунта як " +
    "джерело істини й передача складних випадків живому агенту.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#55499c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function SupportLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
