import { useState } from "react";
import { cn } from "../../lib/cn";
import { copyToClipboard } from "../../lib/clipboard";
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
    const ok = await copyToClipboard(value);
    if (!ok) {
      // Clipboard access can be denied outright (permissions, hostile embedder) — fail silently,
      // the value is still visible/selectable on the page for a manual copy.
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
        "inline-flex items-center gap-1.5 rounded-control bg-panel-muted px-3 py-2 text-[0.8125rem] font-medium text-fg transition-colors duration-150 hover:bg-accent-soft",
        className,
      )}
    >
      {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
      {copied ? copiedLabel : label}
    </button>
  );
}
