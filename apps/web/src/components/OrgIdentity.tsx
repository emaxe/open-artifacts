import { Avatar } from "./ui/Avatar";
import { Badge } from "./ui/Badge";
import { pluralRu } from "../lib/labels";

export interface OrgRef {
  id: string;
  name: string;
  slug: string;
  kind: "main" | "team";
  ownerEmail?: string | null;
  memberCount?: number;
}

export type OrgIdentitySecondary = "owner" | "slug" | "members" | "none";

export interface OrgIdentityProps {
  org: OrgRef;
  size?: "sm" | "md";
  /** What to show on the second line. Defaults to the first available of owner email -> slug. */
  secondary?: OrgIdentitySecondary;
}

/**
 * The single place a team/org is rendered anywhere in the app. With every user now owning an
 * auto-provisioned "main" workspace, two orgs can trivially share a display name (two people
 * named "Иван", two teams called "Маркетинг") — this component is how they stay distinguishable:
 * a color keyed to the org's *id* (never its name, see lib/monogram.ts), a "Основное" badge for
 * personal workspaces, and a secondary line (owner email, then slug, then a short id) that a
 * plain name never provides.
 */
export function OrgIdentity({ org, size = "md", secondary }: OrgIdentityProps) {
  const resolvedSecondary = secondary ?? (org.ownerEmail ? "owner" : "slug");
  let secondaryText: string | null = null;
  if (resolvedSecondary === "owner" && org.ownerEmail) secondaryText = org.ownerEmail;
  else if (resolvedSecondary === "members" && org.memberCount !== undefined) {
    secondaryText = `${org.memberCount} ${pluralRu(org.memberCount, ["участник", "участника", "участников"])}`;
  } else if (resolvedSecondary === "slug") secondaryText = org.slug;
  if (!secondaryText && resolvedSecondary !== "none") secondaryText = org.slug || org.id.slice(0, 8);

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar id={org.id} name={org.name} size={size} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`truncate font-medium text-fg ${size === "sm" ? "text-sm" : "text-sm"}`}>{org.name}</span>
          {org.kind === "main" && (
            <Badge variant="accent" className="shrink-0">
              Основное
            </Badge>
          )}
        </div>
        {secondaryText && <p className="truncate text-xs text-muted">{secondaryText}</p>}
      </div>
    </div>
  );
}
