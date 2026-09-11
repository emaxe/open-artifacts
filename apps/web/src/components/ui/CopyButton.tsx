import { useState } from "react";
import { cn } from "../../lib/cn";
import { CheckIcon, CopyIcon } from "./icons";

export interface CopyButtonProps {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}

/** Replaces the copy-to-clipboard + `copiedId`/setTimeout pattern that used to be re-implemented on every page that shows a link or token. */
export function CopyButton({ value, label = "Копировать", copiedLabel = "Скопировано", className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard access can be denied (permissions, insecure context) — fail silently, the
      // value is still visible/selectable on the page for a manual copy.
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-control border border-border bg-panel px-2.5 py-1 text-xs font-medium text-fg hover:bg-panel-muted",
        className,
      )}
    >
      {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
      {copied ? copiedLabel : label}
    </button>
  );
}
