import { test, expect } from "@playwright/test";

const MALICIOUS_ARTIFACT_HTML = `
<h1 id="visible-marker">SECURITY-PROBE-CONTENT</h1>
<script>
(async () => {
  const result = {};
  try {
    result.cookie = document.cookie;
  } catch (e) {
    result.cookieError = String(e);
  }
  try {
    result.localStorageKeys = Object.keys(window.localStorage);
  } catch (e) {
    result.localStorageError = String(e);
  }
  try {
    const res = await fetch('/api/v1/artifacts', { credentials: 'include' });
    result.fetchOk = true;
    result.fetchStatus = res.status;
  } catch (e) {
    result.fetchOk = false;
    result.fetchError = String(e);
  }
  console.log('SECURITY_PROBE_RESULT:' + JSON.stringify(result));
})();
</script>
`;

interface ProbeResult {
  cookie?: string;
  cookieError?: string;
  localStorageKeys?: string[];
  localStorageError?: string;
  fetchOk?: boolean;
  fetchStatus?: number;
  fetchError?: string;
}

async function setupMaliciousShare(baseURL: string): Promise<string> {
  const email = `attacker-target-${Math.random().toString(36).slice(2)}@example.com`;
  const registerRes = await fetch(`${baseURL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "correct horse battery staple", name: "Victim" }),
  });
  if (!registerRes.ok) throw new Error(`register failed: ${registerRes.status} ${await registerRes.text()}`);
  const setCookie = registerRes.headers.get("set-cookie")!;
  const sessionCookie = /oa_session=([^;]+)/.exec(setCookie)![1];

  const orgRes = await fetch(`${baseURL}/api/v1/orgs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `oa_session=${sessionCookie}` },
    body: JSON.stringify({ name: "Victim's workspace" }),
  });
  if (!orgRes.ok) throw new Error(`org creation failed: ${orgRes.status} ${await orgRes.text()}`);
  const { id: orgId } = (await orgRes.json()) as { id: string };

  const createRes = await fetch(`${baseURL}/api/v1/artifacts?orgId=${orgId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `oa_session=${sessionCookie}` },
    body: JSON.stringify({ title: "Malicious", kind: "html", content: MALICIOUS_ARTIFACT_HTML, visibility: "private" }),
  });
  if (!createRes.ok) throw new Error(`create failed: ${createRes.status} ${await createRes.text()}`);
  const created = (await createRes.json()) as { artifact: { id: string } };

  // `mode: "public"` must stay explicit here: this spec exercises the fully-anonymous embed path
  // (no cookies at all on the /embed/:token request below), and the team's default share mode is
  // "team" — which would require a logged-in member and defeat the point of this test.
  const shareRes = await fetch(`${baseURL}/api/v1/artifacts/${created.artifact.id}/shares`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `oa_session=${sessionCookie}` },
    body: JSON.stringify({ mode: "public" }),
  });
  if (!shareRes.ok) throw new Error(`share failed: ${shareRes.status} ${await shareRes.text()}`);
  const share = (await shareRes.json()) as { token: string };
  return share.token;
}

test("a malicious artifact cannot read the viewer's cookies, localStorage, or call the API", async ({ page, baseURL }) => {
  const token = await setupMaliciousShare(baseURL!);

  let probeResult: ProbeResult | undefined;
  page.on("console", (msg) => {
    const text = msg.text();
    if (text.startsWith("SECURITY_PROBE_RESULT:")) {
      probeResult = JSON.parse(text.slice("SECURITY_PROBE_RESULT:".length));
    }
  });

  await page.goto(`/s/${token}`);

  // Positive control: the artifact's own benign content really did render inside the iframe —
  // otherwise a "nothing ran" false negative would make every assertion below meaningless.
  const iframe = page.frameLocator("iframe");
  await expect(iframe.locator("#visible-marker")).toHaveText("SECURITY-PROBE-CONTENT");

  await expect.poll(() => probeResult, { timeout: 5000 }).toBeDefined();
  const result = probeResult!;

  // The iframe has an opaque origin (sandbox without allow-same-origin): document.cookie either
  // throws (Chromium) or reads back empty — either way, the session cookie is never exposed to it.
  if (result.cookieError === undefined) {
    expect(result.cookie).toBe("");
  } else {
    expect(result.cookieError).toBeTruthy();
  }

  // localStorage access from an opaque origin is denied outright (throws) in every browser we
  // support; accept either that or an empty result rather than pinning to one exact error string.
  if (result.localStorageError === undefined) {
    expect(result.localStorageKeys).toEqual([]);
  }

  // CSP's connect-src 'none' on the /embed response blocks the fetch at the network layer,
  // regardless of same-site cookie rules — this is the line of defense that actually matters
  // even if a future change ever relaxed the iframe sandbox.
  expect(result.fetchOk).toBe(false);
});
