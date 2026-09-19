import { test, expect, type BrowserContext, type Page } from "@playwright/test";

interface SetupResult {
  token: string;
  shareId: string;
  artifactId: string;
  sessionCookie: string;
}

async function setupShare(baseURL: string, opts: { title?: string; mode?: "public" | "team" } = {}): Promise<SetupResult> {
  const { title = "E2E Viewer Doc", mode = "public" } = opts;
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

  // The mode is always explicit: the team's default share mode is "team", which would require a
  // logged-in member and defeat the point of an anonymous-viewer test.
  const shareRes = await fetch(`${baseURL}/api/v1/artifacts/${created.artifact.id}/shares`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `oa_session=${sessionCookie}` },
    body: JSON.stringify({ mode }),
  });
  if (!shareRes.ok) throw new Error(`share failed: ${shareRes.status} ${await shareRes.text()}`);
  const share = (await shareRes.json()) as { id: string; token: string };
  return { token: share.token, shareId: share.id, artifactId: created.artifact.id, sessionCookie };
}

async function setupPublicShare(baseURL: string, title = "E2E Viewer Doc"): Promise<string> {
  return (await setupShare(baseURL, { title })).token;
}

/** The artifact's author is its "manager": the page must be opened with their session cookie. */
async function loginAsAuthor(context: BrowserContext, baseURL: string, sessionCookie: string) {
  await context.addCookies([{ name: "oa_session", value: sessionCookie, url: baseURL }]);
}

function collectCspViolations(page: Page): string[] {
  const violations: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && /content security policy|refused to/i.test(msg.text())) violations.push(msg.text());
  });
  return violations;
}

async function currentShareMode(page: Page, artifactId: string): Promise<string> {
  const res = await page.request.get(`/api/v1/artifacts/${artifactId}/shares`);
  expect(res.ok()).toBe(true);
  const { shares } = (await res.json()) as { shares: { id: string; mode: string }[] };
  return shares[0]!.mode;
}

const modeChip = (page: Page) => page.locator(".oa-share-mode > summary");
const modeRow = (page: Page, mode: string) => page.locator(`.oa-mode-opt[data-mode="${mode}"]`);

test("the anonymous viewer shell's own inline CSS/JS run under its CSP (no violations) and it is a single fixed row", async ({ page, baseURL }) => {
  const token = await setupPublicShare(baseURL!);
  const cspViolations = collectCspViolations(page);

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

  // An anonymous visitor has nothing to expand and nothing to manage.
  await expect(page.locator("#oa-toggle")).toHaveCount(0);
  await expect(page.locator(".oa-share-mode")).toHaveCount(0);

  expect(cspViolations, `CSP violations logged: ${cspViolations.join("; ")}`).toEqual([]);
});

