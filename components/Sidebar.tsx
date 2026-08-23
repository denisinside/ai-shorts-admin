"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/ui";
import { BookIcon, LayersIcon, PlusIcon } from "./ui/icons";

const NAV = [
  { href: "/", label: "Проєкти", icon: LayersIcon, exact: true },
  { href: "/projects/new", label: "Новий проєкт", icon: PlusIcon, exact: false },
  // Читалка живе окремим кореневим layout, тому це посилання дає повне
  // перезавантаження, а не клієнтський перехід. Без пункту в меню сторінка
  // була б доступна лише глибоким посиланням з картки статті.
  { href: "/blog", label: "Блог", icon: BookIcon, exact: false },
] as const;

function useActiveHref() {
  const pathname = usePathname();
  return (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="btn-primary flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold">
        OT
      </span>
      <span className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink">
        Останній Токен
      </span>
    </div>
  );
}

export default function Sidebar() {
  const isActive = useActiveHref();

  return (
    <>
      {/* Десктоп: плаваюча скляна панель, відірвана від краю екрана —
          саме відступ робить її «плаваючою», а не приклеєною */}
      <aside className="glass-float fixed inset-y-4 left-4 z-40 hidden w-60 flex-col rounded-3xl p-3 md:flex">
        <div className="px-2 py-2">
          <Brand />
        </div>

        <nav className="mt-6 flex-1 space-y-1" aria-label="Головна навігація">
          {NAV.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "pressable relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-arc/14 text-ink ring-1 ring-inset ring-arc/25"
                    : "text-ink-muted hover:bg-white/6 hover:text-ink",
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-arc"
                  />
                )}
                <item.icon
                  className={cn("h-4.5 w-4.5", active && "text-arc")}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2.5">
          <div className="overflow-hidden rounded-2xl ring-1 ring-inset ring-white/8">
            <Image
              src="/homyak.png"
              alt="Хом'як"
              width={490}
              height={510}
              className="h-auto w-full object-cover"
            />
          </div>

          <div className="flex items-center gap-2.5 rounded-2xl bg-white/4 p-2.5 ring-1 ring-inset ring-white/8">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-arc/20 text-xs font-semibold text-arc">
              A
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">Admin</p>
              <p className="truncate text-xs text-ink-faint">
                admin@aishorts.com
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Мобільний: раніше навігації не було взагалі (hidden md:flex) */}
      <header className="glass-float sticky top-0 z-40 flex items-center justify-between gap-3 rounded-b-2xl px-4 py-3 md:hidden">
        <Brand />
        <nav className="flex items-center gap-1" aria-label="Головна навігація">
          {NAV.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={cn(
                  "pressable flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                  active
                    ? "bg-arc/16 text-arc ring-1 ring-inset ring-arc/25"
                    : "text-ink-muted hover:bg-white/6 hover:text-ink",
                )}
              >
                <item.icon className="h-4.5 w-4.5" />
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
