import { CopyButton } from "./CopyButton";

/** A copyable single-command snippet — extracted from pages/help/AgentInstructionsPage.tsx so other pages needing the same look (HomePage's connect-an-agent snippet included) don't re-implement it. */
export function CodeBlock({ text, copyLabel, copiedLabel }: { text: string; copyLabel?: string; copiedLabel?: string }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <pre className="flex-1 overflow-x-auto rounded-control bg-panel-muted text-fg px-3.5 py-3 text-[0.8125rem] leading-6">
        <code>{text}</code>
      </pre>
      <CopyButton value={text} label={copyLabel} copiedLabel={copiedLabel} />
    </div>
  );
}
