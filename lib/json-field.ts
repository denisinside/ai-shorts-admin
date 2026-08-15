export function parseJsonField(
  value: FormDataEntryValue | null,
  fieldLabel: string,
): { value: unknown; error?: string } {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return { value: null };

  try {
    return { value: JSON.parse(raw) };
  } catch {
    return { value: null, error: `Invalid JSON in "${fieldLabel}"` };
  }
}
