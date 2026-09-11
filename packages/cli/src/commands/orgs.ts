import { requireCredentials, saveCredentials } from "../config.js";
import { makeClient, type OrgChoice } from "../client.js";
import { resolveOrg } from "../org.js";
import { projectConfigTarget, writeProjectConfig } from "../project-config.js";
import { handleError, formatOrgChoices } from "./artifacts.js";

interface MeOrgsResponse {
  authKind: string;
  orgs: OrgChoice[];
}

export async function orgsCommand(opts: { json?: boolean }) {
  const creds = requireCredentials();
  const client = makeClient(creds);
  try {
    const data = await client.get<MeOrgsResponse>("/me/orgs");
    if (opts.json) {
      console.log(JSON.stringify(data.orgs, null, 2));
      return;
    }

    const current = resolveOrg({ creds });
    if (data.orgs.length === 0) {
      console.log("No teams found.");
      return;
    }
    console.log(
      data.orgs
        .map((o) => `${o.orgId === current.orgId ? "* " : "  "}${o.slug.padEnd(24)}  ${o.role.padEnd(7)}  ${o.name}`)
        .join("\n"),
    );
    console.log(current.orgId ? `\nCurrent: ${current.orgId} (from ${current.source})` : "\nNo default team selected for this project — run `oa use <slug>`.");
  } catch (err) {
    handleError(err);
  }
}

export async function useCommand(idOrSlug: string, opts: { global?: boolean }) {
  const creds = requireCredentials();
  const client = makeClient(creds);
  try {
    const data = await client.get<MeOrgsResponse>("/me/orgs");
    const match = data.orgs.find((o) => o.orgId === idOrSlug || o.slug === idOrSlug);
    if (!match) {
      console.error(`No team matching "${idOrSlug}". Run \`oa orgs\` to see what you belong to:\n${formatOrgChoices(data.orgs)}`);
      process.exit(1);
    }

    if (opts.global) {
      saveCredentials({ ...creds, orgId: match.orgId });
      console.log(`Default team for this machine set to ${match.name} (${match.slug}).`);
      return;
    }

    const target = projectConfigTarget(process.cwd());
    writeProjectConfig(target, { orgId: match.orgId, orgSlug: match.slug, server: creds.server });
    console.log(`Default team for this project set to ${match.name} (${match.slug}) — saved to ${target}`);
  } catch (err) {
    handleError(err);
  }
}
