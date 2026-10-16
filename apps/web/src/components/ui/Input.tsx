import { forwardRef, useState, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { EyeIcon, EyeOffIcon } from "./icons";

const FIELD_BASE =
  "w-full rounded-control border border-border bg-panel px-3 text-[0.9375rem] text-fg placeholder:text-muted " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:opacity-50 disabled:cursor-not-allowed";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(FIELD_BASE, "h-10 max-md:h-11", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(FIELD_BASE, "py-2 min-h-20", className)} {...props} />
));
Textarea.displayName = "Textarea";

// Deliberately kept as a native <select> with only border/color styling, not appearance:none +
// a custom-drawn arrow — the point of using a native control here is to get the platform's own
// keyboard handling, mobile picker UI, and accessibility tree for free (see the design notes in
// docs/superpowers/specs). A custom chevron would fight that on some platforms for no real gain.
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(FIELD_BASE, "h-10 max-md:h-11 pr-8", className)} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  showLabel?: string;
  hideLabel?: string;
}

/** A password field with an eye button that reveals the text. Type is controlled here, so it never takes a `type` prop. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showLabel = "Показать пароль", hideLabel = "Скрыть пароль", ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn(FIELD_BASE, "h-10 max-md:h-11 pr-11", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          title={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          className="absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-control text-muted transition-colors duration-150 hover:bg-panel-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
        >
          {visible ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
