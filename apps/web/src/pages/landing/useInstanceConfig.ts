import { useEffect, useState } from "react";
import { api, type InstanceConfig, type RegistrationMode } from "../../lib/api";

/**
 * `null` while loading. On a fetch failure we fall open to `"open"` rather than staying `null`
 * forever — the submit-time error mapping (registration_closed/invite_required, see authErrors.ts)
 * handles the case correctly either way, and a stuck "loading" state would otherwise permanently
 * hide the registration tab.
 */
export function useInstanceConfig(): { mode: RegistrationMode | null; setMode: (mode: RegistrationMode) => void } {
  const [mode, setMode] = useState<RegistrationMode | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<InstanceConfig>("/instance/config")
      .then((config) => {
        if (!cancelled) setMode(config.registrationMode);
      })
      .catch(() => {
        if (!cancelled) setMode("open");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { mode, setMode };
}
