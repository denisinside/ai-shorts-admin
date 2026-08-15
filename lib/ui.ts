/** Мінімальний склеювач класів — щоб не тягнути clsx заради трьох рядків. */
export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
