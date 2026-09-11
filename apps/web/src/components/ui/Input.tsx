import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const FIELD_BASE =
  "w-full rounded-control border border-border bg-panel px-3 text-sm text-fg placeholder:text-muted " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:opacity-50 disabled:cursor-not-allowed";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(FIELD_BASE, "h-9 max-md:h-11", className)} {...props} />
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
  <select ref={ref} className={cn(FIELD_BASE, "h-9 max-md:h-11 pr-8", className)} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";
