"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonSize, type ButtonVariant } from "./Button";

/**
 * Кнопка сабміту, що сама знає про стан батьківської форми.
 * Для форм без useActionState — там pending приходить із хука напряму.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      pending={pending}
      pendingLabel={pendingLabel}
    >
      {children}
    </Button>
  );
}
