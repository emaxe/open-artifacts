import { cn } from "../../lib/cn";
import { colorFromId, monogram } from "../../lib/monogram";

export interface AvatarProps {
  /** Used for the deterministic color — never the display name, so two same-named entities still look distinct. */
  id: string;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES = {
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
};

export function Avatar({ id, name, size = "md", className }: AvatarProps) {
  const { bg, fg } = colorFromId(id);
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", SIZE_CLASSES[size], className)}
      style={{ backgroundColor: bg, color: fg }}
      aria-hidden="true"
    >
      {monogram(name)}
    </span>
  );
}
