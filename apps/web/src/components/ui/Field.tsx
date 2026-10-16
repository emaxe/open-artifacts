import { useId, type ReactNode, isValidElement, cloneElement } from "react";
import { cn } from "../../lib/cn";

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

/** Wraps a single form control with an accessible label, optional hint, and error text. */
export function Field({ label, hint, error, required, children, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })
    : children;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[0.9375rem] font-medium text-fg">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-[0.8125rem] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-[0.8125rem] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
