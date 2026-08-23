import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Ambient from "@/components/Ambient";
import Sidebar from "@/components/Sidebar";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: {
    default: "AI Shorts Admin",
    template: "%s · AI Shorts",
  },
  description: "Адмінпанель контент-пайплайну AI Shorts",
};

export const viewport: Viewport = {
  themeColor: "#0a0c12",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="uk"
      // Скрипт у <Ambient /> дописує сюди клас `refract` ще до гідратації —
      // для React це розбіжність атрибута, хоча вона навмисна
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Ambient />
        <Sidebar />
        <main className="min-h-screen md:pl-[17rem]">
          <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 md:px-8 md:pt-9">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
