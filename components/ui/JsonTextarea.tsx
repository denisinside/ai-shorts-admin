"use client";

import { useState, type ReactNode } from "react";
import { Field, Textarea } from "./Field";
import { CheckIcon } from "./icons";

/**
 * Поле JSON із перевіркою просто в браузері. Раніше про синтаксичну помилку
 * можна було дізнатися лише після сабміту, з сервера — тепер видно одразу,
 * плюс кнопка форматування.
 */
export function JsonTextarea({
  name,
  label,
  defaultValue,
  rows = 10,
  hint,
}: {
  name: string;
  label: ReactNode;
  defaultValue: string;
  rows?: number;
  hint?: ReactNode;
}) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = value.trim() === "";
  const isValid = !isEmpty && error === null;

  function validate(next: string) {
    if (next.trim() === "") {
      setError(null);
      return;
    }
    try {
      JSON.parse(next);
      setError(null);
    } catch (parseError) {
      setError(
        parseError instanceof Error ? parseError.message : "Некоректний JSON",
      );
    }
  }

  function format() {
    try {
      setValue(JSON.stringify(JSON.parse(value), null, 2));
      setError(null);
    } catch {
      /* кнопка неактивна, поки JSON невалідний — сюди не потрапляємо */
    }
  }

  return (
    <Field
      label={
        <span className="flex items-center justify-between gap-3">
          <span>{label}</span>
          <span className="flex items-center gap-2 text-xs font-normal">
            {isValid && (
              <span className="flex items-center gap-1 text-ok">
                <CheckIcon className="h-3.5 w-3.5" />
                валідний
              </span>
            )}
            <button
              type="button"
              onClick={format}
              disabled={!isValid}
              className="rounded-md px-1.5 py-0.5 text-ink-faint transition-colors hover:text-arc disabled:opacity-40 disabled:hover:text-ink-faint"
            >
              Форматувати
            </button>
          </span>
        </span>
      }
      htmlFor={name}
      hint={hint}
      error={error}
    >
      <Textarea
        id={name}
        name={name}
        rows={rows}
        spellCheck={false}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        onChange={(event) => {
          setValue(event.target.value);
          if (error) validate(event.target.value);
        }}
        onBlur={(event) => validate(event.target.value)}
        className="field-mono"
      />
    </Field>
  );
}
