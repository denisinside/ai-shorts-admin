import { NextResponse } from "next/server";

import { fetchSlangEntries, fetchSlangIndex } from "@/lib/slang";

/**
 * Словник для читалки.
 *
 *   GET /api/slang            -> індекс: усі 389 термінів, тільки для пошуку й списку
 *   GET /api/slang?key=rizz   -> повна стаття (можна кілька: ?key=rizz&key=delulu)
 *
 * ЧОМУ ЧЕРЕЗ МАРШРУТ, А НЕ ПРЯМО З БРАУЗЕРА В SUPABASE. Публічний ключ і так
 * у бандлі, тож секрету тут не додається — додається КЕШ. Словник міняється
 * раз на тиждень, а індекс важить ~90 КБ: `revalidate` віддає його з кешу
 * Next замість того, щоб бити в базу на кожне відкриття сторінки. Заодно
 * форма відповіді лишається нашою, а не PostgREST-івською.
 */
export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET(request: Request) {
  const keys = new URL(request.url).searchParams.getAll("key").filter(Boolean);

  try {
    if (keys.length) {
      const entries = await fetchSlangEntries(keys);
      return NextResponse.json(
        { entries },
        { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
      );
    }
    const terms = await fetchSlangIndex();
    return NextResponse.json(
      { terms },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
    );
  } catch (error) {
    console.error("[slang]", error);
    // Порожній словник — не помилка сторінки: чат просто не підкреслить слова,
    // а вікно словника скаже, що не дістало список. Валити читалку через
    // ДОВІДКОВИЙ запит не можна.
    return NextResponse.json(
      { terms: [], entries: [], error: "словник зараз недоступний" },
      { status: 200 },
    );
  }
}
