import { CopyButton } from "./CopyButton";

/** A copyable single-command snippet — extracted from pages/help/AgentInstructionsPage.tsx so other pages needing the same look (HomePage's connect-an-agent snippet included) don't re-implement it. */
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
