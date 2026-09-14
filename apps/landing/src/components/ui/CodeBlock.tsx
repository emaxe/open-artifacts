import { CopyButton } from "./CopyButton";

// Mirrors apps/web/src/components/ui/CodeBlock.tsx verbatim.
export function CodeBlock({ text, copyLabel, copiedLabel }: { text: string; copyLabel?: string; copiedLabel?: string }) {
  return (
    <div className="mt-1.5 flex items-start gap-2">
      <pre className="flex-1 overflow-x-auto rounded-control bg-panel-muted p-2.5 text-xs">
        <code>{text}</code>
      </pre>
      <CopyButton value={text} label={copyLabel} copiedLabel={copiedLabel} />
    </div>
  );
}
