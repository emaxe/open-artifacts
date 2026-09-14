/**
 * Bilingual RU/EN dictionary for the sign-in/sign-up screen — split off from the marketing
 * landing's `copy.ts` (apps/web/src/pages/landing/copy.ts, before the landing moved to
 * apps/landing) when that page turned into a pure static site with no auth form. This is the only
 * bilingual surface left in the app; the rest of the app chrome stays Russian-only (lib/labels.ts).
 *
 * `en` is typed against `typeof ru`, so a key present in one language and missing in the other is
 * a compile error, not a silently blank string at runtime — same discipline as the old copy.ts.
 */

export type Lang = "ru" | "en";

export interface AuthErrorCopy {
  invalidCredentials: string;
  accountBlocked: string;
  accountDeleted: string;
  emailTaken: string;
  registrationClosed: string;
  inviteRequired: string;
  invalidInput: string;
  rateLimited: string;
  unknown: string;
}

export interface AuthCopy {
  meta: { title: string };
  brand: {
    badge: string;
    heading: string;
    bullets: string[];
    terminalReplay: string;
  };
  demo: { frameTitle: string; fakeUrl: string; note: string };
  tabLogin: string;
  tabRegister: string;
  nameLabel: string;
  emailLabel: string;
  passwordLabel: string;
  passwordHint: string;
  loginSubmit: string;
  registerSubmit: string;
  loginAltPrompt: string;
  loginAltLink: string;
  registerAltPrompt: string;
  registerAltLink: string;
  connectAgent: string;
  registrationInviteOnlyNote: string;
  registrationClosedNote: string;
  switchToLogin: string;
  errors: AuthErrorCopy;
}

export const AUTH_COPY: { ru: AuthCopy; en: AuthCopy } = {
  ru: {
    meta: { title: "Open Artifacts — вход" },
    brand: {
      badge: "Open source · MIT · Self-hosted",
      heading: "Артефакты ваших AI-агентов — одной ссылкой, на вашем сервере",
      bullets: [
        "Песочница нулевого доверия: без доступа к сессии и API хоста",
        "Свой сервер, свои данные — MIT-лицензия",
        "MCP, REST и CLI из коробки — подключается за одну команду",
      ],
      terminalReplay: "Повторить",
    },
    demo: {
      frameTitle: "Демонстрационный артефакт",
      fakeUrl: "https://ваш-сервер/s/9kQ2xR",
      note: "sandbox=\"allow-scripts\", без allow-same-origin",
    },
    tabLogin: "Вход",
    tabRegister: "Регистрация",
    nameLabel: "Имя",
    emailLabel: "Email",
    passwordLabel: "Пароль",
    passwordHint: "Минимум 8 символов",
    loginSubmit: "Войти",
    registerSubmit: "Создать аккаунт",
    loginAltPrompt: "Нет аккаунта?",
    loginAltLink: "Зарегистрироваться",
    registerAltPrompt: "Уже есть аккаунт?",
    registerAltLink: "Войти",
    connectAgent: "Подключить агента →",
    registrationInviteOnlyNote: "На этом сервере регистрация доступна только по приглашению.",
    registrationClosedNote: "Регистрация на этом сервере закрыта.",
    switchToLogin: "Войти с этим email",
    errors: {
      invalidCredentials: "Неверный email или пароль",
      accountBlocked: "Аккаунт заблокирован. Обратитесь к администратору",
      accountDeleted: "Этот аккаунт удалён",
      emailTaken: "Такой email уже зарегистрирован",
      registrationClosed: "Регистрация на этом сервере закрыта",
      inviteRequired: "На этом сервере нужна ссылка-приглашение",
      invalidInput: "Проверьте поля формы — пароль не короче 8 символов",
      rateLimited: "Слишком много попыток. Попробуйте через минуту",
      unknown: "Что-то пошло не так. Попробуйте ещё раз",
    },
  },

  en: {
    meta: { title: "Open Artifacts — sign in" },
    brand: {
      badge: "Open source · MIT · Self-hosted",
      heading: "Your AI agents' artifacts — one link, on your own server",
      bullets: [
        "Zero-trust sandbox: no access to the host's session or API",
        "Your server, your data — MIT-licensed",
        "MCP, REST, and a CLI out of the box — one command to connect",
      ],
      terminalReplay: "Replay",
    },
    demo: {
      frameTitle: "Demo artifact",
      fakeUrl: "https://your-server/s/9kQ2xR",
      note: "sandbox=\"allow-scripts\", no allow-same-origin",
    },
    tabLogin: "Sign in",
    tabRegister: "Sign up",
    nameLabel: "Name",
    emailLabel: "Email",
    passwordLabel: "Password",
    passwordHint: "At least 8 characters",
    loginSubmit: "Sign in",
    registerSubmit: "Create account",
    loginAltPrompt: "No account yet?",
    loginAltLink: "Sign up",
    registerAltPrompt: "Already have an account?",
    registerAltLink: "Sign in",
    connectAgent: "Connect an agent →",
    registrationInviteOnlyNote: "Registration on this server requires an invite link.",
    registrationClosedNote: "Registration on this server is closed.",
    switchToLogin: "Sign in with this email",
    errors: {
      invalidCredentials: "Incorrect email or password",
      accountBlocked: "This account is blocked. Contact an administrator",
      accountDeleted: "This account has been deleted",
      emailTaken: "This email is already registered",
      registrationClosed: "Registration on this server is closed",
      inviteRequired: "This server requires an invite link to register",
      invalidInput: "Check the fields — password must be at least 8 characters",
      rateLimited: "Too many attempts. Try again in a minute",
      unknown: "Something went wrong. Please try again",
    },
  },
};

export function detectInitialLang(searchParamLang: string | null): Lang {
  if (searchParamLang === "ru" || searchParamLang === "en") return searchParamLang;
  try {
    const stored = localStorage.getItem("oa_landing_lang");
    if (stored === "ru" || stored === "en") return stored;
  } catch {
    // Private tab or blocked site data — fall through to the browser's own language.
  }
  return navigator.language.toLowerCase().startsWith("ru") ? "ru" : "en";
}
