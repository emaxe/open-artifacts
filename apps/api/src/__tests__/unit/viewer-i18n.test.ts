import { describe, expect, it } from "vitest";
import { pickViewerLang, VIEWER_STRINGS } from "../../views/viewer-i18n.js";
import { renderErrorPage, renderPasswordFormPage, renderRestrictedPage } from "../../views/viewer-shell.js";

describe("pickViewerLang", () => {
  it("defaults to English", () => {
    expect(pickViewerLang(undefined)).toBe("en");
    expect(pickViewerLang("")).toBe("en");
    expect(pickViewerLang("de-DE,fr;q=0.8")).toBe("en");
  });

  it("follows the first supported language in the header", () => {
    expect(pickViewerLang("ru-RU,ru;q=0.9,en;q=0.8")).toBe("ru");
    expect(pickViewerLang("en-US,ru;q=0.5")).toBe("en");
    expect(pickViewerLang("de,ru;q=0.5")).toBe("ru");
  });
});

describe("viewer shell localisation", () => {
  it("renders Russian pages with lang=ru and Russian copy", () => {
    const html = renderPasswordFormPage("n0nce", "ru");
    expect(html).toContain('<html lang="ru">');
    expect(html).toContain(VIEWER_STRINGS.ru.passwordRequired);
    expect(html).not.toContain("Password required");
  });

  it("escapes the login link even in the Russian restricted page", () => {
    const html = renderRestrictedPage('/login?next="><script>x</script>', "n0nce", "ru");
    expect(html).not.toContain("<script>x</script>");
  });

  it("keeps English as the default language", () => {
    expect(renderErrorPage("gone", "n0nce")).toContain('<html lang="en">');
  });

  it("pluralises Russian view counts", () => {
    const view = VIEWER_STRINGS.ru.view;
    expect([view(1), view(2), view(5), view(11), view(21), view(112)]).toEqual([
      "1 просмотр",
      "2 просмотра",
      "5 просмотров",
      "11 просмотров",
      "21 просмотр",
      "112 просмотров",
    ]);
  });
});
