export function parseJsonField(
  value: FormDataEntryValue | null,
  fieldLabel: string,
): { value: unknown; error?: string } {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return { value: null };

  try {
    return { value: JSON.parse(raw) };
  } catch {
    return { value: null, error: `Некоректний JSON у полі «${fieldLabel}»` };
  }
}

/**
 * Для NOT NULL jsonb-колонок (day2_plan.hook_formats, day3_assets.hook_variants):
 * порожнє поле має стати [], а не null — інакше Postgres відповідає
 * 23502 not_null_violation, і користувач бачить сирий текст помилки драйвера.
 */
export function parseRequiredJsonField(
  value: FormDataEntryValue | null,
  fieldLabel: string,
): { value: unknown; error?: string } {
  const parsed = parseJsonField(value, fieldLabel);
  if (parsed.error) return parsed;
  return { value: parsed.value ?? [] };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Необовʼязковий UUID із форми. Навмисно не вимагає саме v4: id, які повернула
 * база, можуть бути створені сідом чи іншим інструментом.
 */
export function parseOptionalUuid(
  value: FormDataEntryValue | null,
  fieldLabel: string,
): { value: string | null; error?: string } {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return { value: null };
  if (!UUID_RE.test(raw)) {
    return { value: null, error: `Поле «${fieldLabel}» не є UUID` };
  }
  return { value: raw.toLowerCase() };
}

export function parseOptionalIndex(
  value: FormDataEntryValue | null,
  fieldLabel: string,
): { value: number | null; error?: string } {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return { value: null };
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return { value: null, error: `Поле «${fieldLabel}» має бути цілим ≥ 0` };
  }
  return { value: parsed };
}
