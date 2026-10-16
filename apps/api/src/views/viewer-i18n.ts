import type { ShareMode } from "@open-artifacts/shared";

/**
 * Interface strings of the public viewer shell. The viewer is opened by arbitrary recipients, so the
 * language follows the browser's `Accept-Language` (Russian when it asks for it first, English
 * otherwise); there is no setting to store it in. Everything here is static text: nothing
 * server-, user- or artifact-supplied ever goes through this table.
 */
export type ViewerLang = "en" | "ru";

export interface ViewerStrings {
  htmlLang: string;
  versionsTitle: string;
  versionWord: string;
  pinned: string;
  current: string;
  versionsMore: string;
  switchVersion: string;
  shareModes: Record<ShareMode, string>;
  shareModeHints: Record<ShareMode, string>;
  disabledForTeam: string;
  visibilityPrefix: string;
  visibilityTitle: string;
  whoCanOpen: string;
  newPassword: string;
  setPassword: string;
  copyLink: string;
  moreActions: string;
  downloadSource: string;
  openInWorkspace: string;
  showDetails: string;
  hideDetails: string;
  by: string;
  view: (n: number) => string;
  neverExpires: string;
  expires: string;
  olderVersionNotice: string;
  backToShared: string;
  homeAria: string;
  frameTitle: string;
  passwordRequired: string;
  passwordIntro: string;
  passwordPlaceholder: string;
  unlock: string;
  incorrectPassword: string;
  membersOnly: string;
  restricted: string;
  /** Contains an anchor placeholder: `{login}` wraps the link text. */
  restrictedBody: (loginHref: string) => string;
  unavailable: string;
  /** Strings the inline PANEL_SCRIPT needs at runtime. */
  script: {
    showDetails: string;
    hideDetails: string;
    copied: string;
    linkCopied: string;
    saving: string;
    visibilityUpdated: string;
    visibilityChangedTo: string;
    couldNotChange: string;
    passwordTooShort: string;
  };
  notFound: string;
  noLongerAvailable: string;
  noContent: string;
  dateLocale: string;
}

const en: ViewerStrings = {
  htmlLang: "en",
  versionsTitle: "Versions",
  versionWord: "Version",
  pinned: "pinned",
  current: "current",
  versionsMore: "Showing the most recent versions only.",
  switchVersion: "Switch version",
  shareModes: { team: "Team only", password: "Password protected", public: "Public" },
  shareModeHints: {
    team: "Signed-in members of this team",
    password: "Anyone with the link and the password",
    public: "Anyone with the link",
  },
  disabledForTeam: "Disabled for this team",
  visibilityPrefix: "Visibility: ",
  visibilityTitle: "Who can open this link",
  whoCanOpen: "Who can open this link",
  newPassword: "New password",
  setPassword: "Set password",
  copyLink: "Copy link",
  moreActions: "More actions",
  downloadSource: "Download source",
  openInWorkspace: "Open in workspace",
  showDetails: "Show details",
  hideDetails: "Hide details",
  by: "By",
  view: (n) => `${n} view${n === 1 ? "" : "s"}`,
  neverExpires: "Never expires",
  expires: "Expires",
  olderVersionNotice: "You're viewing an older version. Visitors of this link see the current one.",
  backToShared: "Back to the shared version",
  homeAria: "Open Artifacts home",
  frameTitle: "Shared artifact content",
  passwordRequired: "Password required",
  passwordIntro: "This shared artifact is protected. Enter the password to view it.",
  passwordPlaceholder: "Password",
  unlock: "Unlock",
  incorrectPassword: "Incorrect password.",
  membersOnly: "Members only",
  restricted: "Restricted",
  restrictedBody: (href) =>
    `This link is only available to members of that team. Ask whoever shared it to invite you, <a href="${href}">log in as someone else</a>, or go to your workspace.`,
  unavailable: "Unavailable",
  script: {
    showDetails: "Show details",
    hideDetails: "Hide details",
    copied: "Copied!",
    linkCopied: "Link copied",
    saving: "Saving…",
    visibilityUpdated: "Visibility updated",
    visibilityChangedTo: "Visibility changed to ",
    couldNotChange: "Could not change visibility.",
    passwordTooShort: "Password must be at least 4 characters.",
  },
  notFound: "This link does not exist.",
  noLongerAvailable: "This link is no longer available.",
  noContent: "No content available.",
  dateLocale: "en-US",
};

