/**
 * Small hand-written label dictionaries — not a full i18n library. This app has one language and
 * roughly 70 strings that need mapping from raw API enum values / action names to Russian; a
 * loader, key-extraction pipeline, and indirection layer would cost more than they'd save here.
 */

export const ORG_ROLE_LABELS: Record<string, string> = {
  owner: "Владелец",
  admin: "Администратор",
  member: "Участник",
  viewer: "Наблюдатель",
};

export const USER_STATUS_LABELS: Record<string, string> = {
  active: "Активен",
  blocked: "Заблокирован",
  deleted: "Удалён",
};

export const INVITE_STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает",
  accepted: "Принято",
  declined: "Отклонено",
  revoked: "Отозвано",
};

export const ORG_KIND_LABELS: Record<string, string> = {
  main: "Основное",
  team: "Команда",
};

export const REGISTRATION_MODE_LABELS: Record<string, string> = {
  open: "Открыта",
  invite_only: "Только по приглашению",
  closed: "Закрыта",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "user.register": "Регистрация пользователя",
  "user.set_status": "Изменение статуса пользователя",
  "org.create": "Создание команды",
  "org.update": "Изменение команды",
  "org.invite": "Приглашение в команду",
  "org.invite_accept": "Приглашение принято",
  "org.invite_decline": "Приглашение отклонено",
  "org.invite_revoke": "Приглашение отозвано",
  "org.add_member": "Добавление участника",
  "org.remove_member": "Удаление участника",
  "org.change_role": "Изменение роли участника",
  "org.leave": "Выход из команды",
  "agent.create": "Создание агента",
  "device_auth.approve": "Подтверждение входа агента",
};

/** Falls back to the raw key rather than blanking it out — an untranslated value should degrade, not disappear. */
export function label(dict: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "—";
  return dict[key] ?? key;
}

/** Russian plural forms: pluralRu(1, ["участник", "участника", "участников"]) -> "участник". */
export function pluralRu(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  const units = ["КБ", "МБ", "ГБ", "ТБ"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

/**
 * Mirrors the server's maskEmail() (services/invites.ts) purely so the client can tell whether the
 * signed-in user's own email matches an invite's masked address, without the server ever handing
 * back the real one. Never used as an authorization check — the server re-verifies on accept.
 */
export function maskEmailClient(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
