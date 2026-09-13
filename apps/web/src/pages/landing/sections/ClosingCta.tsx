import { Button } from "../../../components/ui/Button";
import { useLandingCopy } from "../LandingI18n";
import type { AuthTab } from "../AuthCard";

export function ClosingCta({ onFocusAuth }: { onFocusAuth: (tab: AuthTab) => void }) {
  const { t } = useLandingCopy();
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
      <h2 className="text-2xl font-semibold text-fg sm:text-3xl">{t.cta.heading}</h2>
      <p className="mx-auto mt-2 max-w-xl text-muted">{t.cta.body}</p>
      <Button className="mt-6" onClick={() => onFocusAuth("register")}>
        {t.cta.button}
      </Button>
    </section>
  );
}
