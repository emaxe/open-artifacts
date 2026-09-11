import { cn } from "../../lib/cn";
import { LoaderIcon } from "./icons";

/** A centered loading indicator for a whole page/section — replaces the bare "Загрузка…" text. */
export function Spinner({ label = "Загрузка…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-10 text-sm text-muted", className)}>
      <LoaderIcon size={16} />
      {label}
    </div>
  );
}
