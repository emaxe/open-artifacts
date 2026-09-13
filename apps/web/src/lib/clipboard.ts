/**
 * `navigator.clipboard` is undefined on insecure origins (plain HTTP — common for a freshly
 * self-hosted instance before TLS is set up) and its `writeText` call can also reject when a
 * browser/embedder denies the permission. Neither case throws anything visible to the user with
 * just the modern API, so every copy button silently does nothing. `execCommand('copy')` has no
 * such restrictions and still works nearly everywhere, so it's the fallback of last resort.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy fallback below
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
