import type { Metadata } from "next";

import { RoleEntry } from "@/components/support/RoleEntry";

/**
 * Вхід у симулятор підтримки: «хто ти».
 *
 * Дві роли — не два застосунки, а два вигляди ОДНІЄЇ розмови: користувач пише в
 * `pairly_messages`, тех. сапорт читає ті самі рядки. Вибір роли робиться тут, а
 * не логіном: акаунтів у датасеті 32, і кожен — набір фактів (план, канал
 * покупки, статус підписки), від якого залежить вся відповідь агента.
 *
 * Сторінка порожня за задумом: довідники лежать під RLS без політик, а
 * `lib/supabase-admin.ts` не виходить за межі `app/api/pairly/**`, тому список
 * акаунтів забирає клієнт із `/api/pairly/stream`.
 */
export const metadata: Metadata = {
  title: "Хто ви",
};

export default function SupportEntryPage() {
  return <RoleEntry />;
}