test("the manager's details block starts collapsed, toggles, and the choice persists across a reload", async ({ page, context, baseURL }) => {
  const { token, sessionCookie } = await setupShare(baseURL!);
  await loginAsAuthor(context, baseURL!, sessionCookie);
  const cspViolations = collectCspViolations(page);

  await page.goto(`/s/${token}`);

  const details = page.locator("#oa-panel-body");
  const toggle = page.locator("#oa-toggle");
  await expect(toggle).toBeVisible();
  await expect(details).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toHaveAttribute("aria-label", "Show details");

  await toggle.click();
  await expect(details).toBeVisible();
  await expect(details).toContainText("views");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(toggle).toHaveAttribute("aria-label", "Hide details");

  // Persisted via localStorage — survives a full reload, driven by the anti-FOUC head script.
  await page.reload();
  await expect(page.locator("#oa-panel-body")).toBeVisible();

  await page.locator("#oa-toggle").click();
  await expect(page.locator("#oa-panel-body")).toBeHidden();
  await page.reload();
  await expect(page.locator("#oa-panel-body")).toBeHidden();

  expect(cspViolations, `CSP violations logged: ${cspViolations.join("; ")}`).toEqual([]);
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

test("a manager reaches Download source through the 'More actions' menu", async ({ page, context, baseURL }) => {
  const { token, sessionCookie } = await setupShare(baseURL!, { title: "Managed Download" });
  await loginAsAuthor(context, baseURL!, sessionCookie);
  await page.goto(`/s/${token}`);

  await expect(page.getByRole("link", { name: "Download source" })).toBeHidden();
  await page.getByLabel("More actions").click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download source" }).click()]);
  expect(download.suggestedFilename()).toMatch(/v1\.html$/);
});

test("picking a visibility row saves immediately and updates the panel in place, without reloading the page", async ({ page, context, baseURL }) => {
  const { token, shareId, artifactId, sessionCookie } = await setupShare(baseURL!, { mode: "team" });
  await loginAsAuthor(context, baseURL!, sessionCookie);
  const cspViolations = collectCspViolations(page);

  await page.goto(`/s/${token}`);
  await expect(page.frameLocator("iframe.oa-frame").locator("h1")).toBeVisible();
  await expect(modeChip(page)).toContainText("Team only");
  expect(await currentShareMode(page, artifactId)).toBe("team");

  // A marker on the top-level window: a full reload (the old behavior) would wipe it.
  await page.evaluate(() => {
    (window as unknown as { __oaMarker: string }).__oaMarker = "still-here";
  });

  await modeChip(page).click();
  await expect(modeRow(page, "team")).toHaveAttribute("aria-checked", "true");
  await modeRow(page, "public").click();

  // No "Apply" step: the trigger reflects the new mode by itself.
  await expect(modeChip(page)).toContainText("Public");
  await expect(modeRow(page, "public")).toHaveAttribute("aria-checked", "true");
  await expect(modeRow(page, "team")).toHaveAttribute("aria-checked", "false");
  expect(await page.evaluate(() => (window as unknown as { __oaMarker?: string }).__oaMarker)).toBe("still-here");
  expect(await currentShareMode(page, artifactId)).toBe("public");
  expect(new URL(page.url()).pathname).toBe(`/s/${token}`);
  expect(shareId).toBeTruthy();

  // The popover dismisses itself shortly after a successful save.
  await expect(page.locator(".oa-share-mode")).not.toHaveAttribute("open", "", { timeout: 3000 });

  // ...and the artifact itself is still rendered.
  await expect(page.frameLocator("iframe.oa-frame").locator("h1")).toBeVisible();
  expect(cspViolations, `CSP violations logged: ${cspViolations.join("; ")}`).toEqual([]);
});

test("choosing 'Password protected' asks for a password, validates it, then saves without locking the manager out", async ({ page, context, baseURL }) => {
  const { token, artifactId, sessionCookie } = await setupShare(baseURL!, { mode: "public" });
  await loginAsAuthor(context, baseURL!, sessionCookie);
  await page.goto(`/s/${token}`);

  await modeChip(page).click();
  const pwField = page.locator("#oa-mode-pw");
  await expect(pwField).toBeHidden();
  await modeRow(page, "password").click();
  await expect(pwField).toBeVisible();
  await expect(pwField).toBeFocused();
  // Nothing is saved just by revealing the field.
  expect(await currentShareMode(page, artifactId)).toBe("public");

  await pwField.fill("abc");
  await page.locator("#oa-mode-pw-apply").click();
  await expect(page.locator("#oa-mode-err")).toBeVisible();
  await expect(page.locator("#oa-mode-err")).toContainText("at least 4");
  expect(await currentShareMode(page, artifactId)).toBe("public");

  await pwField.fill("hunter22");
  await pwField.press("Enter");
  await expect(modeChip(page)).toContainText("Password protected");
  expect(await currentShareMode(page, artifactId)).toBe("password");
  await expect(pwField).toBeHidden();
  await expect(pwField).toHaveValue("");

  // The server hands the manager an unlock cookie in the same response, so a reload lands on the
  // artifact, not on the password form.
  await page.reload();
  await expect(page.frameLocator("iframe.oa-frame").locator("h1")).toBeVisible();
});

test("the visibility popover is fully visible and clickable in place — not clipped by the panel", async ({ page, context, baseURL }) => {
  const { token, sessionCookie } = await setupShare(baseURL!, { mode: "team" });
  await loginAsAuthor(context, baseURL!, sessionCookie);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/s/${token}`);

  await modeChip(page).click();
  const menu = page.locator(".oa-share-mode .oa-pop-menu");
  await expect(menu).toBeVisible();

  // Regression for the original bug: the menu used to sit inside a `max-height: 40vh;
  // overflow-y: auto` panel that clipped it, hiding the control that saved the change. A row is
  // reachable without scrolling only if a hit-test at its centre finds the row itself — the
  // panel's own scroll position (Playwright's auto-scroll would mask it) is irrelevant here.
  const hits = await page.evaluate(() => {
    const menuEl = document.querySelector(".oa-share-mode .oa-pop-menu")!;
    const m = menuEl.getBoundingClientRect();
    const results = Array.from(document.querySelectorAll(".oa-share-mode .oa-mode-opt")).map((row) => {
      const r = row.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { mode: (row as HTMLElement).dataset.mode, reachable: !!hit && row.contains(hit) };
    });
    return { results, inViewport: m.top >= 0 && m.left >= 0 && m.bottom <= innerHeight && m.right <= innerWidth };
  });
  expect(hits.inViewport).toBe(true);
  for (const r of hits.results) expect(r.reachable, `row ${r.mode} is covered or clipped`).toBe(true);

  // The panel no longer scrolls or clips at all.
  const panelOverflow = await page.locator(".oa-panel").evaluate((el) => {
    const s = getComputedStyle(el);
    return { overflowY: s.overflowY, maxHeight: s.maxHeight };
  });
  expect(panelOverflow.overflowY).toBe("visible");
  expect(panelOverflow.maxHeight).toBe("none");
});

test("popovers close on Escape and on an outside click, and only one is open at a time", async ({ page, context, baseURL }) => {
  const { token, sessionCookie } = await setupShare(baseURL!, { mode: "team" });
  await loginAsAuthor(context, baseURL!, sessionCookie);
  await page.goto(`/s/${token}`);

  const modePop = page.locator(".oa-share-mode");
  const versionPop = page.locator(".oa-versions");

  await modeChip(page).click();
  await expect(modePop).toHaveAttribute("open", "");
  await page.keyboard.press("Escape");
  await expect(modePop).not.toHaveAttribute("open", "");
  await expect(modeChip(page)).toBeFocused();

  await modeChip(page).click();
  await expect(modePop).toHaveAttribute("open", "");
  await page.locator(".oa-panel-title h1").click();
  await expect(modePop).not.toHaveAttribute("open", "");

  await modeChip(page).click();
  await versionPop.locator("summary").click();
  await expect(versionPop).toHaveAttribute("open", "");
  await expect(modePop).not.toHaveAttribute("open", "");
});

test("arrow keys, Home and End move focus between the visibility rows", async ({ page, context, baseURL }) => {
  const { token, sessionCookie } = await setupShare(baseURL!, { mode: "team" });
  await loginAsAuthor(context, baseURL!, sessionCookie);
  await page.goto(`/s/${token}`);

  await modeChip(page).click();
  // Opening the menu puts focus on the current mode.
  await expect(modeRow(page, "team")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(modeRow(page, "password")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(modeRow(page, "public")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(modeRow(page, "team")).toBeFocused();
  await page.keyboard.press("End");
  await expect(modeRow(page, "public")).toBeFocused();
  await page.keyboard.press("Home");
  await expect(modeRow(page, "team")).toBeFocused();
});

test("on a phone-width screen the visibility menu stays inside the viewport", async ({ page, context, baseURL }) => {
  const { token, sessionCookie } = await setupShare(baseURL!, { mode: "team" });
  await loginAsAuthor(context, baseURL!, sessionCookie);
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto(`/s/${token}`);

  await modeChip(page).click();
  const menu = page.locator(".oa-share-mode .oa-pop-menu");
  await expect(menu).toBeVisible();
  const box = (await menu.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375);

  // No horizontal page scroll from the panel.
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflowX).toBe(false);
});
