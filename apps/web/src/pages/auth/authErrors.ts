import type { AuthErrorCopy } from "./authCopy";

/**
 * Maps the API's error codes (apps/api/src/routes/auth.ts) to a key in `AuthErrorCopy` — never the
 * server's own message text, since that's always English and this screen is bilingual.
 * `account_${status}` is built by the handler from two concrete statuses; both map here.
 */
const CODE_TO_KEY: Record<string, keyof AuthErrorCopy> = {
  invalid_credentials: "invalidCredentials",
  account_blocked: "accountBlocked",
  account_deleted: "accountDeleted",
  email_taken: "emailTaken",
  registration_closed: "registrationClosed",
  invite_required: "inviteRequired",
  invalid_input: "invalidInput",
  rate_limited: "rateLimited",
};

export function authErrorMessage(errors: AuthErrorCopy, code: string): string {
  const key = CODE_TO_KEY[code];
  return key ? errors[key] : errors.unknown;
}