const ru: ViewerStrings = {
  htmlLang: "ru",
  versionsTitle: "Версии",
  versionWord: "Версия",
  pinned: "закреплена",
  current: "текущая",
  versionsMore: "Показаны только последние версии.",
  switchVersion: "Выбрать версию",
  shareModes: { team: "Только команда", password: "С паролем", public: "Публичная" },
  shareModeHints: {
    team: "Участники команды, вошедшие в аккаунт",
    password: "Любой, у кого есть ссылка и пароль",
    public: "Любой, у кого есть ссылка",
  },
  disabledForTeam: "Отключено для этой команды",
  visibilityPrefix: "Видимость: ",
  visibilityTitle: "Кто может открыть ссылку",
  whoCanOpen: "Кто может открыть ссылку",
  newPassword: "Новый пароль",
  setPassword: "Задать пароль",
  copyLink: "Копировать ссылку",
  moreActions: "Ещё",
  downloadSource: "Скачать исходник",
  openInWorkspace: "Открыть в кабинете",
  showDetails: "Показать детали",
  hideDetails: "Скрыть детали",
  by: "Автор:",
  view: (n) => {
    const m10 = n % 10;
    const m100 = n % 100;
    const word = m10 === 1 && m100 !== 11 ? "просмотр" : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? "просмотра" : "просмотров";
    return `${n} ${word}`;
  },
  neverExpires: "Без срока",
  expires: "Истекает",
  olderVersionNotice: "Вы смотрите старую версию. Посетители этой ссылки видят текущую.",
  backToShared: "Вернуться к версии по ссылке",
  homeAria: "Open Artifacts, главная",
  frameTitle: "Содержимое артефакта",
  passwordRequired: "Нужен пароль",
  passwordIntro: "Этот артефакт защищён. Введите пароль, чтобы открыть его.",
  passwordPlaceholder: "Пароль",
  unlock: "Открыть",
  incorrectPassword: "Неверный пароль.",
  membersOnly: "Только для участников",
  restricted: "Доступ ограничен",
  restrictedBody: (href) =>
    `Эта ссылка доступна только участникам команды. Попросите автора пригласить вас, <a href="${href}">войдите под другим аккаунтом</a> или перейдите в свой кабинет.`,
  unavailable: "Недоступно",
  script: {
    showDetails: "Показать детали",
    hideDetails: "Скрыть детали",
    copied: "Скопировано",
    linkCopied: "Ссылка скопирована",
    saving: "Сохранение…",
    visibilityUpdated: "Видимость обновлена",
    visibilityChangedTo: "Видимость изменена: ",
    couldNotChange: "Не удалось изменить видимость.",
    passwordTooShort: "Пароль должен быть не короче 4 символов.",
  },
  notFound: "Такой ссылки не существует.",
  noLongerAvailable: "Эта ссылка больше не доступна.",
  noContent: "Нет содержимого.",
  dateLocale: "ru-RU",
};

export const VIEWER_STRINGS: Record<ViewerLang, ViewerStrings> = { en, ru };

/** `ru` when Russian is the browser's first-listed language that we support, otherwise `en`. */
export function pickViewerLang(acceptLanguage: string | null | undefined): ViewerLang {
  if (!acceptLanguage) return "en";
  for (const part of acceptLanguage.split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase() ?? "";
    if (tag.startsWith("ru")) return "ru";
    if (tag.startsWith("en")) return "en";
  }
  return "en";
}
