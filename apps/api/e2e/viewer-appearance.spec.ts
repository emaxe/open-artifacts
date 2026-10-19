import { test, expect } from "@playwright/test";

// The viewer's own look (theme / colour mode / width) from the share-link "Appearance" menu: kept in
// the viewer's browser, sent to the embed as query parameters, off when the author locks it.

async function publish(baseURL: string, extra: Record<string, unknown> = {}): Promise<string> {
  const email = `appearance-e2e-${Math.random().toString(36).slice(2)}@example.com`;
  const reg = await fetch(`${baseURL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "correct horse battery staple", name: "Author" }),
  });
  const cookie = /oa_session=([^;]+)/.exec(reg.headers.get("set-cookie")!)![1];
  const headers = { "Content-Type": "application/json", Cookie: `oa_session=${cookie}` };
  const org = (await (await fetch(`${baseURL}/api/v1/orgs`, { method: "POST", headers, body: JSON.stringify({ name: "Appearance e2e" }) })).json()) as { id: string };
  const art = (await (
    await fetch(`${baseURL}/api/v1/artifacts?orgId=${org.id}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "Appearance", kind: "markdown", content: "# Hello\n\nSome text.", ...extra }),
    })
  ).json()) as { artifact: { id: string } };
  const share = (await (
    await fetch(`${baseURL}/api/v1/artifacts/${art.artifact.id}/shares`, { method: "POST", headers, body: JSON.stringify({ mode: "public" }) })
  ).json()) as { token: string };
  return share.token;
}

// Read while the iframe may be mid-navigation after a change; a destroyed context just means "not yet".
const frameBg = (page: import("@playwright/test").Page) =>
  page
    .frameLocator("iframe.oa-frame")
    .locator("body")
    .evaluate((el) => getComputedStyle(el).backgroundColor)
    .catch(() => "");

test("a viewer's theme and colour mode apply, persist across pages, and reset", async ({ page, baseURL, context }) => {
  const token = await publish(baseURL!);
  const embeds: string[] = [];
  page.on("request", (r) => r.url().includes("/embed/") && embeds.push(r.url()));

  await page.goto(`/s/${token}`);
  await expect.poll(() => frameBg(page)).toBe("rgb(230, 224, 210)"); // sand, light
  expect(embeds).toHaveLength(1); // the iframe loads once, not once plain and once restyled

  await page.locator("details.oa-style > summary").click();
  await page.locator('.oa-style-opt[data-key="theme"][data-val="terminal"]').click();
  await page.locator('.oa-style-opt[data-key="scheme"][data-val="dark"]').click();
  await expect.poll(() => frameBg(page)).toBe("rgb(10, 14, 11)"); // terminal, dark
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark"); // the panel follows too
  expect(embeds.filter((u) => u.includes("r=1")).length).toBeGreaterThan(0); // re-renders aren't new views

  // Kept in this browser: a fresh page applies it on the very first request.
  const again = await context.newPage();
  const firstEmbed: string[] = [];
  again.on("request", (r) => r.url().includes("/embed/") && firstEmbed.push(r.url()));
  await again.goto(`/s/${token}`);
  await expect.poll(() => frameBg(again)).toBe("rgb(10, 14, 11)");
  expect(firstEmbed).toHaveLength(1);
  expect(firstEmbed[0]).toContain("theme=terminal");

  await page.locator("details.oa-style [data-reset]").click();
  await expect.poll(() => frameBg(page)).toBe("rgb(230, 224, 210)");
});

test("an author-locked page offers no picker and ignores viewer parameters", async ({ page, baseURL }) => {
  const token = await publish(baseURL!, { lockAppearance: true });
  await page.goto(`/s/${token}?x=1`);
  await expect(page.locator(".oa-panel")).toBeVisible();
  await expect(page.locator("details.oa-style")).toHaveCount(0);
  const res = await page.request.get(`/embed/${token}?theme=terminal&scheme=dark`);
  expect(await res.text()).not.toContain("#0a0e0b");
});

test("on a phone the menu stays inside the screen and offers no width choice", async ({ page, baseURL }) => {
  const token = await publish(baseURL!);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`/s/${token}`);
  await page.locator("details.oa-style > summary").click();
  const box = (await page.locator(".oa-style-menu").boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await expect(page.locator(".oa-style-width")).toBeHidden();
});
