import { test, expect } from "@playwright/test";

async function setupPublicShare(baseURL: string, title = "E2E Viewer Doc"): Promise<string> {
  const email = `viewer-e2e-${Math.random().toString(36).slice(2)}@example.com`;
  const registerRes = await fetch(`${baseURL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "correct horse battery staple", name: "Author" }),
  });
  if (!registerRes.ok) throw new Error(`register failed: ${registerRes.status} ${await registerRes.text()}`);
  const setCookie = registerRes.headers.get("set-cookie")!;
  const sessionCookie = /oa_session=([^;]+)/.exec(setCookie)![1];

  const orgRes = await fetch(`${baseURL}/api/v1/orgs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `oa_session=${sessionCookie}` },
    body: JSON.stringify({ name: "E2E workspace" }),
  });
  if (!orgRes.ok) throw new Error(`org creation failed: ${orgRes.status} ${await orgRes.text()}`);
  const { id: orgId } = (await orgRes.json()) as { id: string };

  const createRes = await fetch(`${baseURL}/api/v1/artifacts?orgId=${orgId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `oa_session=${sessionCookie}` },
    body: JSON.stringify({ title, kind: "html", content: "<h1>Hello from the viewer e2e spec</h1>", visibility: "private" }),
  });
  if (!createRes.ok) throw new Error(`create failed: ${createRes.status} ${await createRes.text()}`);
  const created = (await createRes.json()) as { artifact: { id: string } };

  // Explicit `mode: "public"` — the team's default share mode is "team", which would require a
  // logged-in member and defeat the point of an anonymous-viewer test.
  const shareRes = await fetch(`${baseURL}/api/v1/artifacts/${created.artifact.id}/shares`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `oa_session=${sessionCookie}` },
    body: JSON.stringify({ mode: "public" }),
  });
  if (!shareRes.ok) throw new Error(`share failed: ${shareRes.status} ${await shareRes.text()}`);
  const share = (await shareRes.json()) as { token: string };
  return share.token;
}

test("the viewer shell's own inline CSS/JS run under its CSP (no violations), and the panel collapses and persists", async ({ page, baseURL }) => {
  const token = await setupPublicShare(baseURL!);

  const cspViolations: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && /content security policy|refused to/i.test(msg.text())) cspViolations.push(msg.text());
  });

  await page.goto(`/s/${token}`);

  const panel = page.locator(".oa-panel");
  await expect(panel).toBeVisible();
  // A real, applied stylesheet (not a CSP-blocked one) gives the panel a border — the browser's
  // UA-stylesheet default for a bare <header> has none.
  const borderWidth = await panel.evaluate((el) => getComputedStyle(el).borderBottomWidth);
  expect(borderWidth).not.toBe("0px");

  // Positive control that the artifact's own content actually rendered in the sandboxed iframe.
  const iframe = page.frameLocator("iframe.oa-frame");
  await expect(iframe.locator("h1")).toHaveText("Hello from the viewer e2e spec");

  expect(cspViolations, `CSP violations logged: ${cspViolations.join("; ")}`).toEqual([]);

  // Collapse via the toggle button (driven by the shell's own inline <script>) and verify it
  // hides the secondary metadata row.
  const secondary = page.locator("#oa-panel-body");
  await expect(secondary).toBeVisible();
  await page.locator("#oa-toggle").click();
  await expect(secondary).toBeHidden();

  // Persisted via localStorage — survives a full reload, driven by the anti-FOUC head script.
  await page.reload();
  await expect(page.locator("#oa-panel-body")).toBeHidden();
});

test("Download source actually triggers a file download, not a navigation", async ({ page, baseURL }) => {
  const token = await setupPublicShare(baseURL!, "Downloadable Doc");
  await page.goto(`/s/${token}`);

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download source" }).click()]);
  // Chromium prefers the RFC 5987 `filename*=UTF-8''...` form (the human-readable "Downloadable
  // Doc-v1.html") over the ASCII `filename=` fallback ("downloadable-doc-v1.html") when both are
  // present — asserting on the ASCII form here would be pinning a browser implementation detail,
  // not this app's contract, so this just confirms a real download happened with the right shape.
  expect(download.suggestedFilename()).toMatch(/v1\.html$/);
});
